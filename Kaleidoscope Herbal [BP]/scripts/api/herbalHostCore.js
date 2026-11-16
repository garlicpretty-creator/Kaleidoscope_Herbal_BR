// v1.1.0: the Herbal host API (docs/API.md). Other packs talk to Herbal over script events in the
// `kaleidoscope_herbal` namespace, the same ping/ready pattern Cookery and Tavern use.
// This file imports nothing from the game, so tests/ runs it under Node; herbalHost.js wires it to the world.
export const API=1,NS='kaleidoscope_herbal';
export const EVENTS=Object.freeze({
 ping:NS+':api_ping',ready:NS+':api_ready',
 catalogRequest:NS+':catalog_request',catalog:NS+':catalog',
 heatRegister:NS+':heat_register',heatAck:NS+':heat_ack',
 heatRequest:NS+':heat_request',heatAdd:NS+':heat_add',heat:NS+':heat',
 recipeRegister:NS+':recipe_register',recipeAck:NS+':recipe_ack',
 adjuvantRegister:NS+':adjuvant_register',adjuvantAck:NS+':adjuvant_ack',
 evt:NS+':evt',
});
export const CAPABILITIES=Object.freeze(['events','catalog','constitution','constitution_write','external_heat','heat_source_tag','external_recipes','external_adjuvants']);
export const LIMITS=Object.freeze({externalHeat:256,itemsPerMessage:32,heatMax:100,heatAddMax:50,heatAddCooldown:20,packetBytes:1800,
 // v1.2.0: recipeIngredients and recipeServingsMax mirror the clay pot (MAX_INGREDIENTS, MAX_SERVINGS in data/decoctions.js).
 externalRecipes:64,recipesPerMessage:8,recipeIngredients:6,recipeServingsMax:4,recipeTimeMin:200,recipeTimeMax:2400,recipeTimeDefault:600,
 externalAdjuvants:32,adjuvantServingsMax:1,
 // v1.2.1: a reply is cut to fit one script event; a player takes at most this many heat pushes a second from all packs together.
 ackBytes:1900,heatAddsPerPlayer:2});
// The part of LIMITS a client needs, sent with api_ready.
const PUBLIC_LIMITS=Object.freeze(Object.fromEntries(['externalHeat','itemsPerMessage','heatAddMax','heatAddsPerPlayer','externalRecipes','recipesPerMessage','recipeIngredients',
 'recipeServingsMax','recipeTimeMin','recipeTimeMax','externalAdjuvants','adjuvantServingsMax'].map(k=>[k,LIMITS[k]])));
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
 *  externalRecipes?:Map<string,{result:string,ingredients:string[],servings:number,time:number,source:string}>,
 *  externalAdjuvants?:Map<string,{servings:number,source:string}>, matchBuiltin?:(items:string[])=>any, itemExists?:(id:string)=>boolean,
 *  sameMix?:(a:string[],b:string[])=>boolean,
 *  log?:(text:string)=>void}} deps
 */
