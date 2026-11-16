/**
 * 森羅物語：草本 (Kaleidoscope Herbal) public client SDK, API 1. Contract: docs/API.md.
 * Copy this one file into YOUR add-on; never import Herbal's own pack paths.
 * It needs only the `system` object from @minecraft/server and works whether Herbal is installed or not:
 * without Herbal nothing is ever sent back, `ready` stays false and requests resolve to undefined (after timeoutTicks).
 *
 *   import {system} from '@minecraft/server';
 *   import {connectHerbal} from './herbal-client.js';
 *   const herbal=connectHerbal(system,{source:'my_pack',heat:[{id:'my_pack:iced_tea',heat:-30}],
 *     onEvent:e=>{if(e.t==='decoction_served')...}});
 *
 * v1.1.0: `recipes` ([{id, ingredients:[{id,count}], servings, time?}]) are brewed by Herbal's clay pot and
 * `adjuvants` ([{id, servings?}]) add a serving to any brew; both are sent again on every api_ready, like `heat`.
 */
export const HERBAL_EVENTS=Object.freeze({ping:'kaleidoscope_herbal:api_ping',ready:'kaleidoscope_herbal:api_ready',
 catalogRequest:'kaleidoscope_herbal:catalog_request',catalog:'kaleidoscope_herbal:catalog',
 heatRegister:'kaleidoscope_herbal:heat_register',heatAck:'kaleidoscope_herbal:heat_ack',
 heatRequest:'kaleidoscope_herbal:heat_request',heatAdd:'kaleidoscope_herbal:heat_add',heat:'kaleidoscope_herbal:heat',
 recipeRegister:'kaleidoscope_herbal:recipe_register',recipeAck:'kaleidoscope_herbal:recipe_ack',
 adjuvantRegister:'kaleidoscope_herbal:adjuvant_register',adjuvantAck:'kaleidoscope_herbal:adjuvant_ack',
 evt:'kaleidoscope_herbal:evt'});
