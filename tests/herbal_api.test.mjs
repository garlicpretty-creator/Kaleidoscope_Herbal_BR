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
const D=await load('Kaleidoscope Herbal [BP]/scripts/data/decoctions.js');

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
 EXTERNAL_HEAT.clear();D.EXTERNAL_RECIPES.clear();D.EXTERNAL_ADJUVANTS.clear();
 const f=fakeSystem(),heat=new Map([['p1',0]]),sent=[];
 const host=createHerbalHost({
  send:(id,message)=>{sent.push({id,m:JSON.parse(message)});f.system.sendScriptEvent(id,message);},now:()=>f.system.currentTick,version:'1.1.0',
  externalRecipes:D.EXTERNAL_RECIPES,externalAdjuvants:D.EXTERNAL_ADJUVANTS,matchBuiltin:D.matchBuiltin,sameMix:D.sameMix,itemExists:id=>!id.includes('missing'),
  catalogs:{decoctions:D.decoctionCatalog,adjuvants:D.adjuvantCatalog,herbs:()=>Array.from({length:40},(_,i)=>({key:'herb'+i,fresh:'kaleidoscope_herbal:fresh_herb_number_'+i,dry:'kaleidoscope_herbal:dried_herb_number_'+i}))},
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
 assert.ok(parts.length>1);assert.ok(parts.every(p=>p.to==='other_pack'&&p.req===7&&p.parts===parts.length&&JSON.stringify(p).length<=LIMITS.packetBytes));
 assert.equal(parts.flatMap(p=>p.items).length,40);
 const [bad]=w.call(EVENTS.catalogRequest,{kind:'nope'});assert.equal(bad.ok,false);assert.equal(bad.code,'UNKNOWN_KIND');assert.deepEqual(bad.kinds,['decoctions','adjuvants','herbs']);
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
 // No host: nothing answers; a request waits for a ready that never comes and resolves to undefined after timeoutTicks.
 const lone=fakeSystem(),alone=connectHerbal(lone.system,{source:'my_pack',log:()=>{},timeoutTicks:10});lone.step(5);
 assert.equal(alone.ready,false);const unanswered=alone.requestHeat('p1');lone.step(12);assert.equal(await unanswered,undefined);
 assert.throws(()=>connectHerbal(lone.system,{source:'Bad Name'}));
});
test('SDK: a request the host never answers times out to undefined',async()=>{
 const w=world();const client=connectHerbal(w.system,{source:'my_pack',log:()=>{},timeoutTicks:10});w.step();
 w.subs.splice(0,1); // the host goes away
 const pending=client.requestHeat('p1');w.step(12);assert.equal(await pending,undefined);
});

