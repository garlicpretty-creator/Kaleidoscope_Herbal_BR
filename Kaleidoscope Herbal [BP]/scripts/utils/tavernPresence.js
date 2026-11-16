import {system} from '@minecraft/server';
// Tavern announces itself with api_ready (also in answer to our SDK ping). Until then, Tavern-linked
// content is treated as absent; listeners hear about it once, when Tavern turns up.
export const TAVERN_LINKED=new Set(['ginseng_wine','angelica_wine','reishi_wine','goji_wine','jujube_wine','wine_angelica'].map(k=>'kaleidoscope_herbal:'+k));
let present=false;
const listeners=[];
export const isTavernPresent=()=>present;
export function onTavernPresent(fn){listeners.push(fn);}
export function startTavernPresence(){
 system.afterEvents.scriptEventReceive.subscribe(event=>{
  if(present||event.id!=='kaleidoscope_tavern:api_ready')return;
  try{if(JSON.parse(event.message).api!==1)return;}catch{return;}
  present=true;
  for(const fn of listeners){try{fn();}catch(error){console.warn('[Herbal] Tavern listener: '+error);}}
 },{namespaces:['kaleidoscope_tavern']});
}
