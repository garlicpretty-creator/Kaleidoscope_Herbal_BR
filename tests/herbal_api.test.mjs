// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const {createHerbalHost,EVENTS,CAPABILITIES,LIMITS,packItems}=await load('Kaleidoscope Herbal [BP]/scripts/api/herbalHostCore.js');
const {EXTERNAL_HEAT,heatDelta,stepHeat,HEAT_VALUES}=await load('Kaleidoscope Herbal [BP]/scripts/data/constitution.js');
const {connectHerbal,HERBAL_EVENTS}=await load('sdk/herbal-client.js');

// A stand-in for @minecraft/server's `system`: script events reach every subscriber, timers run on step().
function fakeSystem(){
 const subs=[],timers=new Map();let tick=0,next=1;
 const system={
  get currentTick(){return tick;},
  sendScriptEvent(id,message){assert.ok(message.length<=2048,'message over 2048: '+id);for(const s of [...subs])if(s.ns.includes(id.split(':')[0]))s.fn({id,message,sourceType:'Server'});},
  afterEvents:{scriptEventReceive:{subscribe(fn,{namespaces}){subs.push({fn,ns:namespaces});},unsubscribe(fn){const i=subs.findIndex(s=>s.fn===fn);if(i>=0)subs.splice(i,1);}}},
  run(fn){return system.runTimeout(fn,0);},
  runTimeout(fn,ticks){const h=next++;timers.set(h,{fn,at:tick+ticks});return h;},
  clearRun(h){timers.delete(h);},
 };
 const step=(n=1)=>{for(let i=0;i<n;i++){for(const [h,t] of [...timers])if(t.at<=tick){timers.delete(h);t.fn();}tick++;}};
 return {system,step,subs};
}
function world(){
 EXTERNAL_HEAT.clear();
 const f=fakeSystem(),heat=new Map([['p1',0]]),sent=[];
 const host=createHerbalHost({
  send:(id,message)=>{sent.push({id,m:JSON.parse(message)});f.system.sendScriptEvent(id,message);},now:()=>f.system.currentTick,version:'1.1.0',
  catalogs:{herbs:()=>Array.from({length:40},(_,i)=>({key:'herb'+i,fresh:'kaleidoscope_herbal:fresh_herb_number_'+i,dry:'kaleidoscope_herbal:dried_herb_number_'+i}))},
  externalHeat:EXTERNAL_HEAT,ownsItem:id=>id.startsWith('kaleidoscope_herbal:'),
  getPlayer:id=>heat.has(id)?id:undefined,getHeat:p=>heat.get(p),
  shiftHeat:(p,delta)=>{const r=stepHeat(heat.get(p),delta);heat.set(p,r.heat);return r;},
 });
 f.system.afterEvents.scriptEventReceive.subscribe(ev=>host.handle(ev.id,ev.message,ev.sourceType),{namespaces:['kaleidoscope_herbal']});
 const call=(id,body,sourceType)=>{sent.length=0;host.handle(id,typeof body==='string'?body:JSON.stringify({api:1,source:'other_pack',...body}),sourceType);return sent.map(s=>s.m);};
 return {...f,host,heat,sent,call};
}

