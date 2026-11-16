// Loads the whole behaviour pack entry with a stand-in for @minecraft/server, so a broken import, a syntax
// error or a throw at module load in any script fails here instead of in the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const bp=resolve(root,'Kaleidoscope Herbal [BP]'),rp=resolve(root,'Kaleidoscope Herbal [RP]');
const stub=`
const sent=[],subs=[];
const any=()=>new Proxy(function(){},{get:(_,k)=>k===Symbol.toPrimitive?()=>'':any(),apply:()=>any(),construct:()=>any()});
export const system=new Proxy({currentTick:0,sent,subs,
 sendScriptEvent:(id,message)=>{sent.push({id,message});},
 run:fn=>{fn();return 1;},runTimeout:()=>1,runInterval:()=>1,runJob:()=>1,clearRun:()=>{},
 afterEvents:{scriptEventReceive:{subscribe:(fn,options)=>{subs.push({fn,options});},unsubscribe:()=>{}}},
 beforeEvents:{startup:{subscribe:fn=>{globalThis.__startup=fn;}}}},{get:(t,k)=>k in t?t[k]:any()});
export const world=new Proxy({getAllPlayers:()=>[],getDynamicPropertyIds:()=>[],getDynamicProperty:()=>undefined,setDynamicProperty:()=>{},getEntity:()=>undefined},{get:(t,k)=>k in t?t[k]:any()});
export const WeatherType={Rain:'Rain',Thunder:'Thunder'},EquipmentSlot={Mainhand:'Mainhand'},GameMode={Creative:'Creative'};
export class ItemStack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;}}
export class MolangVariableMap{setVector3(){}}
export class ActionFormData{title(){return this;}body(){return this;}button(){return this;}async show(){return {canceled:true};}}
export class BlockVolume{constructor(from,to){this.from=from;this.to=to;}}
export const BlockPermutation=any(),EntityInitializationCause={Spawned:'Spawned',Loaded:'Loaded'};
export const ItemTypes={get:id=>id.includes('missing')?undefined:{id}};
`;
register('data:text/javascript,'+encodeURIComponent(`
export async function resolve(specifier,context,next){
 if(specifier.startsWith('@minecraft/'))return {url:'herbal-stub:'+specifier,shortCircuit:true};
 return next(specifier,context);
}
export async function load(url,context,next){
 if(url.startsWith('herbal-stub:'))return {format:'module',source:${JSON.stringify(stub)},shortCircuit:true};
 return next(url,context);
}`));
const manifest=name=>JSON.parse(readFileSync(resolve(name,'manifest.json'),'utf8'));

