// 1.3.2 convenience: refusal cues where Herbal used to ignore a clear attempt, and sneak-use doing a whole job
// (mortar batches, 3x3 harvests, serving a whole pot, topping up a burner). The real handlers run against a small
// stand-in world with a game clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const bp=resolve(root,'Kaleidoscope Herbal [BP]');
const stub=`
const timers=[];let tick=0;const props=new Map();
const any=()=>new Proxy(function(){},{get:(_,k)=>k===Symbol.toPrimitive?()=>'':any(),apply:()=>any(),construct:()=>any()});
export const system=new Proxy({get currentTick(){return tick;},runTimeout(fn,t=1){timers.push({fn,at:tick+Math.max(1,t)});return timers.length;},
 run(fn){return this.runTimeout(fn,1);},runInterval:()=>1,clearRun(){},sendScriptEvent(){},
 afterEvents:{scriptEventReceive:{subscribe(){}}},beforeEvents:{startup:{subscribe(){}}}},{get:(t,k)=>k in t?t[k]:any()});
export const world=new Proxy({getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>{if(v===undefined)props.delete(k);else props.set(k,v);},
 getDynamicPropertyIds:()=>[...props.keys()],getAllPlayers:()=>[],getTimeOfDay:()=>6000,
 beforeEvents:{playerInteractWithBlock:{subscribe(){}}}},{get:(t,k)=>k in t?t[k]:any()});
export function step(n){for(let i=0;i<n;i++){tick++;for(const t of timers.filter(t=>t.at===tick))t.fn();}}
export class ItemStack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.maxAmount=64;}setLore(l){this.lore=l;}getLore(){return this.lore??[];}
 getComponent(n){return n==='minecraft:durability'?this.durability:undefined;}hasTag(){return false;}getDynamicProperty(){}setDynamicProperty(){}}
export class MolangVariableMap{setColorRGB(){}setVector3(){}}
export const EquipmentSlot={Mainhand:'Mainhand'},GameMode={Survival:'Survival',Creative:'Creative'},WeatherType={Rain:'Rain',Thunder:'Thunder'};
export const BlockPermutation=any(),BlockVolume=class{},EntityInitializationCause={Spawned:'Spawned',Loaded:'Loaded'},ItemTypes={get:id=>({id})};
`;
register('data:text/javascript,'+encodeURIComponent(`
export async function resolve(s,c,n){return s.startsWith('@minecraft/')?{url:'v13-stub:'+s,shortCircuit:true}:n(s,c);}
export async function load(u,c,n){return u.startsWith('v13-stub:')?{format:'module',source:${JSON.stringify(stub)},shortCircuit:true}:n(u,c);}`));
const {step,ItemStack}=await import('@minecraft/server');
const script=path=>import(pathToFileURL(resolve(bp,'scripts',path)).href);
const kh=name=>'kaleidoscope_herbal:'+name;
// A flat world of blocks keyed by position, a log of sounds and spawned items, and one player.
function makeWorld(){
 const grid=new Map(),sounds=[],spawned=[],at=p=>`${p.x},${p.y},${p.z}`;
 const dimension={id:'minecraft:overworld',getBlock:p=>grid.get(at(p)),spawnItem(stack){spawned.push({id:stack.typeId,n:stack.amount});return {clearVelocity(){}};},
  spawnParticle(){},playSound(sound){sounds.push({sound,tick:system.currentTick});}};
 const perm=states=>({getState:k=>states[k],withState:(k,v)=>perm({...states,[k]:v}),getAllStates:()=>states});
 const put=(typeId,location,states={})=>{
  const block={typeId,dimension,location,x:location.x,y:location.y,z:location.z,permutation:perm(states),
   setPermutation(p){this.permutation=p;},setType(t){this.typeId=t;},center:()=>({x:location.x+.5,y:location.y+.5,z:location.z+.5}),getLightLevel:()=>8};
  grid.set(at(location),block);return block;
 };
 const slots=Array(36).fill(undefined);
 const container={size:36,getItem:i=>slots[i],setItem:(i,s)=>{slots[i]=s;},addItem(stack){const i=slots.findIndex(s=>!s);slots[i]=stack;return undefined;}};
 const main={hasItem:()=>!!slots[0],get typeId(){return slots[0]?.typeId;},get amount(){return slots[0]?.amount??0;},set amount(n){slots[0].amount=n;},
  setItem(s){slots[0]=s;},getItem:()=>slots[0]};
 const player={id:'p13',isSneaking:false,location:{x:0,y:64,z:0},dimension,getGameMode:()=>'Survival',
  getComponent:n=>n==='minecraft:equippable'?{getEquipmentSlot:()=>main}:n==='minecraft:inventory'?{container}:undefined};
 const hold=(item,amount=1,i=0)=>{slots[i]=item?new ItemStack(item,amount):undefined;return slots[i];};
 const tool=item=>{const s=hold(item);s.durability={damage:0,maxDurability:128};return s;};
 const count=item=>slots.reduce((n,s)=>n+(s?.typeId===item?s.amount:0),0);
 const heard=name=>sounds.filter(s=>s.sound===name).length;
 return {grid,sounds,spawned,put,slots,player,hold,tool,count,heard};
}
const {system}=await import('@minecraft/server');
let spot=0;const nextSpot=()=>({x:(spot+=10),y:64,z:0}); // a fresh spot per test, so block records never collide

