// Run: node --test tests/
// The optional handshakes with Ranching and Fishing Voyage (scripts/api/familyBridge.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const bp=resolve(root,'Kaleidoscope Herbal [BP]');
const {startFamilyBridge,familyMessages,RANCHING_REMEDIES,FISHING_POND_FEEDS}=await import(pathToFileURL(resolve(bp,'scripts/api/familyBridge.js')).href);

// Script events reach every subscriber of their namespace; timers run on step().
function fakeSystem(){
 const subs=[],timers=[],sent=[];let tick=0;
 const system={
  sendScriptEvent(id,message){assert.ok(message.length<=2048,'message over 2048: '+id);sent.push({id,message});for(const s of [...subs])if(s.ns.includes(id.split(':')[0]))s.fn({id,message,sourceType:'Server'});},
  afterEvents:{scriptEventReceive:{subscribe(fn,{namespaces}){subs.push({fn,ns:namespaces});}}},
  runTimeout(fn,ticks){timers.push({fn,at:tick+ticks});},
 };
 const step=(n=1)=>{for(let i=0;i<n;i++){tick++;for(const t of timers.filter(t=>t.at<=tick)){timers.splice(timers.indexOf(t),1);t.fn();}}};
 return {system,step,sent};
}
function bridge(){
 const f=fakeSystem(),logs=[];
 const b=startFamilyBridge(f.system,{log:text=>logs.push(text)});
 const fire=(id,body)=>f.system.sendScriptEvent(id,typeof body==='string'?body:JSON.stringify(body));
 const of=id=>f.sent.filter(e=>e.id===id).map(e=>JSON.parse(e.message));
 return {...f,b,logs,fire,of};
}
const itemFile=id=>readdirSync(resolve(bp,'items'),{recursive:true}).some(p=>p.endsWith(id.split(':')[1]+'.json'));

test('pings Ranching and Fishing a second after load, and registers nothing before they answer',()=>{
 const w=bridge();
 assert.equal(w.sent.length,0,'nothing on the first tick');
 w.step(20);
 assert.deepEqual(w.sent.map(e=>[e.id,e.message]),[['kaleidoscope_ranching:api_ping','kaleidoscope_herbal'],['kaleidoscope_fishing:api_ping','kaleidoscope_herbal']]);
});

test('Ranching: honeysuckle powder becomes a remedy only with the remedy capability, again on every api_ready',()=>{
 const w=bridge();
 w.fire('kaleidoscope_ranching:api_ready',{api:1,version:'1.0.0',capabilities:['register_feed']});
 w.fire('kaleidoscope_ranching:api_ready',{api:2,capabilities:['remedy']});
 w.fire('kaleidoscope_ranching:api_ready','{broken');
 assert.equal(w.of('kaleidoscope_ranching:register_remedy').length,0,'nothing without remedy, for api 2 or for broken JSON');
 w.fire('kaleidoscope_ranching:api_ready',{api:1,version:'1.1.0',capabilities:['register_feed','remedy']});
 assert.deepEqual(w.of('kaleidoscope_ranching:register_remedy'),RANCHING_REMEDIES.map(item=>({item})));
 assert.equal(w.b.info('kaleidoscope_ranching').version,'1.1.0','remembered');
 w.fire('kaleidoscope_ranching:api_ready',{api:1,capabilities:['remedy']});
 assert.equal(w.of('kaleidoscope_ranching:register_remedy').length,2*RANCHING_REMEDIES.length,'sent again');
});

test('Ranching: only our own refusals are logged, once each',()=>{
 const w=bridge();
 w.fire('kaleidoscope_ranching:api_result',{event:'register_remedy',id:'other_pack:tonic',ok:false,error:'nope'});
 w.fire('kaleidoscope_ranching:api_result',{event:'register_remedy',id:'kaleidoscope_herbal:honeysuckle_powder',ok:true});
 w.fire('kaleidoscope_ranching:api_result',{event:'register_remedy',id:'kaleidoscope_herbal:honeysuckle_powder',ok:false,error:'remedy limit reached'});
 w.fire('kaleidoscope_ranching:api_result',{event:'register_remedy',id:'kaleidoscope_herbal:honeysuckle_powder',ok:false,error:'remedy limit reached'});
 assert.equal(w.logs.length,1);
 assert.match(w.logs[0],/honeysuckle_powder.*remedy limit reached/);
});

test('Fishing: the dregs become pond feed only with pond_feed (1.5.0); 1.4.0 gets nothing',()=>{
 const w=bridge();
 w.fire('kaleidoscope_fishing:api_ready',{api:1,source:'kaleidoscope_fishing',version:'1.4.0',capabilities:['bait','catch']});
 assert.equal(w.of('kaleidoscope_fishing:register_pond_feed').length,0);
 w.fire('kaleidoscope_fishing:api_ready',{api:1,source:'kaleidoscope_fishing',version:'1.5.0',capabilities:['bait','catch','pond_feed']});
 const [m]=w.of('kaleidoscope_fishing:register_pond_feed');
 assert.equal(m.api,1);assert.equal(m.source,'kaleidoscope_herbal');
 assert.deepEqual(m.feeds,[...FISHING_POND_FEEDS]);
 for(const f of m.feeds)assert.ok(Number.isInteger(f.meals)&&f.meals>=1&&f.meals<=4,f.id+' meals 1–4');
});

test('everything offered is one of our own items that exists',()=>{
 const ids=[...RANCHING_REMEDIES,...FISHING_POND_FEEDS.map(f=>f.id)];
 for(const id of ids){assert.ok(id.startsWith('kaleidoscope_herbal:'),id+' is ours');assert.ok(itemFile(id),id+' has an item file');}
 assert.deepEqual(familyMessages('kaleidoscope_tavern',{api:1,capabilities:['remedy','pond_feed']}),[],'nobody else');
});