// ---- v1.1.0 formulas: done or burnt only, every herb has a use
const {DECOCTIONS,FOOD_EFFECTS,ADJUVANTS,matchDecoction,advancePot,burnLimit}=D;
const {HERBS}=await load('Kaleidoscope Herbal [BP]/scripts/data/herbs.js');
const {COOKERY_RECIPES}=await load('Kaleidoscope Herbal [BP]/scripts/data/cookeryRecipes.js');
const {HERBAL_WINES}=await load('Kaleidoscope Herbal [BP]/scripts/data/tavernRecipes.js');
const kh=name=>'kaleidoscope_herbal:'+name;
test('a brew is done or burnt: no grades, no quality bookkeeping',()=>{
 assert.ok(Object.keys(FOOD_EFFECTS).every(k=>!/_(low|high)$/.test(k)));
 const recipe=matchDecoction([kh('ginseng_slices'),kh('dried_ginseng'),kh('licorice_slices')]);
 const pot={stage:2,progress:0,warm:0,time:recipe.time,result:recipe.result,recipeServings:recipe.servings,ingredients:[]};
 while(pot.stage===2)advancePot(pot,'strong');
 assert.equal(pot.stage,3);assert.equal(pot.output,kh('ginseng_decoction'));assert.equal(pot.servings,2);
 assert.ok(!('everStrong' in pot)&&!('bonus' in recipe));
 for(let t=0;t<burnLimit('strong');t+=20)advancePot(pot,'strong');
 assert.equal(pot.stage,4);assert.equal(pot.output,kh('burnt_dregs'));
});
test('formulas match their own herbs, adjuvants only add servings, anything else is refused',()=>{
 for(const recipe of DECOCTIONS)assert.equal(matchDecoction(recipe.ingredients).result,recipe.result,recipe.id);
 assert.deepEqual(Object.keys(ADJUVANTS).sort(),[kh('dried_cordyceps'),kh('dried_goji')]);
 const base=[kh('reishi_powder'),kh('reishi_powder'),kh('licorice_slices')];
 assert.equal(matchDecoction([...base,kh('dried_goji')]).servings,4);
 assert.equal(matchDecoction([...base,kh('dried_goji'),kh('dried_cordyceps')]).servings,4); // capped
 assert.equal(matchDecoction([...base,kh('dried_jujube')]),undefined);                      // no longer an adjuvant
 assert.equal(matchDecoction([kh('ginseng_slices'),kh('dried_poria'),kh('dried_licorice')]).result,kh('four_gentlemen_decoction'));
 assert.equal(matchDecoction([kh('dried_cordyceps'),kh('ginseng_slices'),kh('licorice_slices')]).result,kh('cordyceps_decoction'));
 assert.equal(matchDecoction([kh('dried_cordyceps'),kh('ginseng_slices'),kh('ginseng_slices'),kh('licorice_slices')]).result,kh('ginseng_decoction'));
});
test('every herb goes into at least one formula, dish, tea, wine or the incense burner',()=>{
 const used=new Set();
 for(const r of DECOCTIONS)for(const i of r.ingredients)used.add(i);
 for(const e of COOKERY_RECIPES){const r=e.recipe;if(['stockpot','teapot'].includes(e.kind)||r.result&&FOOD_EFFECTS[r.result])for(const i of [r.ingredient,...(r.ingredients??[])].flat().filter(Boolean))used.add(i);}
 for(const w of HERBAL_WINES)for(const i of w.ingredients)used.add(i);
 used.add(kh('mugwort_floss')); // incense
 for(const h of HERBS)assert.ok([h.fresh,h.dry,h.processed].filter(Boolean).some(x=>used.has(kh(x))),h.key+' has no use');
 for(const h of ['licorice','poria','cordyceps','mugwort'])assert.ok(DECOCTIONS.some(r=>r.ingredients.some(i=>i.includes(h))&&r.result.includes(h==='poria'?'four_gentlemen':h)),h+' has its own formula');
});

