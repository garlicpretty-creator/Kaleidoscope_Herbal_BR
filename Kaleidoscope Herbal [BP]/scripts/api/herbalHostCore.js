// v1.1.0: the Herbal host API (docs/API.md). Other packs talk to Herbal over script events in the
// `kaleidoscope_herbal` namespace, the same ping/ready pattern Cookery and Tavern use.
// This file imports nothing from the game, so tests/ runs it under Node; herbalHost.js wires it to the world.
export const API=1,NS='kaleidoscope_herbal';
export const EVENTS=Object.freeze({
 ping:NS+':api_ping',ready:NS+':api_ready',
 catalogRequest:NS+':catalog_request',catalog:NS+':catalog',
 heatRegister:NS+':heat_register',heatAck:NS+':heat_ack',
 heatRequest:NS+':heat_request',heatAdd:NS+':heat_add',heat:NS+':heat',
 evt:NS+':evt',
});
export const CAPABILITIES=Object.freeze(['events','catalog','constitution','constitution_write','external_heat','heat_source_tag']);
export const LIMITS=Object.freeze({externalHeat:256,itemsPerMessage:32,heatMax:100,heatAddMax:50,heatAddCooldown:20,packetBytes:1800});
const SOURCE=/^[a-z0-9_.-]{1,64}$/,ITEM=/^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,128}$/;
const RESERVED=new Set([NS,'minecraft']);
// Catalog items are plain ASCII ids and numbers, so a character is a byte.
export function packItems(items,head,limit=LIMITS.packetBytes){
 const groups=[];let group=[],size=0;
 for(const item of items){
  const cost=JSON.stringify(item).length+1;
  if(group.length&&size+cost>limit-head){groups.push(group);group=[];size=0;}
  group.push(item);size+=cost;
 }
 if(group.length||!groups.length)groups.push(group);
 return groups;
}
/**
 * @param {{send:(id:string,message:string)=>void, now:()=>number, version:string,
 *  catalogs:Record<string,()=>object[]>, externalHeat:Map<string,{heat:number,source:string}>, ownsItem:(id:string)=>boolean,
 *  getPlayer:(id:string)=>any, getHeat:(player:any)=>number, shiftHeat:(player:any,delta:number)=>{heat:number,effect?:string},
 *  log?:(text:string)=>void}} deps
 */
export function createHerbalHost(deps){
 const {send,now,version,catalogs,externalHeat,ownsItem,getPlayer,getHeat,shiftHeat,log=()=>{}}=deps;
 const lastAdd=new Map();
 const out=(id,body)=>{try{send(id,JSON.stringify({api:API,...body}));}catch(error){log('send '+id+': '+error);}};
 const announce=()=>out(EVENTS.ready,{source:NS,version,capabilities:CAPABILITIES,limits:{externalHeat:LIMITS.externalHeat,itemsPerMessage:LIMITS.itemsPerMessage,heatAddMax:LIMITS.heatAddMax}});
 const req=m=>typeof m.req==='string'||typeof m.req==='number'?String(m.req).slice(0,32):undefined;
 function catalog(m){
  const build=catalogs[m.kind];
  if(!build){out(EVENTS.catalog,{to:m.source,req:req(m),kind:String(m.kind).slice(0,32),ok:false,code:'UNKNOWN_KIND',kinds:Object.keys(catalogs)});return;}
  const groups=packItems(build(),160);
  groups.forEach((items,index)=>out(EVENTS.catalog,{to:m.source,req:req(m),kind:m.kind,ok:true,index,parts:groups.length,items}));
 }
 function heatRegister(m){
  const rejected=[];let accepted=0;
  const reject=(id,code)=>rejected.push({id:typeof id==='string'?id.slice(0,96):null,code});
  if(!Array.isArray(m.items)||m.items.length>LIMITS.itemsPerMessage){out(EVENTS.heatAck,{to:m.source,req:req(m),ok:false,code:'BAD_ITEMS',accepted,rejected});return;}
  for(const row of m.items){
   const id=row?.id,heat=row?.heat;
   if(typeof id!=='string'||!ITEM.test(id)){reject(id,'BAD_ID');continue;}
   if(RESERVED.has(id.split(':')[0])||ownsItem(id)){reject(id,'RESERVED');continue;}
   if(!Number.isInteger(heat)||Math.abs(heat)>LIMITS.heatMax){reject(id,'BAD_HEAT');continue;}
   const held=externalHeat.get(id);
   if(held&&held.source!==m.source){reject(id,'TAKEN');continue;} // first pack to claim an item keeps it
   if(heat===0){if(held)externalHeat.delete(id);accepted++;continue;} // 0 withdraws the pack's own value
   if(!held&&externalHeat.size>=LIMITS.externalHeat){reject(id,'FULL');continue;}
   externalHeat.set(id,{heat,source:m.source});accepted++;
  }
  out(EVENTS.heatAck,{to:m.source,req:req(m),ok:rejected.length===0,accepted,rejected});
 }
 function heat(m,write){
  const reply=(body)=>out(EVENTS.heat,{to:m.source,req:req(m),p:typeof m.p==='string'?m.p.slice(0,64):null,...body});
  const player=typeof m.p==='string'?getPlayer(m.p):undefined;
  if(!player){reply({ok:false,code:'NO_PLAYER'});return;}
  if(!write){reply({ok:true,heat:getHeat(player)});return;}
  if(!Number.isFinite(m.delta)||m.delta===0){reply({ok:false,code:'BAD_DELTA'});return;}
  // One push per pack and player each second, so a looping pack cannot hold a player at the limit.
  const key=m.source+'|'+m.p,tick=now(),prev=lastAdd.get(key);
  if(prev!==undefined&&tick-prev<LIMITS.heatAddCooldown){reply({ok:false,code:'THROTTLED',heat:getHeat(player)});return;}
  if(lastAdd.size>512)for(const [k,t] of lastAdd)if(tick-t>=LIMITS.heatAddCooldown)lastAdd.delete(k);
  lastAdd.set(key,tick);
  const delta=Math.max(-LIMITS.heatAddMax,Math.min(LIMITS.heatAddMax,Math.round(m.delta)));
  const result=shiftHeat(player,delta);
  reply({ok:true,heat:result.heat,applied:delta,...(result.effect?{effect:result.effect}:{})});
 }
 // Only script-sent events count (sourceType 'Server'); a player's /scriptevent or a command block is ignored.
 function handle(id,message,sourceType='Server'){
  if(sourceType!=='Server')return false;
  if(id===EVENTS.ping){announce();return true;}
  if(id!==EVENTS.catalogRequest&&id!==EVENTS.heatRegister&&id!==EVENTS.heatRequest&&id!==EVENTS.heatAdd)return false;
  let m;try{m=JSON.parse(message);}catch{return false;}
  if(!m||typeof m!=='object'||m.api!==API||typeof m.source!=='string'||!SOURCE.test(m.source)||m.source===NS)return false;
  try{
   if(id===EVENTS.catalogRequest)catalog(m);
   else if(id===EVENTS.heatRegister)heatRegister(m);
   else heat(m,id===EVENTS.heatAdd);
  }catch(error){log(id+': '+error);}
  return true;
 }
 return {handle,announce};
}
