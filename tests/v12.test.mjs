// 1.2.0 rules: honey pills, the environment and the body, poria cultivation, the herbalist, weekly themes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const bp=resolve(root,'Kaleidoscope Herbal [BP]');
// Every name the scripts import from the game exists here as an empty class; these tests use only pure rules.
const stub=`export const system={currentTick:0,runTimeout(){},run(){},runInterval(){return 1;},clearRun(){}};
export const world={getDynamicProperty(){},setDynamicProperty(){},beforeEvents:{playerInteractWithBlock:{subscribe(){}}}};
export const BlockPermutation={resolve(){}};export const BlockVolume=class{};export const EntityInitializationCause=class{};export const EquipmentSlot=class{};export const ItemStack=class{};export const ItemTypes=class{};export const MolangVariableMap=class{};export const WeatherType=class{};export const GameMode={Survival:'Survival',Adventure:'Adventure',Creative:'Creative'};`;
register('data:text/javascript,'+encodeURIComponent(`
export async function resolve(s,c,n){return s==='@minecraft/server'?{url:'v12-stub:server',shortCircuit:true}:n(s,c);}
export async function load(u,c,n){return u==='v12-stub:server'?{format:'module',source:${JSON.stringify(stub)},shortCircuit:true}:n(u,c);}`));
const load=path=>import(pathToFileURL(resolve(bp,'scripts',path)).href);
const kh=n=>'kaleidoscope_herbal:'+n;
const P=await load('data/pills.js');
const {POWDER_FORMULAS,STRANGE,POWDER_ITEMS}=await load('data/powders.js');
const C=await load('data/constitution.js');
const herb=i=>POWDER_ITEMS.has(i);