test('batchSets counts the set in the mortar and the full sets on hand, capped at four',async()=>{
 const {batchSets,BATCH_MAX}=await script('data/powders.js');
 const set=[kh('goji_powder'),kh('chrysanthemum_powder')];
 assert.equal(BATCH_MAX,4);
 assert.equal(batchSets(set,new Map()),1);
 assert.equal(batchSets(set,new Map([[kh('goji_powder'),5],[kh('chrysanthemum_powder'),2]])),3);
 assert.equal(batchSets(set,new Map([[kh('goji_powder'),40],[kh('chrysanthemum_powder'),40]])),4);
 const pill=[kh('ming_mu_powder'),kh('ming_mu_powder'),'minecraft:honey_bottle'];
 assert.equal(batchSets(pill,new Map([[kh('ming_mu_powder'),3],['minecraft:honey_bottle',5]])),2); // two doses per set
});
test('mortar: sneak-using a full mortar with one of its powders pounds every set on hand, 4 ticks apart',async()=>{
 const w=makeWorld(),{mortar}=await script('custom_components/mortar.js'),{getRecord}=await script('utils/blockStore.js');
 const block=w.put(kh('mortar'),nextSpot()),use=()=>mortar.onPlayerInteract({block,player:w.player});
 w.hold(kh('goji_powder'));use();w.hold(kh('chrysanthemum_powder'),4);use();
 assert.deepEqual(getRecord(block).powders,[kh('goji_powder'),kh('chrysanthemum_powder')]);
 w.hold(kh('goji_powder'),3,5); // three more goji and three more chrysanthemum on hand: four sets in all
 const start=system.currentTick;w.player.isSneaking=true;use();w.player.isSneaking=false;
 assert.equal(getRecord(block),undefined);assert.equal(w.count(kh('goji_powder')),0);assert.equal(w.count(kh('chrysanthemum_powder')),0);
 step(80);
 const knocks=w.sounds.filter(s=>s.sound==='dig.stone').map(s=>s.tick-start);
 assert.equal(knocks.length,12); // three strokes per set
 assert.ok(knocks.every((t,i)=>i===0||t-knocks[i-1]===4),String(knocks));
 assert.deepEqual(w.spawned,[{id:kh('ming_mu_powder'),n:8}]); // two doses per set
});
test('mortar: a sneak batch with nothing extra on hand still finishes the set; other powders go in as before',async()=>{
 const w=makeWorld(),{mortar}=await script('custom_components/mortar.js'),{getRecord}=await script('utils/blockStore.js');
 const block=w.put(kh('mortar'),nextSpot()),use=()=>mortar.onPlayerInteract({block,player:w.player});
 w.hold(kh('goji_powder'));use();
 w.player.isSneaking=true;w.hold(kh('chrysanthemum_powder'),2);use(); // not yet complete: just goes in
 assert.equal(getRecord(block).powders.length,2);assert.equal(w.count(kh('chrysanthemum_powder')),1);
 w.player.isSneaking=false;w.hold(undefined);use(); // one ordinary stroke first
 w.player.isSneaking=true;w.hold(kh('licorice_powder'));use(); // a powder not in the mortar is added, not batched
 assert.equal(getRecord(block).powders.length,3);
 w.player.isSneaking=false;w.hold(undefined);w.player.isSneaking=true;use();w.player.isSneaking=false; // sneak empty hand takes it back
 assert.equal(getRecord(block).powders.length,2);
 w.sounds.length=0;w.hold(kh('goji_powder'));w.player.isSneaking=true;use();w.player.isSneaking=false;
 assert.equal(w.count(kh('goji_powder')),1,'the held powder only triggers the batch; no extra set was there');
 step(40);assert.equal(w.heard('dig.stone'),3);assert.deepEqual(w.spawned.at(-1),{id:kh('ming_mu_powder'),n:2});
});
test('mortar: a sneak batch of pill makings rolls every set and returns every bottle',async()=>{
 const w=makeWorld(),{mortar}=await script('custom_components/mortar.js');
 const block=w.put(kh('mortar'),nextSpot()),use=()=>mortar.onPlayerInteract({block,player:w.player});
 w.hold(kh('ming_mu_powder'),2);use();use();w.hold(kh('ming_mu_powder'),2,3);w.hold('minecraft:honey_bottle',2);
 w.player.isSneaking=true;use();assert.equal(w.count('minecraft:honey_bottle'),1); // the honey went in normally
 use();w.player.isSneaking=false; // now the set is full: honey in hand, two doses and one honey on hand
 assert.equal(w.count('minecraft:honey_bottle'),0);assert.equal(w.count(kh('ming_mu_powder')),0);
 step(60);
 assert.equal(w.heard('dig.cloth'),6);
 assert.deepEqual(w.spawned,[{id:kh('ming_mu_pill'),n:8},{id:'minecraft:glass_bottle',n:2}]);
});
test('ginseng turns away bone meal and the wrong tool with the low note, and keeps the bone meal',async()=>{
 const w=makeWorld(),{ginsengCrop}=await script('custom_components/ginsengCrop.js');
 const young=w.put(kh('ginseng_crop'),nextSpot(),{[kh('growth')]:1}),use=b=>ginsengCrop.onPlayerInteract({block:b,player:w.player});
 w.hold('minecraft:bone_meal',5);use(young);
 assert.equal(w.count('minecraft:bone_meal'),5);assert.equal(young.permutation.getState(kh('growth')),1);assert.equal(w.heard('note.bass'),1);
 const ripe=w.put(kh('ginseng_crop'),nextSpot(),{[kh('growth')]:3});
 w.hold('minecraft:iron_shovel');use(ripe);w.hold(undefined);use(ripe);
 assert.equal(ripe.typeId,kh('ginseng_crop'));assert.equal(w.heard('note.bass'),3);assert.deepEqual(w.spawned,[]);
 w.hold('minecraft:dirt');use(young);assert.equal(w.heard('note.bass'),3); // a young plant and some other item: nothing tried
});
test('ginseng: sneaking with the trowel digs every ripe root in the 3x3, one wear each',async()=>{
 const w=makeWorld(),{ginsengCrop}=await script('custom_components/ginsengCrop.js');
 const c=nextSpot(),at=(dx,dz)=>({x:c.x+dx,y:c.y,z:c.z+dz});
 const roots=[[0,0],[1,0],[-1,1],[0,-1]].map(([x,z])=>w.put(kh('ginseng_crop'),at(x,z),{[kh('growth')]:3}));
 const young=w.put(kh('ginseng_crop'),at(1,1),{[kh('growth')]:2}),far=w.put(kh('ginseng_crop'),at(2,0),{[kh('growth')]:3});
 const trowel=w.tool(kh('herbal_trowel'));w.player.isSneaking=true;
 ginsengCrop.onPlayerInteract({block:roots[0],player:w.player});w.player.isSneaking=false;
 assert.ok(roots.every(b=>b.typeId==='minecraft:air'));assert.equal(young.typeId,kh('ginseng_crop'));assert.equal(far.typeId,kh('ginseng_crop'));
 assert.equal(trowel.durability.damage,4);assert.equal(w.spawned.filter(s=>s.id===kh('fresh_ginseng')).length,4);
});
test('field herbs: sneak with the trowel or a hoe harvests every ripe herb of that kind in the 3x3',async()=>{
 const w=makeWorld(),{cropGrowth,isAreaTool}=await script('custom_components/cropGrowth.js');
 for(const item of [kh('herbal_trowel'),'minecraft:wooden_hoe','minecraft:netherite_hoe','other_pack:bronze_hoe'])assert.ok(isAreaTool(item),item);
 for(const item of ['other_pack:horseshoe','minecraft:iron_shovel','',undefined])assert.ok(!isAreaTool(item),String(item));
 const c=nextSpot(),at=(dx,dz)=>({x:c.x+dx,y:c.y,z:c.z+dz}),plots=[];
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)plots.push(w.put(kh('angelica_crop'),at(dx,dz),{[kh('growth')]:2}));
 const young=w.put(kh('angelica_crop'),at(1,1),{[kh('growth')]:1}),goji=w.put(kh('goji_crop'),at(-1,-1),{[kh('growth')]:2});
 const centre=w.grid.get(`${c.x},${c.y},${c.z}`),growth=b=>b.permutation.getState(kh('growth'));
 const hoe=w.tool('minecraft:iron_hoe');w.player.isSneaking=true;cropGrowth.onPlayerInteract({block:centre,player:w.player});w.player.isSneaking=false;
 assert.equal(w.spawned.filter(s=>s.id===kh('fresh_angelica')).length,7);assert.equal(hoe.durability.damage,1);
 assert.equal(growth(young),1);assert.equal(growth(goji),2);
 assert.equal([...w.grid.values()].filter(b=>b.typeId===kh('angelica_crop')&&growth(b)===0).length,7); // replanted at age 0
 // Without sneaking, or sneaking bare-handed, one plant as before.
 for(const b of w.grid.values())if(b.typeId===kh('angelica_crop'))b.setPermutation(b.permutation.withState(kh('growth'),2));
 w.spawned.length=0;cropGrowth.onPlayerInteract({block:centre,player:w.player});
 w.hold(undefined);w.player.isSneaking=true;cropGrowth.onPlayerInteract({block:w.grid.get(`${c.x+1},${c.y},${c.z}`),player:w.player});w.player.isSneaking=false;
 assert.equal(w.spawned.filter(s=>s.id===kh('fresh_angelica')).length,2);
});
test('stations that used to ignore a clear attempt now refuse with a sound',async()=>{
 const w=makeWorld();
 const {herbalWine}=await script('custom_components/herbalWine.js'),{decorStack}=await script('custom_components/decorStack.js');
 const {clayPot}=await script('custom_components/clayPot.js'),{incenseBurner}=await script('custom_components/incenseBurner.js');
 const {herbCabinet}=await script('custom_components/herbCabinet.js'),{HERBAL_WINES}=await script('data/tavernRecipes.js');
 const wine=kh(HERBAL_WINES[0].key),rack=w.put(wine,nextSpot(),{[kh('bottle_count')]:4});
 w.hold(wine);herbalWine.onPlayerInteract({block:rack,player:w.player});assert.equal(w.heard('random.click'),1);assert.equal(w.count(wine),1);
 const jars=w.put(kh('medicine_jar'),nextSpot(),{[kh('jar_count')]:3});
 w.hold(kh('medicine_jar'));decorStack.onPlayerInteract({block:jars,player:w.player});assert.equal(w.heard('random.click'),2);
 const pot=w.put(kh('clay_pot'),nextSpot(),{});
 w.hold(kh('ginseng_slices'));clayPot.onPlayerInteract({block:pot,player:w.player});assert.equal(w.heard('random.fizz'),1);assert.equal(w.count(kh('ginseng_slices')),1);
 w.hold('minecraft:bowl');clayPot.onPlayerInteract({block:pot,player:w.player});assert.equal(w.heard('random.fizz'),2);
 const burner=w.put(kh('incense_burner'),nextSpot(),{});
 w.hold('minecraft:flint_and_steel');incenseBurner.onPlayerInteract({block:burner,player:w.player});assert.equal(w.heard('random.fizz'),3);
 const cabinet=w.put(kh('herb_cabinet'),nextSpot(),{'minecraft:cardinal_direction':'north'});
 w.hold(undefined);herbCabinet.onPlayerInteract({block:cabinet,player:w.player,face:'North'});assert.equal(w.heard('random.fizz'),4);
});
test('clay pot: sneak with bowls ladles out every serving left',async()=>{
 const w=makeWorld(),{clayPot}=await script('custom_components/clayPot.js'),{getRecord,saveRecord,newRecord}=await script('utils/blockStore.js');
 const pot=w.put(kh('clay_pot'),nextSpot(),{});
 saveRecord({...newRecord(pot,'clay_pot'),stage:3,servings:3,output:kh('ginseng_decoction'),ingredients:[]});
 w.hold('minecraft:bowl',5);w.player.isSneaking=true;clayPot.onPlayerInteract({block:pot,player:w.player});w.player.isSneaking=false;
 assert.deepEqual(w.spawned,Array(3).fill({id:kh('ginseng_decoction'),n:1}));assert.equal(w.count('minecraft:bowl'),2);assert.equal(getRecord(pot),undefined);
 saveRecord({...newRecord(pot,'clay_pot'),stage:3,servings:3,output:kh('ginseng_decoction'),ingredients:[]});
 w.spawned.length=0;w.hold('minecraft:bowl',2);w.player.isSneaking=true;clayPot.onPlayerInteract({block:pot,player:w.player});w.player.isSneaking=false;
 assert.equal(w.spawned.length,2);assert.equal(getRecord(pot).servings,1); // only as many as there are bowls
 w.hold('minecraft:bowl',5);clayPot.onPlayerInteract({block:pot,player:w.player});assert.equal(w.count('minecraft:bowl'),4); // one without sneaking
});
test('incense burner: sneak with incense fills the burner from the hand',async()=>{
 const w=makeWorld(),{incenseBurner,MAX_PORTIONS,portionsOf}=await script('custom_components/incenseBurner.js'),{getRecord}=await script('utils/blockStore.js');
 const burner=w.put(kh('incense_burner'),nextSpot(),{});
 w.hold(kh('mugwort_floss'),20);w.player.isSneaking=true;incenseBurner.onPlayerInteract({block:burner,player:w.player});w.player.isSneaking=false;
 assert.equal(portionsOf(getRecord(burner)),MAX_PORTIONS);assert.equal(w.count(kh('mugwort_floss')),20-MAX_PORTIONS);
 const other=w.put(kh('incense_burner'),nextSpot(),{});
 w.hold(kh('mugwort_floss'),3);incenseBurner.onPlayerInteract({block:other,player:w.player});
 assert.equal(portionsOf(getRecord(other)),1);assert.equal(w.count(kh('mugwort_floss')),2);
});
