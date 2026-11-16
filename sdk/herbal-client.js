/**
 * 森羅物語：草本 (Kaleidoscope Herbal) public client SDK, API 1. Contract: docs/API.md.
 * Copy this one file into YOUR add-on; never import Herbal's own pack paths.
 * It needs only the `system` object from @minecraft/server and works whether Herbal is installed or not:
 * without Herbal nothing is ever sent back, `ready` stays false and requests resolve to undefined.
 *
 *   import {system} from '@minecraft/server';
 *   import {connectHerbal} from './herbal-client.js';
 *   const herbal=connectHerbal(system,{source:'my_pack',heat:[{id:'my_pack:iced_tea',heat:-30}],
 *     onEvent:e=>{if(e.t==='decoction_served')...}});
 */
export const HERBAL_EVENTS=Object.freeze({ping:'kaleidoscope_herbal:api_ping',ready:'kaleidoscope_herbal:api_ready',
 catalogRequest:'kaleidoscope_herbal:catalog_request',catalog:'kaleidoscope_herbal:catalog',
 heatRegister:'kaleidoscope_herbal:heat_register',heatAck:'kaleidoscope_herbal:heat_ack',
 heatRequest:'kaleidoscope_herbal:heat_request',heatAdd:'kaleidoscope_herbal:heat_add',heat:'kaleidoscope_herbal:heat',
 evt:'kaleidoscope_herbal:evt'});
export function connectHerbal(system,{source,heat=[],requires=[],onReady,onEvent,log=console.warn,timeoutTicks=100}={}){
 if(typeof source!=='string'||!/^[a-z0-9_.-]{1,64}$/.test(source))throw new Error('source must be your pack namespace');
 let info,disposed=false,sequence=0,warned=false;
 const waiting=new Map(),rejected=[];
 const send=(id,body)=>system.sendScriptEvent(id,JSON.stringify({api:1,source,...body}));
 const ask=(id,body,collect)=>new Promise(resolve=>{
  if(disposed||!info){resolve(undefined);return;}
  const req=source.slice(0,20)+'#'+(++sequence);
  const timer=system.runTimeout(()=>{waiting.delete(req);resolve(undefined);},timeoutTicks);
  waiting.set(req,{collect,parts:[],done:value=>{system.clearRun(timer);waiting.delete(req);resolve(value);}});
  send(id,{...body,req});
 });
 const registerHeat=()=>{
  const size=info.limits?.itemsPerMessage??32;
  for(let i=0;i<heat.length;i+=size)send(HERBAL_EVENTS.heatRegister,{items:heat.slice(i,i+size)});
 };
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
   if(onReady){try{onReady(m);}catch(error){log('[Herbal SDK] onReady: '+error);}}
   return;
  }
  if(m.to!==source)return;
  if(ev.id===HERBAL_EVENTS.heatAck){for(const row of m.rejected??[]){rejected.push(row);log('[Herbal SDK] Rejected '+row.id+': '+row.code);}return;}
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
  /** Heat registrations the host refused since the last ready: [{id, code}]. */
  get rejected(){return [...rejected];},
  has:capability=>!!info?.capabilities?.includes(capability),
  /** kind: 'herbs' | 'foods'. Resolves to the item list, or undefined (no Herbal, unknown kind, timeout). */
  requestCatalog:kind=>ask(HERBAL_EVENTS.catalogRequest,{kind}),
  /** Resolves to {heat} for a player id, {error} when refused, undefined without Herbal. Range -100..100. */
  requestHeat:playerId=>ask(HERBAL_EVENTS.heatRequest,{p:playerId}),
  /** Warms (+) or cools (-) a player; the host clamps to its heatAddMax and allows one push a second. */
  addHeat:(playerId,delta)=>ask(HERBAL_EVENTS.heatAdd,{p:playerId,delta}),
  dispose(){disposed=true;system.afterEvents.scriptEventReceive.unsubscribe(callback);for(const wait of [...waiting.values()])wait.done(undefined);},
 };
}
