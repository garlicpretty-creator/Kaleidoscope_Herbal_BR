import {world,system} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {blockKey,setStates} from './blockStore.js';
import {onHerbalEntityLoad} from './herbalEntities.js';
// The moving part exists only while a stroke plays; idle stations are plain blocks with no entity.
const visuals=new Map(),KINDS=new Set(['mortar','herb_grinder_decor']);
const state=id('animating');
function setHidden(block,value){
 try{setStates(block,{[state]:value});}catch{}
}
export function stopStationAnimation(block){
 const key=blockKey(block),r=visuals.get(key);if(r){try{world.getEntity(r.entity)?.remove();}catch{}visuals.delete(key);}setHidden(block,false);
}
// Cheap per-block check: a hidden static part with no live stroke is shown again.
export function settleStationVisual(block){if(!visuals.has(blockKey(block)))setHidden(block,false);}
function spawnVisual(block,kind){
 const key=blockKey(block);let entity;
 try{
  const facing=String(block.permutation.getState(/** @type {any} */('minecraft:cardinal_direction'))??'north');
  const yaw=({north:180,east:-90,south:0,west:90})[facing]??180;
  entity=block.dimension.spawnEntity(id(kind+'_visual'),{x:block.x+.5,y:block.y,z:block.z+.5},{initialRotation:yaw});
  entity.setDynamicProperty(id('visual_owner'),JSON.stringify({key,kind,location:{...block.location}}));
  const record={key,entity:entity.id,dimension:block.dimension.id,location:{...block.location},kind,remaining:0,sequence:0,queue:[]};
  visuals.set(key,record);ensureStrokeLoop();
  // Hide the static part only once the client has had time to draw the moving one.
  system.runTimeout(()=>{if(visuals.get(key)===record)try{setHidden(block,true);}catch{}},2);
  return record;
 }catch(error){
  try{entity?.remove();}catch{}visuals.delete(key);setHidden(block,false);
  console.warn('[Herbal] Could not create station moving part: '+error);return undefined;
 }
}
export function playStationAnimation(block,kind,ticks=20){
 if(!KINDS.has(kind)||block.typeId!==id(kind))return;
 const key=blockKey(block);let r=visuals.get(key);
 if(r&&!world.getEntity(r.entity)){visuals.delete(key);r=undefined;}
 r??=spawnVisual(block,kind);if(!r)return;
 if(r.remaining>0){if(r.queue.length<8)r.queue.push(Math.max(1,ticks));return;}
 beginStroke(r,world.getEntity(r.entity),ticks);
}
function beginStroke(r,entity,ticks){r.remaining=Math.max(1,ticks);r.sequence=(r.sequence%1000000)+1;entity.setProperty(id('stroke'),r.sequence);entity.setProperty(id('using'),true);}
// v1.2.6: the stroke timer runs only while a moving part exists (was every 4 ticks for good).
let strokeLoop;
function ensureStrokeLoop(){if(strokeLoop===undefined)strokeLoop=system.runInterval(advanceStrokes,4);}
function advanceStrokes(){
  for(const [key,r]of visuals){
   let block;try{block=world.getDimension(r.dimension).getBlock(r.location);}catch{continue;}if(!block)continue;
   const entity=world.getEntity(r.entity);
   if(!entity||block.typeId!==id(r.kind)){try{entity?.remove();}catch{}setHidden(block,false);visuals.delete(key);continue;}
   r.remaining=Math.max(0,r.remaining-4);if(r.remaining)continue;
   const next=r.queue.shift();
   if(next)beginStroke(r,entity,next);
   else{try{entity.remove();}catch{}visuals.delete(key);setHidden(block,false);}
  }
 if(!visuals.size&&strokeLoop!==undefined){system.clearRun(strokeLoop);strokeLoop=undefined;}
}
export function startStationAnimations(){
 // Strokes never survive a reload; any saved moving part is a leftover and is cleared.
 onHerbalEntityLoad((entity,type)=>{
  if(!type.endsWith('_visual'))return;
  system.run(()=>{try{
   const raw=entity.getDynamicProperty(id('visual_owner'));
   const r=typeof raw==='string'?JSON.parse(raw):undefined;
   if(r&&visuals.get(r.key)?.entity===entity.id)return;
   const block=r?.location?entity.dimension.getBlock(r.location):undefined;
   entity.remove();if(block)setHidden(block,false);
  }catch(error){console.warn('[Herbal] Station recovery: '+error);}});
 });

}
