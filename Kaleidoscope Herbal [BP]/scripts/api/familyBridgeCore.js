// Family handshake (after 1.1.0): handshakes with the sister packs 樂牧 (Ranching) and 漁歌 (Fishing Voyage). No @minecraft imports, so
// tests can drive it. Both packs speak the same Script Event pattern as we do: <ns>:api_ping is answered by
// <ns>:api_ready {"api":1,"version","capabilities":[...]}, and each also announces api_ready by itself after load.
// Both are optional: without them nothing comes back and nothing is logged.
//
//   Ranching  capability "remedy": 清熱散 cures a sick animal (register_remedy, one item per message).
//             capability "register_feed": 苦藥渣 and 焦藥渣 go in its troughs as vegetable feed (藥渣餵豬).
//             Ranching answers each with api_result, broadcast to everyone: only our own ids are looked at.
//   Fishing   capability "sky" + "events": its meteor-shower and aurora nights (kaleidoscope_fishing:evt t "sky",
//             the same shape as A Witch Way's aww:evt sky) speed our crops up exactly like an AWW sky event.
//
// Registrations last for the world session; every api_ready sends them again (both packs say that is safe).
export const SOURCE='kaleidoscope_herbal';
export const RANCHING='kaleidoscope_ranching',FISHING='kaleidoscope_fishing';
export const RANCHING_REMEDIES=['kaleidoscope_herbal:qing_re_powder'];
export const RANCHING_FEEDS=[
 {item:'kaleidoscope_herbal:bitter_dregs',kind:'veg',units:1},
 {item:'kaleidoscope_herbal:burnt_dregs',kind:'veg',units:1},
];
const has=(m,c)=>Array.isArray(m?.capabilities)&&m.capabilities.includes(c);
// deps: {send(id,message), onSky(m), log(text)}
export function createFamilyBridge(deps){
 const info=new Map(),warned=new Set();
 const send=(id,body)=>{try{deps.send(id,typeof body==='string'?body:JSON.stringify(body));}catch{}};
 const warn=t=>{if(warned.has(t))return;warned.add(t);try{deps.log?.(t);}catch{}};
 const ready={
  [RANCHING](m){
   if(has(m,'remedy'))for(const item of RANCHING_REMEDIES)send(RANCHING+':register_remedy',{item});
   if(has(m,'register_feed'))for(const f of RANCHING_FEEDS)send(RANCHING+':register_feed',f);
  },
  [FISHING](){},
 };
 function handle(id,message,sourceType){
  if(sourceType!==undefined&&sourceType!=='Server')return false;
  const cut=String(id).indexOf(':'),ns=String(id).slice(0,cut),name=String(id).slice(cut+1);
  if(!ready[ns])return false;
  let m;try{m=JSON.parse(String(message??''));}catch{return false;}
  if(!m||typeof m!=='object')return false;
  if(name==='api_ready'){
   if(Number(m.api)!==1)return false;
   info.set(ns,m);ready[ns](m);return true;
  }
  if(ns===RANCHING&&name==='api_result'){
   if(m.ok===false&&typeof m.id==='string'&&m.id.startsWith(SOURCE+':'))warn(`Ranching refused ${m.event??'a registration'} for ${m.id}: ${m.error??'no reason given'}`);
   return false;
  }
  if(ns===FISHING&&name==='evt'){
   if(m.v===1&&m.t==='sky'&&(!info.has(FISHING)||has(info.get(FISHING),'sky')))return deps.onSky(m);
   return false;
  }
  return false;
 }
 const ping=()=>{for(const ns of Object.keys(ready))send(ns+':api_ping',SOURCE);};
 return {handle,ping,info:ns=>info.get(ns)};
}
