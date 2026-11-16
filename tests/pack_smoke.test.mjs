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
export class BlockVolume{constructor(from,to){this.from=from;this.to=to;}}
export const BlockPermutation=any(),EntityInitializationCause={Spawned:'Spawned',Loaded:'Loaded'};
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
 assert.ok(names.includes('kaleidoscope_herbal:clay_pot'));assert.equal(new Set(names).size,names.length);
 const ready=system.sent.find(e=>e.id==='kaleidoscope_herbal:api_ready');
 assert.ok(ready,'api_ready is broadcast at start');
 const {VERSION}=await import(pathToFileURL(resolve(bp,'scripts/data/version.js')).href);
 assert.equal(JSON.parse(ready.message).version,VERSION);
 // The real catalogs fit the 2048-character script event limit.
 const host=system.subs.find(s=>s.options?.namespaces?.[0]==='kaleidoscope_herbal'&&s.fn.toString().includes('host.handle'));
 for(const kind of ['herbs','foods']){
  system.sent.length=0;
  host.fn({id:'kaleidoscope_herbal:catalog_request',message:JSON.stringify({api:1,source:'test_pack',kind}),sourceType:'Server'});
  const parts=system.sent.map(e=>(assert.ok(e.message.length<=2048),JSON.parse(e.message)));
  assert.ok(parts.length>=1&&parts.every(p=>p.ok&&p.kind===kind));
  assert.ok(parts.flatMap(p=>p.items).length>=11,kind);
 }
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