test('the pack entry loads, registers its components and announces the API',async()=>{
 await import(pathToFileURL(resolve(bp,'scripts/main.js')).href);
 const {system}=await import('@minecraft/server');
 const names=[];globalThis.__startup({blockComponentRegistry:{registerCustomComponent:name=>names.push(name)}});
 assert.ok(names.includes('kaleidoscope_herbal:clay_pot')&&names.includes('kaleidoscope_herbal:mortar'));assert.equal(new Set(names).size,names.length);
 const ready=system.sent.find(e=>e.id==='kaleidoscope_herbal:api_ready');
 assert.ok(ready,'api_ready is broadcast at start');
 const {VERSION}=await import(pathToFileURL(resolve(bp,'scripts/data/version.js')).href);
 assert.equal(JSON.parse(ready.message).version,VERSION);
 // The real catalogs fit the 2048-character script event limit.
 const host=system.subs.find(s=>s.options?.namespaces?.[0]==='kaleidoscope_herbal'&&s.fn.toString().includes('host.handle'));
 for(const kind of ['herbs','foods','decoctions']){
  system.sent.length=0;
  host.fn({id:'kaleidoscope_herbal:catalog_request',message:JSON.stringify({api:1,source:'test_pack',kind}),sourceType:'Server'});
  const parts=system.sent.map(e=>(assert.ok(e.message.length<=2048),JSON.parse(e.message)));
  assert.ok(parts.length>=1&&parts.every(p=>p.ok&&p.kind===kind));
  assert.ok(parts.flatMap(p=>p.items).length>=(kind==='decoctions'?7:11),kind);
 }
});
// ---- v1.2.0 (A9/A11): the real clay pot and harvest handlers, driven with stand-in blocks and players.
const kh=name=>'kaleidoscope_herbal:'+name;
async function potWorld(){
 const {system,world}=await import('@minecraft/server');
 const script=path=>import(pathToFileURL(resolve(bp,'scripts',path)).href);
 const host=system.subs.find(s=>s.options?.namespaces?.[0]==='kaleidoscope_herbal'&&s.fn.toString().includes('host.handle'));
 const request=(name,body)=>{system.sent.length=0;host.fn({id:'kaleidoscope_herbal:'+name,message:JSON.stringify({api:1,source:'test_pack',...body}),sourceType:'Server'});return JSON.parse(system.sent[0].message);};
 const spawned=[],gone=new Set();
 const dimension={id:'minecraft:overworld',spawnItem(stack){if(gone.has(stack.typeId))throw new Error('unknown item');spawned.push(stack.typeId+'x'+stack.amount);},spawnParticle(){},playSound(){},getBlock:()=>block};
 const perm=states=>({getState:k=>states[k],withState:(k,v)=>perm({...states,[k]:v}),getAllStates:()=>states});
 let n=0;
 const makeBlock=(typeId,states={})=>({typeId,dimension,location:{x:++n,y:64,z:0},x:n,y:64,z:0,permutation:perm(states),setPermutation(p){this.permutation=p;},setType(t){this.typeId=t;},
  below:()=>({typeId:'minecraft:campfire',permutation:perm({})})});
 let block=makeBlock(kh('clay_pot'));
 world.getDimension=()=>dimension;
 const slot={item:undefined,amount:0,hasItem(){return !!this.item;},get typeId(){return this.item;},setItem(stack){this.item=stack?.typeId;this.amount=stack?.amount??0;},getItem(){return this.item?{typeId:this.item,amount:this.amount,getComponent:()=>undefined}:undefined;}};
 const player={id:'p9',isSneaking:false,getGameMode:()=>'Survival',getComponent:name=>name==='minecraft:equippable'?{getEquipmentSlot:()=>slot}:undefined};
 const hold=(item,amount=1)=>{slot.item=item;slot.amount=item?amount:0;};
 const events=()=>system.sent.filter(e=>e.id==='kaleidoscope_herbal:evt').map(e=>JSON.parse(e.message));
 const newPot=()=>{block=makeBlock(kh('clay_pot'));return block;};
 return {system,script,request,spawned,gone,makeBlock,newPot,get block(){return block;},slot,player,hold,events};
}
test('clay pot: takes, brews and serves an external recipe, then broadcasts when it burns',async()=>{
 const w=await potWorld(),{clayPot,tickPot}=await w.script('custom_components/clayPot.js'),{getRecord}=await w.script('utils/blockStore.js');
 const use=(item,amount)=>{w.hold(item,amount);clayPot.onPlayerInteract({block:w.block,player:w.player});};
 const light=()=>{w.player.isSneaking=true;use(undefined);w.player.isSneaking=false;};
 const simmer=until=>{for(let i=0;i<400&&getRecord(w.block)?.stage!==until;i++)tickPot(getRecord(w.block).key);};
 use('minecraft:water_bucket');assert.equal(getRecord(w.block).stage,1);assert.equal(w.slot.item,'minecraft:bucket');
 use('test_pack:root',2);assert.equal(w.slot.amount,2);assert.deepEqual(getRecord(w.block).ingredients,[]); // unknown items stay in the hand
 assert.equal(w.request('recipe_register',{recipes:[{id:'test_pack:tonic',ingredients:[{id:'test_pack:root',count:2},{id:kh('licorice_slices'),count:1}],servings:2,time:200},
  {id:'test_pack:missing_item',ingredients:[{id:'test_pack:root',count:1}],servings:1}]}).rejected[0].code,'UNKNOWN_ITEM');
 assert.equal(w.request('adjuvant_register',{items:[{id:'test_pack:honey'}]}).ok,true);
 use('test_pack:root',2);use('test_pack:root',1);use(kh('licorice_slices'));use('test_pack:honey');
 assert.deepEqual(getRecord(w.block).ingredients,['test_pack:root','test_pack:root',kh('licorice_slices'),'test_pack:honey']);assert.equal(w.slot.item,undefined);
 light();
 const lit=getRecord(w.block);assert.equal(lit.stage,2);assert.equal(lit.result,'test_pack:tonic');assert.equal(lit.recipeServings,3);assert.equal(lit.by,'p9');
 simmer(3);assert.equal(getRecord(w.block).output,'test_pack:tonic');
 w.system.sent.length=0;use('minecraft:bowl',3);
 assert.deepEqual(w.spawned,['test_pack:tonicx1']);assert.equal(getRecord(w.block).servings,2);assert.equal(w.slot.amount,2);
 assert.deepEqual(w.events(),[{v:1,t:'decoction_served',p:'p9',id:'test_pack:tonic'}]);
 w.system.sent.length=0;simmer(4);
 assert.equal(getRecord(w.block).output,kh('burnt_dregs'));assert.deepEqual(w.events(),[{v:1,t:'decoction_burnt',p:'p9',id:'test_pack:tonic'}]);
 // A built-in formula in the same pot type still gives Herbal's own decoction.
 w.newPot();w.system.currentTick=100;use('minecraft:water_bucket');for(const item of ['ginseng_slices','ginseng_slices','licorice_slices'])use(kh(item));light();
 assert.equal(getRecord(w.block).result,kh('ginseng_decoction'));
 // A wrong mix simmers into bitter dregs and says so.
 w.newPot();w.system.sent.length=0;use('minecraft:water_bucket');use(kh('dried_jujube'));use('test_pack:root');light();simmer(3);
 assert.equal(getRecord(w.block).output,kh('bitter_dregs'));assert.deepEqual(w.events(),[{v:1,t:'decoction_bitter',p:'p9'}]);
 // The registering pack is gone and its item with it: the pot hands out bitter dregs instead of jamming.
 w.newPot();use('minecraft:water_bucket');use('test_pack:root');use('test_pack:root');use(kh('licorice_slices'));light();simmer(3);
 w.gone.add('test_pack:tonic');w.spawned.length=0;use('minecraft:bowl');assert.deepEqual(w.spawned,[kh('bitter_dregs')+'x1']);
 clayPot.onPlayerBreak({block:w.block});assert.deepEqual(w.spawned,[kh('bitter_dregs')+'x1',kh('bitter_dregs')+'x1']);assert.equal(getRecord(w.block),undefined);
 w.request('recipe_register',{recipes:[{id:'test_pack:tonic',servings:0}]});w.request('adjuvant_register',{items:[{id:'test_pack:honey',servings:0}]});
});
test('harvesting a cultivated or wild herb broadcasts herb_harvested, throttled per player',async()=>{
 const w=await potWorld(),{cropGrowth}=await w.script('custom_components/cropGrowth.js'),{ginsengCrop}=await w.script('custom_components/ginsengCrop.js');
 const {handleWildHarvest}=await w.script('utils/ginsengHarvest.js');
 const wild=(name,player=w.player)=>handleWildHarvest({brokenBlockPermutation:{type:{id:name}},player});
 w.system.sent.length=0;w.system.currentTick=1000;w.hold(undefined);
 const crop=w.makeBlock(kh('angelica_crop'),{[kh('growth')]:1});
 cropGrowth.onPlayerInteract({block:crop,player:w.player});assert.deepEqual(w.events(),[]); // not ripe
 crop.permutation=crop.permutation.withState(kh('growth'),2);cropGrowth.onPlayerInteract({block:crop,player:w.player});
 assert.deepEqual(w.events(),[{v:1,t:'herb_harvested',p:'p9',herb:'angelica',wild:false}]);assert.equal(crop.permutation.getState(kh('growth')),0);
 wild(kh('wild_goji'));assert.equal(w.events().length,1); // same player, same second
 w.system.currentTick=1020;w.system.sent.length=0;wild(kh('wild_goji'));
 assert.deepEqual(w.events(),[{v:1,t:'herb_harvested',p:'p9',herb:'goji',wild:true}]);
 w.system.currentTick=1040;w.system.sent.length=0;
 wild('minecraft:stone');wild(kh('wild_poria'),{...w.player,getGameMode:()=>'Creative'});assert.deepEqual(w.events(),[]);
 const ginseng=w.makeBlock(kh('ginseng_crop'),{[kh('growth')]:3});w.hold(kh('herbal_trowel'));
 ginsengCrop.onPlayerInteract({block:ginseng,player:w.player});
 assert.deepEqual(w.events(),[{v:1,t:'herb_harvested',p:'p9',herb:'ginseng',wild:false}]);assert.equal(ginseng.typeId,'minecraft:air');
});
test('scripts and both manifests carry the same version',async()=>{
 const {VERSION}=await import(pathToFileURL(resolve(bp,'scripts/data/version.js')).href);
 const want=VERSION.split('.').map(Number),b=manifest(bp),r=manifest(rp);
 for(const version of [b.header.version,r.header.version,...b.modules.map(m=>m.version),...r.modules.map(m=>m.version)])assert.deepEqual(version,want);
 const link=b.dependencies.find(d=>d.uuid);assert.equal(link.uuid,r.header.uuid);assert.deepEqual(link.version,want);
 const {GUIDEBOOK}=await import(pathToFileURL(resolve(bp,'scripts/data/guidebook.js')).href);
 assert.equal(GUIDEBOOK.version,VERSION);
 assert.ok(r.capabilities.includes('pbr'));
});