// ---- v1.2.0 (A9/A11): other packs' formulas and adjuvants, the decoctions catalog, pot broadcasts
const tonic=(over={})=>({id:'other_pack:tonic',ingredients:[{id:'other_pack:root',count:2},{id:kh('licorice_slices'),count:1}],servings:2,...over});
const brew=items=>{ // light the pot the way clayPot.js does, then simmer until done
 const recipe=matchDecoction(items);
 const pot={stage:2,progress:0,warm:0,time:recipe?.time??400,result:recipe?.result??kh('bitter_dregs'),recipeServings:recipe?.servings??1,ingredients:items};
 while(pot.stage===2)advancePot(pot,'mild');
 return pot;
};
test('api_ready lists the v1.2.0 capabilities and limits, which mirror the clay pot',()=>{
 const w=world();const [ready]=w.call(EVENTS.ping,'x');
 assert.ok(ready.capabilities.includes('external_recipes')&&ready.capabilities.includes('external_adjuvants'));
 for(const key of ['externalHeat','itemsPerMessage','heatAddMax','externalRecipes','recipesPerMessage','recipeIngredients','recipeServingsMax','recipeTimeMin','recipeTimeMax','externalAdjuvants','adjuvantServingsMax'])assert.equal(ready.limits[key],LIMITS[key],key);
 assert.equal(LIMITS.recipeIngredients,D.MAX_INGREDIENTS);assert.equal(LIMITS.recipeServingsMax,D.MAX_SERVINGS);assert.equal(LIMITS.recipeTimeDefault,D.DEFAULT_TIME);
 assert.ok(JSON.stringify(ready).length<=2048);
});
test('recipe_register validates every field and never lets a built-in formula be shadowed',()=>{
 const w=world();
 const [ack]=w.call(EVENTS.recipeRegister,{req:'r1',recipes:[
  tonic(),
  tonic({id:'nocolon'}),
  tonic({id:kh('ginseng_decoction')}),
  tonic({id:'minecraft:potion'}),
  tonic({id:'other_pack:a',servings:5}),
  tonic({id:'other_pack:b',servings:1.5}),
  tonic({id:'other_pack:c',time:10}),
  tonic({id:'other_pack:d',ingredients:[]}),
 ]});
 assert.equal(ack.to,'other_pack');assert.equal(ack.req,'r1');assert.equal(ack.ok,false);assert.equal(ack.accepted,1);
 assert.deepEqual(ack.rejected.map(r=>r.code),['BAD_ID','RESERVED','RESERVED','BAD_SERVINGS','BAD_SERVINGS','BAD_TIME','BAD_INGREDIENTS']);
 const [more]=w.call(EVENTS.recipeRegister,{recipes:[
  tonic({id:'other_pack:e',ingredients:[{id:'other_pack:root',count:7}]}),
  tonic({id:'other_pack:f',ingredients:[{id:'other_pack:root',count:4},{id:'other_pack:leaf',count:3}]}),
  tonic({id:'other_pack:g',ingredients:[{id:'Bad Item',count:1}]}),
  tonic({id:'other_pack:h',ingredients:[{id:'other_pack:root',count:0}]}),
  tonic({id:'other_pack:i',ingredients:'other_pack:root'}),
  tonic({id:'other_pack:missing_item'}),
  tonic({id:'other_pack:j',ingredients:DECOCTIONS[0].ingredients.map(id=>({id,count:1}))}),                       // a built-in mix
  tonic({id:'other_pack:k',ingredients:[{id:kh('dried_ginseng'),count:2},{id:kh('dried_licorice'),count:1},{id:kh('dried_goji'),count:1}]}), // the same through variants and an adjuvant
 ]});
 assert.deepEqual(more.rejected.map(r=>r.code),['BAD_INGREDIENTS','BAD_INGREDIENTS','BAD_INGREDIENTS','BAD_INGREDIENTS','BAD_INGREDIENTS','UNKNOWN_ITEM','BUILTIN','BUILTIN']);
 assert.deepEqual([...D.EXTERNAL_RECIPES.keys()],['other_pack:tonic']);
 assert.deepEqual(D.EXTERNAL_RECIPES.get('other_pack:tonic'),{result:'other_pack:tonic',ingredients:[kh('licorice_slices'),'other_pack:root','other_pack:root'],servings:2,time:600,source:'other_pack'});
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:'x'})[0].code,'BAD_RECIPES');
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:Array.from({length:LIMITS.recipesPerMessage+1},(_,i)=>tonic({id:'other_pack:z'+i}))})[0].code,'BAD_RECIPES');
 assert.deepEqual(w.call(EVENTS.recipeRegister,{recipes:[tonic({id:'other_pack:typed'})]},'Entity'),[]);assert.equal(D.EXTERNAL_RECIPES.size,1);
});
test('recipe_register: first owner keeps output and mix, re-sending is idempotent, the owner updates and withdraws',()=>{
 const w=world();const third=body=>JSON.stringify({api:1,source:'third_pack',...body});
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[tonic()]})[0].ok,true);
 const before=JSON.stringify([...D.EXTERNAL_RECIPES]);
 const [again]=w.call(EVENTS.recipeRegister,{recipes:[tonic()]});assert.equal(again.ok,true);assert.equal(again.accepted,1);
 assert.equal(JSON.stringify([...D.EXTERNAL_RECIPES]),before);
 assert.equal(w.call(EVENTS.recipeRegister,third({recipes:[tonic({servings:4})]}))[0].rejected[0].code,'TAKEN');   // someone else's output
 assert.equal(w.call(EVENTS.recipeRegister,third({recipes:[tonic({id:'third_pack:copy'})]}))[0].rejected[0].code,'TAKEN'); // someone else's mix
 assert.equal(w.call(EVENTS.recipeRegister,third({recipes:[tonic({servings:0})]}))[0].rejected[0].code,'TAKEN');   // cannot withdraw it either
 assert.equal(D.EXTERNAL_RECIPES.get('other_pack:tonic').servings,2);
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[tonic({servings:3,time:400})]})[0].ok,true);
 assert.equal(D.EXTERNAL_RECIPES.get('other_pack:tonic').servings,3);assert.equal(D.EXTERNAL_RECIPES.get('other_pack:tonic').time,400);
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:tonic',servings:0}]})[0].ok,true);assert.equal(D.EXTERNAL_RECIPES.size,0);
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:tonic',servings:0}]})[0].ok,true); // withdrawing twice is harmless
 assert.equal(w.call(EVENTS.recipeRegister,third({recipes:[tonic({id:'third_pack:copy'})]}))[0].ok,true); // the mix is free again
});
test('recipe_register stops at the table limit',()=>{
 const w=world();const row=n=>tonic({id:'other_pack:brew_'+n,ingredients:[{id:'other_pack:herb_'+n,count:1}]});
 for(let n=0;n<LIMITS.externalRecipes;n+=LIMITS.recipesPerMessage)assert.equal(w.call(EVENTS.recipeRegister,{recipes:Array.from({length:LIMITS.recipesPerMessage},(_,i)=>row(n+i))})[0].ok,true);
 assert.equal(D.EXTERNAL_RECIPES.size,LIMITS.externalRecipes);
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[row('more')]})[0].rejected[0].code,'FULL');
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[{...row(0),servings:1}]})[0].ok,true); // an update still fits
});
test('adjuvant_register validates, caps, keeps the first owner and withdraws',()=>{
 const w=world();
 const [ack]=w.call(EVENTS.adjuvantRegister,{req:5,items:[{id:'other_pack:honey'},{id:'other_pack:dates',servings:1},{id:kh('dried_jujube')},{id:'minecraft:sugar'},{id:'nocolon'},{id:'other_pack:x',servings:2},{id:'other_pack:y',servings:-1},{id:'other_pack:w',servings:.5}]});
 assert.equal(ack.req,5);assert.equal(ack.accepted,2);assert.deepEqual(ack.rejected.map(r=>r.code),['RESERVED','RESERVED','BAD_ID','BAD_SERVINGS','BAD_SERVINGS','BAD_SERVINGS']);
 assert.deepEqual(D.EXTERNAL_ADJUVANTS.get('other_pack:honey'),{servings:1,source:'other_pack'});
 assert.equal(w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:honey'}]})[0].ok,true);assert.equal(D.EXTERNAL_ADJUVANTS.size,2); // idempotent
 assert.equal(w.call(EVENTS.adjuvantRegister,JSON.stringify({api:1,source:'third_pack',items:[{id:'other_pack:honey',servings:0}]}))[0].rejected[0].code,'TAKEN');
 assert.equal(w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:dates',servings:0}]})[0].ok,true);assert.deepEqual([...D.EXTERNAL_ADJUVANTS.keys()],['other_pack:honey']);
 assert.equal(w.call(EVENTS.adjuvantRegister,{items:{}})[0].code,'BAD_ITEMS');
 assert.equal(w.call(EVENTS.adjuvantRegister,{items:Array.from({length:LIMITS.itemsPerMessage+1},(_,i)=>({id:'other_pack:q'+i}))})[0].code,'BAD_ITEMS');
 w.call(EVENTS.adjuvantRegister,{items:Array.from({length:LIMITS.itemsPerMessage},(_,i)=>({id:'other_pack:q'+i}))});
 assert.equal(D.EXTERNAL_ADJUVANTS.size,LIMITS.externalAdjuvants);
 assert.equal(w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:one_more'}]})[0].rejected[0].code,'FULL');
});
test('the pot brews and serves an external recipe, built-ins still win, adjuvants add a serving',()=>{
 const w=world();
 const mix=['other_pack:root',kh('licorice_slices'),'other_pack:root'];
 assert.equal(matchDecoction(mix),undefined);assert.equal(D.isExternalIngredient('other_pack:root'),false);
 assert.equal(brew(mix).output,kh('bitter_dregs'));
 w.call(EVENTS.recipeRegister,{recipes:[tonic({time:300})]});
 assert.ok(D.isExternalIngredient('other_pack:root'));assert.ok(!D.isExternalIngredient('other_pack:pebble'));
 const pot=brew(mix);
 assert.equal(pot.stage,3);assert.equal(pot.output,'other_pack:tonic');assert.equal(pot.servings,2);assert.equal(pot.progress,300);
 assert.deepEqual(D.contentsOnBreak(pot),[{id:'other_pack:tonic',count:2}]);
 assert.equal(matchDecoction(['other_pack:root','other_pack:root',kh('dried_licorice')]).result,'other_pack:tonic'); // Herbal's unsliced forms count here too
 assert.equal(matchDecoction([...mix,kh('dried_goji')]).servings,3);          // a built-in adjuvant joins an external formula
 assert.equal(matchDecoction([...mix,'other_pack:honey']),undefined);         // not an adjuvant yet
 w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:honey'}]});
 assert.ok(D.isExternalIngredient('other_pack:honey'));
 assert.equal(matchDecoction([...mix,'other_pack:honey']).servings,3);
 assert.equal(matchDecoction([...mix,'other_pack:honey','other_pack:honey']).servings,3); // each kind counts once
 assert.equal(matchDecoction([...mix,'other_pack:honey',kh('dried_goji')]).servings,4);
 assert.equal(matchDecoction([...mix,'other_pack:honey',kh('dried_goji'),kh('dried_cordyceps')]),undefined); // MAX_ADJUVANTS
 const reishi=[kh('reishi_powder'),kh('reishi_powder'),kh('licorice_slices')];
 assert.equal(matchDecoction([...reishi,'other_pack:honey']).result,kh('reishi_decoction'));  // an external adjuvant joins a built-in formula
 assert.equal(matchDecoction([...reishi,'other_pack:honey']).servings,4);assert.equal(matchDecoction([...reishi,'other_pack:honey',kh('dried_goji')]).servings,4); // MAX_SERVINGS
 // A formula that is a built-in one plus an item which later becomes an adjuvant: the built-in still wins.
 const ginseng=DECOCTIONS[0].ingredients;
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:super',ingredients:[...ginseng,'other_pack:spice'].map(id=>({id,count:1})),servings:4}]})[0].ok,true);
 assert.equal(matchDecoction([...ginseng,'other_pack:spice']).result,'other_pack:super');
 w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:spice'}]});
 assert.equal(matchDecoction([...ginseng,'other_pack:spice']).result,kh('ginseng_decoction'));
 for(const recipe of DECOCTIONS)assert.equal(matchDecoction(recipe.ingredients).result,recipe.result,recipe.id);
 // Of two external formulas the one naming more ingredients is tried first.
 w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:plain',ingredients:[{id:'other_pack:bark',count:1}],servings:1},{id:'other_pack:rich',ingredients:[{id:'other_pack:bark',count:1},{id:'other_pack:honey',count:1}],servings:1}]});
 assert.equal(matchDecoction(['other_pack:bark','other_pack:honey']).result,'other_pack:rich');assert.equal(matchDecoction(['other_pack:bark']).result,'other_pack:plain');
 w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:tonic',servings:0}]});assert.equal(matchDecoction(mix),undefined);
});
test('an external brew burns like a built-in one; burnt and bitter pots earn a broadcast',()=>{
 const w=world();w.call(EVENTS.recipeRegister,{recipes:[tonic({time:200})]});
 const items=['other_pack:root','other_pack:root',kh('licorice_slices')],recipe=matchDecoction(items);
 const pot={stage:2,progress:0,warm:0,time:recipe.time,result:recipe.result,recipeServings:recipe.servings,ingredients:items},events=[];
 const tick=heat=>{const before=pot.stage;advancePot(pot,heat);const e=D.potEvent(before,pot);if(e)events.push(e);};
 while(pot.stage===2)tick('strong');
 assert.equal(pot.output,'other_pack:tonic');assert.deepEqual(events,[]);
 for(let t=0;t<burnLimit('strong');t+=20)tick('strong');
 assert.equal(pot.stage,4);assert.equal(pot.output,kh('burnt_dregs'));assert.equal(pot.servings,1);
 assert.deepEqual(events,[{t:'decoction_burnt',fields:{id:'other_pack:tonic'}}]);
 tick('strong');assert.equal(events.length,1); // once only
 const wrong={stage:2,progress:0,warm:0,time:400,result:kh('bitter_dregs'),recipeServings:1,ingredients:[kh('dried_jujube')]},seen=[];
 for(let i=0;i<200&&wrong.stage!==4;i++){const before=wrong.stage;advancePot(wrong,'mild');const e=D.potEvent(before,wrong);if(e)seen.push(e.t);}
 assert.deepEqual(seen,['decoction_bitter','decoction_burnt']);
});
test('catalog lists built-in and registered decoctions and adjuvants',()=>{
 const w=world();
 const own=w.call(EVENTS.catalogRequest,{kind:'decoctions'}).flatMap(p=>p.items);
 assert.equal(own.length,DECOCTIONS.length);assert.ok(own.every(r=>!('source' in r)));
 assert.deepEqual(own[0],{id:kh('ginseng_decoction'),ingredients:[[kh('ginseng_slices'),2],[kh('licorice_slices'),1]],servings:2,time:600});
 w.call(EVENTS.recipeRegister,{recipes:[tonic()]});w.call(EVENTS.adjuvantRegister,{items:[{id:'other_pack:honey'}]});
 const parts=w.call(EVENTS.catalogRequest,{kind:'decoctions',req:'c'});assert.ok(parts.every(p=>p.ok&&JSON.stringify(p).length<=LIMITS.packetBytes));
 assert.deepEqual(parts.flatMap(p=>p.items).at(-1),{id:'other_pack:tonic',ingredients:[[kh('licorice_slices'),1],['other_pack:root',2]],servings:2,time:600,source:'other_pack'});
 assert.deepEqual(w.call(EVENTS.catalogRequest,{kind:'adjuvants'}).flatMap(p=>p.items),[{id:kh('dried_goji'),servings:1},{id:kh('dried_cordyceps'),servings:1},{id:'other_pack:honey',servings:1,source:'other_pack'}]);
});
test('SDK: recipes and adjuvants register on ready, replay harmlessly, and can be added or withdrawn later',async()=>{
 const w=world();const logs=[];
 const many=Array.from({length:20},(_,i)=>({id:'my_pack:brew_number_'+i,ingredients:[{id:'my_pack:a_rather_long_ingredient_name_'+i,count:2},{id:kh('licorice_slices'),count:1},{id:'my_pack:another_long_ingredient_'+i,count:1}],servings:2,time:400}));
 const client=connectHerbal(w.system,{source:'my_pack',recipes:[...many,{id:'minecraft:potion',ingredients:[{id:'my_pack:a',count:1}],servings:1}],adjuvants:[{id:'my_pack:honey'}],log:t=>logs.push(t)});
 w.step();
 assert.ok(client.has('external_recipes')&&client.has('external_adjuvants'));
 assert.equal(D.EXTERNAL_RECIPES.size,20);assert.equal(D.EXTERNAL_ADJUVANTS.size,1);
 assert.deepEqual(client.rejected,[{id:'minecraft:potion',code:'RESERVED'}]);assert.equal(logs.length,1);
 w.host.announce();assert.equal(D.EXTERNAL_RECIPES.size,20);assert.equal(D.EXTERNAL_ADJUVANTS.size,1);assert.equal(client.rejected.length,1);
 assert.equal(matchDecoction(['my_pack:a_rather_long_ingredient_name_3','my_pack:a_rather_long_ingredient_name_3',kh('licorice_slices'),'my_pack:another_long_ingredient_3','my_pack:honey']).servings,3);
 const listed=await client.requestCatalog('decoctions');
 assert.equal(listed.length,DECOCTIONS.length+20);assert.equal(listed.filter(r=>r.source==='my_pack').length,20);
 assert.equal((await client.requestCatalog('adjuvants')).length,3);
 client.registerRecipes([{id:'my_pack:late',ingredients:[{id:'my_pack:moss',count:1}],servings:1}]);client.registerAdjuvants([{id:'my_pack:syrup'}]);client.registerHeat([{id:'my_pack:late',heat:10}]);
 assert.equal(matchDecoction(['my_pack:moss','my_pack:syrup']).result,'my_pack:late');assert.equal(heatDelta('my_pack:late'),10);
 client.registerRecipes([{id:'my_pack:brew_number_0',servings:0}]);assert.equal(D.EXTERNAL_RECIPES.size,20);
 D.EXTERNAL_RECIPES.clear();D.EXTERNAL_ADJUVANTS.clear();EXTERNAL_HEAT.clear();w.host.announce(); // Herbal reloaded: everything comes back, the withdrawn one stays out
 assert.equal(D.EXTERNAL_RECIPES.size,20);assert.ok(!D.EXTERNAL_RECIPES.has('my_pack:brew_number_0'));assert.equal(D.EXTERNAL_ADJUVANTS.size,2);assert.equal(heatDelta('my_pack:late'),10);
 client.dispose();
 // Without Herbal the same options and calls stay silent.
 const lone=fakeSystem(),alone=connectHerbal(lone.system,{source:'my_pack',recipes:many,adjuvants:[{id:'my_pack:honey'}],log:t=>logs.push(t)});lone.step(5);
 alone.registerRecipes([many[0]]);alone.registerAdjuvants([{id:'my_pack:x'}]);
 assert.equal(alone.ready,false);const unanswered=alone.requestCatalog('decoctions');lone.step(101);assert.equal(await unanswered,undefined);
});

// ---- v1.1.0 powders: grind, mix in the mortar, strange results, learning
const P=await load('Kaleidoscope Herbal [BP]/scripts/data/powders.js');
const {MILLING}=await load('Kaleidoscope Herbal [BP]/scripts/data/herbs.js');
test('every herb grinds to a powder and every powder goes into a formula',()=>{
 const milled=new Set(MILLING.flatMap(m=>m.outputs.map(o=>o.id)));
 for(const h of HERBS){const powder=kh(P.HERB_POWDERS[h.key]);assert.ok(milled.has(powder),h.key+' has no millstone recipe');
  assert.ok(P.POWDER_FORMULAS.some(f=>f.ingredients.includes(powder)),h.key+' powder is in no formula');}
 assert.equal(new Set(P.POWDER_FORMULAS.map(f=>P.mixKey(f.ingredients))).size,P.POWDER_FORMULAS.length); // no two formulas share a mix
 for(const f of P.POWDER_FORMULAS){assert.ok(f.ingredients.length>=P.MIN_POWDERS&&f.ingredients.length<=P.MAX_POWDERS);assert.ok(FOOD_EFFECTS[f.result].effects.length);}
});
test('a right mix gives its powder in any order; a wrong mix gives a strange powder fixed per world',()=>{
 const good=P.mixResult([kh('chrysanthemum_powder'),kh('goji_powder')],1);
 assert.equal(good.item,kh('ming_mu_powder'));assert.equal(good.formula.via,'mortar');assert.equal(good.mark,undefined);
 const wrong=[kh('goji_powder'),kh('ginseng_powder')];
 const a=P.mixResult(wrong,1),b=P.mixResult([...wrong].reverse(),1);
 assert.equal(a.item,P.STRANGE);assert.equal(a.formula,undefined);assert.equal(a.mark,b.mark);
 const marks=new Set(Array.from({length:40},(_,salt)=>P.mixResult(wrong,salt).mark));assert.ok(marks.size>3); // other worlds differ
 assert.equal(P.parseMark([P.strangeMark(a.mark)]),a.mark);assert.equal(P.parseMark([]),undefined);assert.equal(P.parseMark(['§8✦ 999']),undefined);
 assert.equal(P.mixResult([kh('goji_powder'),kh('goji_powder')],1).item,P.STRANGE); // doubling one powder is not a formula
});
test('a sealed prescription holds one powder formula; the guidebook gives no powder formula away',async()=>{
 for(const roll of [0,.2,.5,.999,1]){const f=P.sealedFormula(roll);assert.equal(f.via,'mortar');assert.equal(P.matchPowder(f.ingredients).result,f.result);}
 assert.equal(new Set(Array.from({length:80},(_,i)=>P.sealedFormula(i/80).result)).size,P.POWDER_FORMULAS.length);
 const {GUIDEBOOK}=await load('Kaleidoscope Herbal [BP]/scripts/data/guidebook.js');
 for(const f of P.POWDER_FORMULAS){const page=GUIDEBOOK.entries.find(e=>e.id===f.result);assert.ok(page,f.result);assert.deepEqual(page.recipes,[]);
  const words=JSON.stringify(page);for(const i of f.ingredients)assert.ok(!words.includes(i),f.result+' page names '+i);}
});

// ---- v1.2.1 fixes
test('a reply too long for one script event is cut and says how many refusals were left out',()=>{
 const w=world(),long=i=>'another_quite_long_pack_namespace:some_fairly_long_item_identifier_'+i;
 w.call(EVENTS.heatRegister,{source:'first_pack',items:Array.from({length:32},(_,i)=>({id:long(i),heat:5}))});
 const [ack]=w.call(EVENTS.heatRegister,{items:Array.from({length:32},(_,i)=>({id:long(i),heat:5}))});
 assert.ok(ack,'the reply was sent');assert.equal(ack.ok,false);assert.equal(ack.accepted,0);
 assert.ok(ack.more>0);assert.equal(ack.rejected.length+ack.more,32);assert.ok(JSON.stringify(ack).length<=2048);
 const [short]=w.call(EVENTS.heatRegister,{items:[{id:long(0),heat:5}]});assert.equal(short.more,undefined);
});
test('catalog_request: an inherited name is an unknown kind; req comes back as it was sent',()=>{
 const w=world();
 const [bad]=w.call(EVENTS.catalogRequest,{kind:'constructor',req:7});
 assert.equal(bad.ok,false);assert.equal(bad.code,'UNKNOWN_KIND');assert.strictEqual(bad.req,7);
 assert.strictEqual(w.call(EVENTS.heatRequest,{p:'p1',req:'abc'})[0].req,'abc');
 assert.equal(w.call(EVENTS.heatRequest,{p:'p1',req:'x'.repeat(40)})[0].req.length,32);
});
test('heat_add: a delta that rounds to nothing is refused and does not use up the second',()=>{
 const w=world();
 assert.equal(w.call(EVENTS.heatAdd,{p:'p1',delta:0.4})[0].code,'BAD_DELTA');
 const [ok]=w.call(EVENTS.heatAdd,{p:'p1',delta:10});assert.equal(ok.ok,true);assert.equal(ok.applied,10);
});
test('heat_add: changing the source name does not get past the per-player limit',()=>{
 const w=world();let accepted=0;
 for(let i=0;i<10;i++)if(w.call(EVENTS.heatAdd,{source:'pack_'+i,p:'p1',delta:50})[0].ok)accepted++;
 assert.equal(accepted,LIMITS.heatAddsPerPlayer);assert.ok(w.heat.get('p1')<100);
 w.step(LIMITS.heatAddCooldown);assert.equal(w.call(EVENTS.heatAdd,{source:'pack_x',p:'p1',delta:-5})[0].ok,true);
});
test('sliced and unsliced herbs: the order they go in does not matter, and two formulas for one mix are refused',()=>{
 const w=world(),slices=kh('angelica_slices'),dried=kh('dried_angelica');
 assert.equal(w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:both',servings:1,ingredients:[{id:slices},{id:dried},{id:'other_pack:root'}]}]})[0].accepted,1);
 assert.equal(matchDecoction([slices,dried,'other_pack:root'])?.result,'other_pack:both');
 assert.equal(matchDecoction([dried,slices,'other_pack:root'])?.result,'other_pack:both');
 assert.equal(matchDecoction(['other_pack:root',dried,slices])?.result,'other_pack:both');
 w.call(EVENTS.recipeRegister,{recipes:[{id:'other_pack:a',servings:1,ingredients:[{id:kh('licorice_slices')},{id:'other_pack:root'}]}]});
 const [ack]=w.call(EVENTS.recipeRegister,{source:'third_pack',recipes:[{id:'third_pack:b',servings:1,ingredients:[{id:kh('dried_licorice')},{id:'other_pack:root'}]}]});
 assert.deepEqual(ack.rejected,[{id:'third_pack:b',code:'TAKEN'}]);
 assert.equal(D.sameMix([kh('licorice_slices')],[kh('dried_licorice')]),true);assert.equal(D.sameMix([kh('licorice_slices')],[kh('dried_poria')]),false);
});
test('SDK: a request made before api_ready waits for it; a repeated refusal is listed once',async()=>{
 const w=world();
 const client=connectHerbal(w.system,{source:'my_pack',heat:[{id:'minecraft:apple',heat:1}],log:()=>{}});
 const early=client.requestHeat('p1');   // asked in the same tick as connectHerbal, before the ping has gone out
 w.step();assert.deepEqual(await early,{heat:0,applied:undefined,effect:undefined});
 w.host.announce();w.host.announce();assert.deepEqual(client.rejected,[{id:'minecraft:apple',code:'RESERVED'}]);
 const late=connectHerbal(w.system,{source:'late_pack',log:()=>{}});const asked=late.requestHeat('p1');late.dispose();assert.equal(await asked,undefined);
});

