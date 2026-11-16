import {world} from '@minecraft/server';
const NS='kaleidoscope_herbal:';
const handlers=[];
let subscribed=false;
// v1.2.6: one entityLoad listener for the whole pack (was one per feature). Every entity that loads
// anywhere reaches it, so other packs' entities leave after a single prefix check.
export function onHerbalEntityLoad(fn){
 handlers.push(fn);
 if(subscribed)return;subscribed=true;
 world.afterEvents.entityLoad.subscribe(({entity})=>{
  let type;try{type=entity.typeId;}catch{return;}
  if(!type.startsWith(NS))return;
  for(const handler of handlers){try{handler(entity,type);}catch(error){console.warn('[Herbal] entity load: '+error);}}
 });
}