test('pills: two doses of one powder and a honey bottle; nothing else mixes in',()=>{
 const m=kh('ming_mu_powder'),q=kh('qing_re_powder');
 assert.equal(P.pillAccepts([],m,herb),'ok');
 assert.equal(P.pillAccepts([m],m,herb),'ok');
 assert.equal(P.pillAccepts([m,m],m,herb),'full');
 assert.equal(P.pillAccepts([m],q,herb),'wrong');                       // one kind only
 assert.equal(P.pillAccepts([m,m],P.HONEY,herb),'ok');
 assert.equal(P.pillAccepts([m,P.HONEY],P.HONEY,herb),'full');           // one bottle
 assert.equal(P.pillAccepts([kh('goji_powder')],m,herb),'wrong');       // not with herb powders
 assert.equal(P.pillAccepts([m],kh('goji_powder'),herb),'wrong');       // and the other way round
 assert.equal(P.pillAccepts([kh('goji_powder')],kh('chrysanthemum_powder'),herb),'ok');
 assert.equal(P.isMedicine(STRANGE),false);
 assert.equal(P.pillReady([m,P.HONEY,m]),m);
 assert.equal(P.pillReady([m,m]),undefined);assert.equal(P.pillReady([m,P.HONEY]),undefined);
});
test('pills: each powder rolls into its own pill, and every pill is an item',()=>{
 const items=new Set(readdirSync(join(bp,'items/powders')).map(f=>'kaleidoscope_herbal:'+f.replace(/\.json$/,'')));
 assert.equal(P.PILLS.size,POWDER_FORMULAS.length);
 for(const f of POWDER_FORMULAS){const pill=P.pillFor(f.result);assert.ok(items.has(pill),pill);assert.equal(P.powderOf(pill),f.result);assert.ok(P.isPill(pill));}
 assert.equal(P.pillFor(STRANGE),undefined);assert.equal(P.isPill(kh('ming_mu_powder')),false);
});
test('pills: same effects 1.5x as long, half the heat, for every powder',()=>{
 for(const f of POWDER_FORMULAS){
  const p=P.pillEffects(f.result);assert.ok(p,f.result);
  assert.deepEqual(p.effects.map(e=>[e.name,e.amplifier]),f.effects.map(e=>[e.name,e.amplifier]));
  p.effects.forEach((e,i)=>assert.equal(e.ticks,Math.round(f.effects[i].ticks*1.5)));
  assert.equal(p.heat,Math.trunc((f.heat??0)*.5));
 }
 assert.equal(P.pillEffects(STRANGE),undefined);assert.equal(P.pillEffects(undefined),undefined);
});
test('environment: cold and heat push the body, a fire cancels them, the Nether always heats',()=>{
 assert.deepEqual(C.envStep(0,{cold:true}),{push:C.ENV_COLD});
 assert.deepEqual(C.envStep(0,{hot:true}),{push:C.ENV_HOT});
 assert.deepEqual(C.envStep(30,{nether:true,nearFire:true}),{push:C.ENV_NETHER});
 assert.deepEqual(C.envStep(-30,{cold:true,nearFire:true}),{next:-25});   // by the fire the body settles as usual
 assert.deepEqual(C.envStep(12,{}),{next:7});
 assert.deepEqual(C.envStep(3,{}),{next:0});
 // From balance to the shiver at -60 in the snow takes 30 passes of 5 s, about two and a half minutes;
 // to a full chill at -100, about four minutes.
 let heat=0,passes=0;while(heat>-100){heat+=C.ENV_COLD;passes++;}assert.equal(passes*5,250);
});
test('diet week halves bowls before the Nether doubles them',()=>{
 assert.equal(C.heatDelta(kh('ginseng_decoction')),40);
 assert.equal(C.heatDelta(kh('ginseng_decoction'),false,.5),20);
 assert.equal(C.heatDelta(kh('ginseng_decoction'),true,.5),40);
 assert.equal(C.heatDelta(kh('honeysuckle_tea'),true,1),-35);
});
test('weekly themes: diet and tea only while their week runs',async()=>{
 const W=await load('utils/senluoWeek.js');
 const until=Date.now()/1000+3600;
 assert.equal(W.dietFactor(),1);assert.equal(W.teaFactor(),1);
 W.onWeek({theme:'diet',phase:'start',until});assert.equal(W.dietFactor(),.5);assert.equal(W.teaFactor(),1);
 W.onWeek({theme:'tea',phase:'start',until});assert.equal(W.teaFactor(),1.5);assert.equal(W.dietFactor(),1);
 W.onWeek({theme:'tea',phase:'end'});assert.equal(W.teaFactor(),1);
});
test('poria culture: grows on soil around the log, stops at the limit',async()=>{
 const R=await load('custom_components/poriaSpawn.js');
 const log={x:0,y:64,z:0},world=new Map();
 for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++){world.set(`${x},63,${z}`,'minecraft:podzol');world.set(`${x},64,${z}`,'minecraft:air');}
 world.set('0,64,0','minecraft:spruce_log');world.set('2,64,0','minecraft:stone');
 const look=p=>world.get(`${p.x},${p.y},${p.z}`);
 let r=R.poriaSpots(look,log);
 assert.equal(r.grown,0);assert.ok(r.spots.length>40);
 assert.ok(r.spots.every(p=>Math.abs(p.x)<=4&&Math.abs(p.z)<=4&&look(p)==='minecraft:air'));
 assert.ok(!r.spots.some(p=>p.x===2&&p.z===0)&&!r.spots.some(p=>p.x===0&&p.z===0));
 for(const x of [1,-1,3])world.set(`${x},64,1`,kh('wild_poria'));
 r=R.poriaSpots(look,log);assert.equal(r.grown,R.PORIA_MAX);
});
test('herbalist: huts are listed once and capped; he keeps to daylight',async()=>{
 const H=await load('utils/herbalist.js');
 const map=new Map(),hut={d:'minecraft:overworld',x:1,y:2,z:3};
 assert.equal(H.addHut(map,hut),true);assert.equal(H.addHut(map,{...hut}),false);
 assert.equal(H.addHut(map,{...hut,x:9},1),false);
 assert.ok(H.isDay(0)&&H.isDay(11999)&&!H.isDay(12000)&&!H.isDay(18000));
});
test('herbalist trades only in items that exist, and the huts carry their marker',()=>{
 const ids=new Set(['minecraft:emerald']);
 const walk=d=>{for(const f of readdirSync(d,{withFileTypes:true})){const p=join(d,f.name);if(f.isDirectory())walk(p);else if(p.endsWith('.json')){const j=JSON.parse(readFileSync(p,'utf8'));const i=j['minecraft:item']??j['minecraft:block'];if(i)ids.add(i.description.identifier);}}};
 walk(join(bp,'items'));walk(join(bp,'blocks'));
 const table=JSON.parse(readFileSync(join(bp,'trading/kaleidoscope_herbal/herbalist.json'),'utf8'));
 const trades=table.tiers.flatMap(t=>t.groups.flatMap(g=>g.trades));
 assert.ok(trades.length>=20);
 for(const t of trades)for(const s of [...t.wants,...t.gives])assert.ok(ids.has(s.item),s.item);
 for(const g of table.tiers[0].groups)assert.ok(g.num_to_select<=g.trades.length);
 for(const f of ['herb_hut_forest','herb_hut_taiga'])
  assert.ok(readFileSync(join(bp,'structures/kaleidoscope_herbal',f+'.mcstructure')).includes('kaleidoscope_herbal:hut_marker'),f);
});