test('ping answers with version, capabilities and limits',()=>{
 const w=world();const [ready]=w.call(EVENTS.ping,'anything');
 assert.equal(ready.api,1);assert.equal(ready.source,'kaleidoscope_herbal');assert.equal(ready.version,'1.1.0');
 assert.deepEqual(ready.capabilities,[...CAPABILITIES]);assert.equal(ready.limits.itemsPerMessage,LIMITS.itemsPerMessage);
});
test('events typed by players or command blocks are ignored',()=>{
 const w=world();
 assert.deepEqual(w.call(EVENTS.ping,'x','Entity'),[]);
 assert.deepEqual(w.call(EVENTS.heatAdd,{p:'p1',delta:50},'Block'),[]);assert.equal(w.heat.get('p1'),0);
});
test('malformed or wrong-api requests get no answer',()=>{
 const w=world();
 assert.deepEqual(w.call(EVENTS.heatRequest,'{not json'),[]);
 assert.deepEqual(w.call(EVENTS.heatRequest,JSON.stringify({api:2,source:'other_pack',p:'p1'})),[]);
 assert.deepEqual(w.call(EVENTS.heatRequest,JSON.stringify({api:1,source:'Bad Source',p:'p1'})),[]);
 assert.deepEqual(w.call(EVENTS.heatRequest,JSON.stringify({api:1,source:'kaleidoscope_herbal',p:'p1'})),[]);
});
test('catalog is chunked under the packet limit and unknown kinds are named',()=>{
 const w=world();const parts=w.call(EVENTS.catalogRequest,{kind:'herbs',req:7});
 assert.ok(parts.length>1);assert.ok(parts.every(p=>p.to==='other_pack'&&p.req==='7'&&p.parts===parts.length&&JSON.stringify(p).length<=LIMITS.packetBytes));
 assert.equal(parts.flatMap(p=>p.items).length,40);
 const [bad]=w.call(EVENTS.catalogRequest,{kind:'nope'});assert.equal(bad.ok,false);assert.equal(bad.code,'UNKNOWN_KIND');assert.deepEqual(bad.kinds,['herbs']);
 assert.deepEqual(packItems([],160),[[]]);
});
test('heat_register validates, keeps the first owner, and feeds heatDelta',()=>{
 const w=world();
 const [ack]=w.call(EVENTS.heatRegister,{items:[{id:'other_pack:iced_tea',heat:-30},{id:'kaleidoscope_herbal:ginseng_wine',heat:5},{id:'minecraft:apple',heat:5},{id:'nocolon',heat:5},{id:'other_pack:x',heat:1000},{id:'other_pack:y',heat:1.5}]});
 assert.equal(ack.accepted,1);assert.equal(ack.ok,false);
 assert.deepEqual(ack.rejected.map(r=>r.code),['RESERVED','RESERVED','BAD_ID','BAD_HEAT','BAD_HEAT']);
 assert.equal(heatDelta('other_pack:iced_tea'),-30);
 assert.equal(heatDelta('other_pack:iced_tea',true),-30); // cooling keeps its strength in the Nether
 assert.equal(heatDelta('kaleidoscope_herbal:ginseng_wine'),HEAT_VALUES.get('kaleidoscope_herbal:ginseng_wine'));
 const [taken]=w.call(EVENTS.heatRegister,JSON.stringify({api:1,source:'third_pack',items:[{id:'other_pack:iced_tea',heat:40}]}));
 assert.equal(taken.rejected[0].code,'TAKEN');assert.equal(heatDelta('other_pack:iced_tea'),-30);
 const [again]=w.call(EVENTS.heatRegister,{items:[{id:'other_pack:iced_tea',heat:-20}]});assert.equal(again.ok,true);assert.equal(heatDelta('other_pack:iced_tea'),-20);
 w.call(EVENTS.heatRegister,{items:[{id:'other_pack:iced_tea',heat:0}]});assert.equal(EXTERNAL_HEAT.size,0);
});
test('heat_register stops at the table limit and refuses oversized batches',()=>{
 const w=world();
 for(let b=0;b<LIMITS.externalHeat/LIMITS.itemsPerMessage;b++)w.call(EVENTS.heatRegister,{items:Array.from({length:LIMITS.itemsPerMessage},(_,i)=>({id:`other_pack:f${b}_${i}`,heat:1}))});
 assert.equal(EXTERNAL_HEAT.size,LIMITS.externalHeat);
 const [full]=w.call(EVENTS.heatRegister,{items:[{id:'other_pack:one_more',heat:1}]});assert.equal(full.rejected[0].code,'FULL');
 const [big]=w.call(EVENTS.heatRegister,{items:Array.from({length:LIMITS.itemsPerMessage+1},(_,i)=>({id:'other_pack:z'+i,heat:1}))});assert.equal(big.code,'BAD_ITEMS');
});
test('heat_request reads, heat_add clamps, throttles and reports a crossed limit',()=>{
 const w=world();
 assert.deepEqual(w.call(EVENTS.heatRequest,{p:'p1',req:'a'})[0],{api:1,to:'other_pack',req:'a',p:'p1',ok:true,heat:0});
 assert.equal(w.call(EVENTS.heatRequest,{p:'ghost'})[0].code,'NO_PLAYER');
 assert.equal(w.call(EVENTS.heatAdd,{p:'p1',delta:'5'})[0].code,'BAD_DELTA');
 const [first]=w.call(EVENTS.heatAdd,{p:'p1',delta:999});assert.equal(first.applied,LIMITS.heatAddMax);assert.equal(first.heat,50);
 assert.equal(w.call(EVENTS.heatAdd,{p:'p1',delta:10})[0].code,'THROTTLED');assert.equal(w.heat.get('p1'),50);
 w.step(LIMITS.heatAddCooldown);
 const [second]=w.call(EVENTS.heatAdd,{p:'p1',delta:50});assert.equal(second.effect,'overheat');assert.equal(second.heat,60);
});
test('SDK: handshake, heat registration, queries, events, and silence without Herbal',async()=>{
 const w=world();const events=[],readies=[];
 const items=Array.from({length:40},(_,i)=>({id:'my_pack:drink_'+i,heat:i%2?10:-10}));
 const client=connectHerbal(w.system,{source:'my_pack',heat:[...items,{id:'minecraft:apple',heat:1}],onReady:i=>readies.push(i),onEvent:e=>events.push(e),log:()=>{}});
 assert.equal(client.ready,false);w.step();
 assert.equal(client.ready,true);assert.equal(client.host.version,'1.1.0');assert.ok(client.has('external_heat'));
 assert.equal(EXTERNAL_HEAT.size,40);assert.deepEqual(client.rejected,[{id:'minecraft:apple',code:'RESERVED'}]);
 w.host.announce();assert.equal(EXTERNAL_HEAT.size,40);assert.equal(readies.length,2); // a replayed ready is harmless
 assert.equal((await client.requestCatalog('herbs')).length,40);
 assert.equal(await client.requestCatalog('nope'),undefined);
 assert.deepEqual(await client.requestHeat('p1'),{heat:0,applied:undefined,effect:undefined});
 assert.equal((await client.addHeat('p1',-20)).heat,-20);
 assert.equal((await client.requestHeat('ghost')).error,'NO_PLAYER');
 w.system.sendScriptEvent(HERBAL_EVENTS.evt,JSON.stringify({v:1,t:'decoction_served',p:'p1',id:'kaleidoscope_herbal:ginseng_decoction'}));
 assert.equal(events[0].t,'decoction_served');
 client.dispose();assert.equal(w.subs.length,1);
 // No host: nothing answers, requests resolve to undefined at once.
 const lone=fakeSystem(),alone=connectHerbal(lone.system,{source:'my_pack',log:()=>{}});lone.step(5);
 assert.equal(alone.ready,false);assert.equal(await alone.requestHeat('p1'),undefined);
 assert.throws(()=>connectHerbal(lone.system,{source:'Bad Name'}));
});
test('SDK: a request the host never answers times out to undefined',async()=>{
 const w=world();const client=connectHerbal(w.system,{source:'my_pack',log:()=>{},timeoutTicks:10});w.step();
 w.subs.splice(0,1); // the host goes away
 const pending=client.requestHeat('p1');w.step(12);assert.equal(await pending,undefined);
});
