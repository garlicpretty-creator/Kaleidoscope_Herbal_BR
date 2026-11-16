import {system} from '@minecraft/server';
// v1.2.10: family event broadcast (森羅 PHASE2 event contract §0/§4). One-line JSON on
// `kaleidoscope_herbal:evt`: {"v":1,"t":<event>,"p":<player.id>,...}. Only id strings, numbers and booleans.
// Events: decoction_served {id}, ate_placed {id, kind: 'soup'|'wine'}, ginseng_dug {whole}, incense_lit {fuel},
// constitution {state: 'overheat'|'chill'}, powder_mixed {id}, formula_learned {id} (v1.1.0),
// herb_harvested {herb, wild}, decoction_burnt {id}, decoction_bitter {} (v1.1.0; the pot events name whoever lit the pot).
// The full contract is docs/API.md.
// The same event for the same player is sent at most once per 20 ticks. Sending never breaks the caller.
export const EVT='kaleidoscope_herbal:evt';
export const EVT_THROTTLE=20;
const last=new Map();
let warned=false;
export function emitEvt(t,player,fields={}){
 try{
  const p=player?.id;if(!p)return false;
  const key=p+'|'+t,now=system.currentTick,prev=last.get(key);
  if(prev!==undefined&&now-prev<EVT_THROTTLE)return false;
  if(last.size>512)for(const [k,tick] of last)if(now-tick>=EVT_THROTTLE)last.delete(k);
  last.set(key,now);
  system.sendScriptEvent(EVT,JSON.stringify({v:1,t,p,...fields}));
  return true;
 }catch(error){
  if(!warned){warned=true;console.warn('[Herbal] event broadcast: '+error);}
  return false;
 }
}
