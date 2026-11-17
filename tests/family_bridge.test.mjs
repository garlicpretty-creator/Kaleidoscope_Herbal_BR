// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {createFamilyBridge,RANCHING_REMEDIES,RANCHING_FEEDS}=await import(pathToFileURL(resolve(root,'Kaleidoscope Herbal [BP]/scripts/api/familyBridgeCore.js')).href);

function bridge(){
 const sent=[],skies=[],logs=[];
 const b=createFamilyBridge({send:(id,message)=>{assert.ok(message.length<=2048);sent.push({id,m:JSON.parse(message.startsWith('{')?message:JSON.stringify(message))});},
  onSky:m=>{skies.push(m);return true;},log:t=>logs.push(t)});
 const fire=(id,body,sourceType='Server')=>b.handle(id,typeof body==='string'?body:JSON.stringify(body),sourceType);
 return {b,sent,skies,logs,fire};
}

test('ping goes to Ranching and Fishing',()=>{
 const w=bridge();w.b.ping();
 assert.deepEqual(w.sent.map(s=>s.id).sort(),['kaleidoscope_fishing:api_ping','kaleidoscope_ranching:api_ping']);
});
test('Ranching: remedy and feeds wait for their capabilities, and go again on every api_ready',()=>{
 const w=bridge();
 w.fire('kaleidoscope_ranching:api_ready',{api:1,capabilities:['register_animal']});
 w.fire('kaleidoscope_ranching:api_ready',{api:2,capabilities:['remedy','register_feed']});
 w.fire('kaleidoscope_ranching:api_ready',{api:1,capabilities:['remedy','register_feed']},'Entity');
 assert.equal(w.sent.length,0);
 w.fire('kaleidoscope_ranching:api_ready',{api:1,version:'1.1.0',capabilities:['register_feed','remedy']});
 const remedies=w.sent.filter(s=>s.id==='kaleidoscope_ranching:register_remedy').map(s=>s.m.item);
 const feeds=w.sent.filter(s=>s.id==='kaleidoscope_ranching:register_feed').map(s=>s.m);
 assert.deepEqual(remedies,RANCHING_REMEDIES);assert.deepEqual(feeds,RANCHING_FEEDS);
 w.fire('kaleidoscope_ranching:api_ready',{api:1,capabilities:['register_feed']});
 assert.equal(w.sent.filter(s=>s.id==='kaleidoscope_ranching:register_feed').length,2*RANCHING_FEEDS.length);
 assert.equal(w.sent.filter(s=>s.id==='kaleidoscope_ranching:register_remedy').length,RANCHING_REMEDIES.length,'remedy needs its capability');
});
test('Ranching: only our own refusals are logged, once each',()=>{
 const w=bridge();
 w.fire('kaleidoscope_ranching:api_result',{event:'register_feed',id:'other_pack:oats',ok:false,error:'x'});
 w.fire('kaleidoscope_ranching:api_result',{event:'register_feed',id:'kaleidoscope_herbal:bitter_dregs',ok:true});
 for(let i=0;i<2;i++)w.fire('kaleidoscope_ranching:api_result',{event:'register_remedy',id:'kaleidoscope_herbal:qing_re_powder',ok:false,error:'too many remedies'});
 w.fire('kaleidoscope_ranching:api_result','{broken');
 assert.equal(w.logs.length,1);assert.match(w.logs[0],/qing_re_powder: too many remedies/);
});
test('Fishing: meteor and aurora nights reach our crops like an AWW sky event',()=>{
 const w=bridge();
 const sky={v:1,t:'sky',kind:'meteor',phase:'start',dim:'overworld'};
 w.fire('kaleidoscope_fishing:evt',sky);
 assert.equal(w.skies.length,1,'before api_ready: trust the event');
 w.fire('kaleidoscope_fishing:api_ready',{api:1,capabilities:['bait','catch']});
 w.fire('kaleidoscope_fishing:evt',sky);
 assert.equal(w.skies.length,1,'a Fishing without "sky" is not listened to');
 w.fire('kaleidoscope_fishing:api_ready',{api:1,capabilities:['events','sky']});
 w.fire('kaleidoscope_fishing:evt',{...sky,phase:'end'});
 w.fire('kaleidoscope_fishing:evt',{v:1,t:'caught',id:'kaleidoscope_fishing:carp',p:'1'});
 w.fire('kaleidoscope_fishing:evt',{...sky,v:2});
 w.fire('kaleidoscope_fishing:evt',sky,'Entity');
 assert.deepEqual(w.skies.map(s=>s.phase),['start','end']);
 assert.equal(w.sent.length,0,'Fishing gets no registrations from us');
});
test('registered items exist in the behaviour pack',()=>{
 const files={qing_re_powder:'powders',bitter_dregs:'decoctions',burnt_dregs:'decoctions'};
 for(const item of [...RANCHING_REMEDIES,...RANCHING_FEEDS.map(f=>f.item)]){
  const name=item.split(':')[1];
  assert.ok(existsSync(resolve(root,'Kaleidoscope Herbal [BP]/items',files[name],name+'.json')),item);
 }
});
