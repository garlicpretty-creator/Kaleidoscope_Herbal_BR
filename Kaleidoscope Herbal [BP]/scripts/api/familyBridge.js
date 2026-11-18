// Optional handshakes with the sister packs 樂牧 (Ranching) and 漁歌 (Fishing Voyage).
// Both speak the same kind of Script Event API as Herbal: `<ns>:api_ping` is answered by `<ns>:api_ready`
// {api:1,version,capabilities}, and each also announces api_ready by itself after load. We ping both and act
// on whoever answers; with neither installed nothing is sent back, nothing is logged, Herbal plays the same.
// Never their scripts, never their pack UUIDs. Registrations last for the world session: every api_ready resends.
//
//   Ranching  capability "remedy": honeysuckle powder (金銀花，清熱解毒) cures a sick animal, one per use.
//             Ranching answers every registration with api_result; only our own refusals are logged, once.
//   Fishing   capability "pond_feed" (1.5.0): bitter and burnt dregs feed a fish pond, one meal each (fish farms
//             do feed herb residue). Fishing sends no reply; a refusal is a line in its own content log.
//
// The 寒熱 of their foods goes the other way: Fishing, Ranching and Harvest send heat_register to herbalHost.js.
// `system` is passed in so tests can run without @minecraft/server.
const SOURCE='kaleidoscope_herbal',RANCHING='kaleidoscope_ranching',FISHING='kaleidoscope_fishing';
const id=name=>SOURCE+':'+name;
export const RANCHING_REMEDIES=Object.freeze([id('honeysuckle_powder')]);
export const FISHING_POND_FEEDS=Object.freeze([{id:id('bitter_dregs'),meals:1},{id:id('burnt_dregs'),meals:1}]);
const has=(info,capability)=>Array.isArray(info?.capabilities)&&info.capabilities.includes(capability);

/** The [event, message] pairs a sister pack can take, given its api_ready payload. */
export function familyMessages(ns,info){
 if(Number(info?.api)!==1)return [];
 if(ns===RANCHING)return has(info,'remedy')?RANCHING_REMEDIES.map(item=>[RANCHING+':register_remedy',JSON.stringify({item})]):[];
 if(ns===FISHING)return has(info,'pond_feed')?[[FISHING+':register_pond_feed',JSON.stringify({api:1,source:SOURCE,feeds:FISHING_POND_FEEDS})]]:[];
 return [];
}

export function startFamilyBridge(system,{log=text=>{try{console.warn('[Herbal] '+text);}catch{}}}={}){
 const info=new Map(),warned=new Set();
 const send=(event,message)=>{try{system.sendScriptEvent(event,message);}catch{}};
 const warnOnce=text=>{if(!warned.has(text)){warned.add(text);log(text);}};
 function handle(event){
  const cut=String(event?.id??'').indexOf(':'),ns=event.id.slice(0,cut),name=event.id.slice(cut+1);
  let m;try{m=JSON.parse(String(event.message??''));}catch{return;}
  if(!m||typeof m!=='object')return;
  if(name==='api_ready'){
   if(Number(m.api)!==1)return;
   info.set(ns,m);
   for(const [e,message] of familyMessages(ns,m))send(e,message);
   return;
  }
  // Ranching broadcasts every add-on's result: only ours, only refusals.
  if(ns===RANCHING&&name==='api_result'&&m.ok===false&&typeof m.id==='string'&&m.id.startsWith(SOURCE+':'))
   warnOnce('Ranching refused '+(m.event??'a registration')+' for '+m.id+': '+(m.error??'no reason given'));
 }
 system.afterEvents.scriptEventReceive.subscribe(event=>{try{handle(event);}catch{}},{namespaces:[RANCHING,FISHING]});
 system.runTimeout(()=>{send(RANCHING+':api_ping',SOURCE);send(FISHING+':api_ping',SOURCE);},20);
 return {info:ns=>info.get(ns),handle};
}