export function connectHerbal(system,{source,heat=[],recipes=[],adjuvants=[],requires=[],onReady,onEvent,log=console.warn,timeoutTicks=100}={}){
 if(typeof source!=='string'||!/^[a-z0-9_.-]{1,64}$/.test(source))throw new Error('source must be your pack namespace');
 let info,disposed=false,sequence=0,warned=false;
 const waiting=new Map(),rejected=[],queued=[];
 const send=(id,body)=>system.sendScriptEvent(id,JSON.stringify({api:1,source,...body}));
 const ask=(id,body,collect)=>new Promise(resolve=>{
  if(disposed){resolve(undefined);return;}
  const start=()=>{
   const req=source.slice(0,20)+'#'+(++sequence);
   const timer=system.runTimeout(()=>{waiting.delete(req);resolve(undefined);},timeoutTicks);
   waiting.set(req,{collect,parts:[],done:value=>{system.clearRun(timer);waiting.delete(req);resolve(value);}});
   send(id,{...body,req});
  };
  if(info){start();return;}
  // Asked before Herbal's api_ready arrived (it takes a tick or two after load): the request waits for it.
  // Without Herbal it resolves to undefined after timeoutTicks.
  const entry={start,resolve};queued.push(entry);
  system.runTimeout(()=>{const i=queued.indexOf(entry);if(i>=0){queued.splice(i,1);resolve(undefined);}},timeoutTicks);
 });
 // Batches stay under the host's per-message count and well inside the 2048-character script event limit.
 const sendAll=(id,field,rows,size)=>{
  let batch=[],length=0;
  const flush=()=>{if(batch.length)send(id,{[field]:batch});batch=[];length=0;};
  for(const row of rows){
   const cost=JSON.stringify(row).length+1;
   if(batch.length>=size||length+cost>1700)flush();
   batch.push(row);length+=cost;
  }
  flush();
 };
 const registerHeat=(rows=heat)=>sendAll(HERBAL_EVENTS.heatRegister,'items',rows,info.limits?.itemsPerMessage??32);
 const registerRecipes=(rows=recipes)=>sendAll(HERBAL_EVENTS.recipeRegister,'recipes',rows,info.limits?.recipesPerMessage??8);
 const registerAdjuvants=(rows=adjuvants)=>sendAll(HERBAL_EVENTS.adjuvantRegister,'items',rows,info.limits?.itemsPerMessage??32);
 // Later additions replace an earlier row with the same id, so the next api_ready replays the latest value.
 const keep=(list,rows)=>{for(const row of rows){const i=list.findIndex(x=>x.id===row.id);if(i<0)list.push(row);else list[i]=row;}};
 heat=[...heat];recipes=[...recipes];adjuvants=[...adjuvants];
 const callback=ev=>{
  if(disposed||ev.sourceType!=='Server')return;
  let m;try{m=JSON.parse(ev.message);}catch{return;}
  if(!m||typeof m!=='object')return;
  if(ev.id===HERBAL_EVENTS.evt){if(m.v===1&&onEvent){try{onEvent(m);}catch(error){log('[Herbal SDK] onEvent: '+error);}}return;}
  if(m.api!==1)return;
  if(ev.id===HERBAL_EVENTS.ready){
   const missing=requires.filter(x=>!m.capabilities?.includes(x));
   if(missing.length){if(!warned){warned=true;log('[Herbal SDK] Host lacks required capabilities: '+missing.join(', '));}return;}
   // Herbal keeps registrations in memory only; every ready replays them, which is harmless when repeated.
   info=m;rejected.length=0;
   if(heat.length&&m.capabilities?.includes('external_heat'))registerHeat();
   if(adjuvants.length&&m.capabilities?.includes('external_adjuvants'))registerAdjuvants();
   if(recipes.length&&m.capabilities?.includes('external_recipes'))registerRecipes();
   for(const entry of queued.splice(0))entry.start();
   if(onReady){try{onReady(m);}catch(error){log('[Herbal SDK] onReady: '+error);}}
   return;
  }
  if(m.to!==source)return;
  if(ev.id===HERBAL_EVENTS.heatAck||ev.id===HERBAL_EVENTS.recipeAck||ev.id===HERBAL_EVENTS.adjuvantAck){
   if(m.code)log('[Herbal SDK] Refused '+ev.id+': '+m.code);
   // Herbal announces itself and also answers our ping, so the same refusal can arrive twice: one row per id is kept.
   for(const row of m.rejected??[]){const i=rejected.findIndex(x=>x.id===row.id);if(i<0)rejected.push(row);else rejected[i]=row;log('[Herbal SDK] Rejected '+row.id+': '+row.code);}
   if(m.more)log('[Herbal SDK] '+m.more+' more refusals did not fit in the reply');
   return;
  }
  const wait=waiting.get(m.req);if(!wait)return;
  if(ev.id===HERBAL_EVENTS.heat){wait.done(m.ok?{heat:m.heat,applied:m.applied,effect:m.effect}:{error:m.code,heat:m.heat});return;}
  if(ev.id===HERBAL_EVENTS.catalog){
   if(!m.ok){wait.done(undefined);return;}
   wait.parts[m.index]=m.items;
   if(wait.parts.filter(Boolean).length===m.parts)wait.done(wait.parts.flat());
  }
 };
 system.afterEvents.scriptEventReceive.subscribe(callback,{namespaces:['kaleidoscope_herbal']});
 system.run(()=>{if(!disposed)system.sendScriptEvent(HERBAL_EVENTS.ping,source);});
 return {
  /** True once Herbal answered with a compatible api_ready. */
  get ready(){return !!info;},
  /** The host's api_ready payload: {api, source, version, capabilities, limits}. */
  get host(){return info;},
  /** Heat, recipe and adjuvant registrations the host refused since the last ready: [{id, code}]. */
  get rejected(){return [...rejected];},
  has:capability=>!!info?.capabilities?.includes(capability),
  /** kind: 'herbs' | 'foods' | 'decoctions' | 'adjuvants'. Resolves to the item list, or undefined (no Herbal, unknown kind, timeout). */
  requestCatalog:kind=>ask(HERBAL_EVENTS.catalogRequest,{kind}),
  /** Resolves to {heat} for a player id, {error} when refused, undefined without Herbal. Range -100..100. */
  requestHeat:playerId=>ask(HERBAL_EVENTS.heatRequest,{p:playerId}),
  /** Warms (+) or cools (-) a player; the host clamps to its heatAddMax and allows one push a second. */
  addHeat:(playerId,delta)=>ask(HERBAL_EVENTS.heatAdd,{p:playerId,delta}),
  /** Adds or updates clay-pot recipes ([{id, ingredients:[{id,count}], servings, time?}]); servings 0 withdraws one. Replayed on every ready. */
  registerRecipes(rows){keep(recipes,rows);if(!disposed&&info?.capabilities?.includes('external_recipes'))registerRecipes(rows);},
  /** Adds or updates adjuvants ([{id, servings?}]); servings 0 withdraws one. Replayed on every ready. */
  registerAdjuvants(rows){keep(adjuvants,rows);if(!disposed&&info?.capabilities?.includes('external_adjuvants'))registerAdjuvants(rows);},
  /** Adds or updates heat values ([{id, heat}]); heat 0 withdraws one. Replayed on every ready. */
  registerHeat(rows){keep(heat,rows);if(!disposed&&info?.capabilities?.includes('external_heat'))registerHeat(rows);},
  dispose(){disposed=true;system.afterEvents.scriptEventReceive.unsubscribe(callback);for(const wait of [...waiting.values()])wait.done(undefined);for(const entry of queued.splice(0))entry.resolve(undefined);},
 };
}