export function createHerbalHost(deps){
 const {send,now,version,catalogs,externalHeat,ownsItem,getPlayer,getHeat,shiftHeat,log=()=>{}}=deps;
 const {externalRecipes=new Map(),externalAdjuvants=new Map(),matchBuiltin=()=>undefined,itemExists=()=>true}=deps;
 const {sameMix=(a,b)=>a.join('|')===b.join('|')}=deps;
 const lastAdd=new Map(),pushes=new Map();
 const out=(id,body)=>{try{send(id,JSON.stringify({api:API,...body}));}catch(error){log('send '+id+': '+error);}};
 const announce=()=>out(EVENTS.ready,{source:NS,version,capabilities:CAPABILITIES,limits:PUBLIC_LIMITS});
 // v1.2.1: req goes back as it came (a number stays a number); a string longer than 32 characters is cut.
 const req=m=>typeof m.req==='string'?m.req.slice(0,32):Number.isFinite(m.req)?m.req:undefined;
 // v1.2.1: 32 refusals with long ids would pass the 2048-character limit and the reply would be lost; rows are dropped
 // off the end until it fits, and `more` says how many.
 function ack(id,body){
  let more=0;
  while(body.rejected.length&&JSON.stringify({api:API,...body,more:more||undefined}).length>LIMITS.ackBytes){body.rejected.pop();more++;}
  out(id,more?{...body,more}:body);
 }
 function catalog(m){
  const build=typeof m.kind==='string'&&Object.hasOwn(catalogs,m.kind)?catalogs[m.kind]:undefined; // not catalogs['constructor']
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
  ack(EVENTS.heatAck,{to:m.source,req:req(m),ok:rejected.length===0,accepted,rejected});
 }
 // v1.2.0, shared by recipe_register and adjuvant_register: the reply lists what was refused and why.
 function ledger(m,event){
  const rejected=[];let accepted=0;
  return {accept:()=>{accepted++;},reject:(id,code)=>{rejected.push({id:typeof id==='string'?id.slice(0,96):null,code});},
   fail:code=>out(event,{to:m.source,req:req(m),ok:false,code,accepted,rejected}),
   done:()=>ack(event,{to:m.source,req:req(m),ok:rejected.length===0,accepted,rejected})};
 }
 const reserved=id=>RESERVED.has(id.split(':')[0])||ownsItem(id);
 // v1.2.0: ingredients arrive as [{id,count}] and are kept flat, one entry per item put in the pot.
 function flatten(list){
  if(!Array.isArray(list)||!list.length||list.length>LIMITS.recipeIngredients)return undefined;
  const flat=[];
  for(const row of list){
   const id=row?.id,count=row?.count??1;
   if(typeof id!=='string'||!ITEM.test(id)||!Number.isInteger(count)||count<1||flat.length+count>LIMITS.recipeIngredients)return undefined;
   for(let i=0;i<count;i++)flat.push(id);
  }
  return flat.sort();
 }
 function recipeRegister(m){
  const {accept,reject,fail,done}=ledger(m,EVENTS.recipeAck);
  if(!Array.isArray(m.recipes)||m.recipes.length>LIMITS.recipesPerMessage){fail('BAD_RECIPES');return;}
  for(const row of m.recipes){
   const id=row?.id,servings=row?.servings,time=row?.time??LIMITS.recipeTimeDefault;
   if(typeof id!=='string'||!ITEM.test(id)){reject(id,'BAD_ID');continue;}
   if(reserved(id)){reject(id,'RESERVED');continue;}
   const held=externalRecipes.get(id);
   if(held&&held.source!==m.source){reject(id,'TAKEN');continue;} // first pack to claim an output keeps it
   if(servings===0){if(held)externalRecipes.delete(id);accept();continue;} // 0 withdraws the pack's own recipe
   if(!Number.isInteger(servings)||servings<1||servings>LIMITS.recipeServingsMax){reject(id,'BAD_SERVINGS');continue;}
   if(!Number.isInteger(time)||time<LIMITS.recipeTimeMin||time>LIMITS.recipeTimeMax){reject(id,'BAD_TIME');continue;}
   const ingredients=flatten(row.ingredients);
   if(!ingredients){reject(id,'BAD_INGREDIENTS');continue;}
   if(!itemExists(id)){reject(id,'UNKNOWN_ITEM');continue;}
   if(matchBuiltin(ingredients)){reject(id,'BUILTIN');continue;} // our own formulas cannot be shadowed
   // v1.2.1: sameMix also catches a sliced / unsliced pair of the same herbs, which the pot cannot tell apart.
   let clash=false;
   for(const other of externalRecipes.values())if(other.result!==id&&sameMix(other.ingredients,ingredients)){clash=true;break;}
   if(clash){reject(id,'TAKEN');continue;} // the same mix already brews something else
   if(!held&&externalRecipes.size>=LIMITS.externalRecipes){reject(id,'FULL');continue;}
   externalRecipes.set(id,{result:id,ingredients,servings,time,source:m.source});accept();
  }
  done();
 }
 function adjuvantRegister(m){
  const {accept,reject,fail,done}=ledger(m,EVENTS.adjuvantAck);
  if(!Array.isArray(m.items)||m.items.length>LIMITS.itemsPerMessage){fail('BAD_ITEMS');return;}
  for(const row of m.items){
   const id=row?.id,servings=row?.servings??1;
   if(typeof id!=='string'||!ITEM.test(id)){reject(id,'BAD_ID');continue;}
   if(reserved(id)){reject(id,'RESERVED');continue;}
   if(!Number.isInteger(servings)||servings<0||servings>LIMITS.adjuvantServingsMax){reject(id,'BAD_SERVINGS');continue;}
   const held=externalAdjuvants.get(id);
   if(held&&held.source!==m.source){reject(id,'TAKEN');continue;}
   if(servings===0){if(held)externalAdjuvants.delete(id);accept();continue;}
   if(!held&&externalAdjuvants.size>=LIMITS.externalAdjuvants){reject(id,'FULL');continue;}
   externalAdjuvants.set(id,{servings,source:m.source});accept();
  }
  done();
 }
 function heat(m,write){
  const reply=(body)=>out(EVENTS.heat,{to:m.source,req:req(m),p:typeof m.p==='string'?m.p.slice(0,64):null,...body});
  const player=typeof m.p==='string'?getPlayer(m.p):undefined;
  if(!player){reply({ok:false,code:'NO_PLAYER'});return;}
  if(!write){reply({ok:true,heat:getHeat(player)});return;}
  // v1.2.1: round first, so 0.4 is refused instead of being accepted as a push of 0 that uses up the second.
  const delta=Number.isFinite(m.delta)?Math.max(-LIMITS.heatAddMax,Math.min(LIMITS.heatAddMax,Math.round(m.delta))):0;
  if(delta===0){reply({ok:false,code:'BAD_DELTA'});return;}
  // One push per pack and player each second, so a looping pack cannot hold a player at the limit.
  const key=m.source+'|'+m.p,tick=now(),prev=lastAdd.get(key);
  if(prev!==undefined&&tick-prev<LIMITS.heatAddCooldown){reply({ok:false,code:'THROTTLED',heat:getHeat(player)});return;}
  // v1.2.1: `source` is only what the sender calls itself, so a pack could change names every tick; whatever the names,
  // one player takes at most heatAddsPerPlayer pushes a second.
  const recent=(pushes.get(m.p)??[]).filter(t=>tick-t<LIMITS.heatAddCooldown);
  if(recent.length>=LIMITS.heatAddsPerPlayer){reply({ok:false,code:'THROTTLED',heat:getHeat(player)});return;}
  if(lastAdd.size>512)for(const [k,t] of lastAdd)if(tick-t>=LIMITS.heatAddCooldown)lastAdd.delete(k);
  if(pushes.size>512)for(const [k,list] of pushes)if(list.every(t=>tick-t>=LIMITS.heatAddCooldown))pushes.delete(k);
  lastAdd.set(key,tick);recent.push(tick);pushes.set(m.p,recent);
  const result=shiftHeat(player,delta);
  reply({ok:true,heat:result.heat,applied:delta,...(result.effect?{effect:result.effect}:{})});
 }
 // Only script-sent events count (sourceType 'Server'); a player's /scriptevent or a command block is ignored.
 function handle(id,message,sourceType='Server'){
  if(sourceType!=='Server')return false;
  if(id===EVENTS.ping){announce();return true;}
  if(id!==EVENTS.catalogRequest&&id!==EVENTS.heatRegister&&id!==EVENTS.heatRequest&&id!==EVENTS.heatAdd&&id!==EVENTS.recipeRegister&&id!==EVENTS.adjuvantRegister)return false;
  let m;try{m=JSON.parse(message);}catch{return false;}
  if(!m||typeof m!=='object'||m.api!==API||typeof m.source!=='string'||!SOURCE.test(m.source)||m.source===NS)return false;
  try{
   if(id===EVENTS.catalogRequest)catalog(m);
   else if(id===EVENTS.heatRegister)heatRegister(m);
   else if(id===EVENTS.recipeRegister)recipeRegister(m);
   else if(id===EVENTS.adjuvantRegister)adjuvantRegister(m);
   else heat(m,id===EVENTS.heatAdd);
  }catch(error){log(id+': '+error);}
  return true;
 }
 return {handle,announce};
}
