import {world,system} from '@minecraft/server';
const PREFIX='kaleidoscope_herbal:block/';
const records=new Map();
export const blockKey=block=>`${block.dimension.id}|${block.location.x}|${block.location.y}|${block.location.z}`;
export function readStore(){
 records.clear();
 for(const property of world.getDynamicPropertyIds()){
  if(!property.startsWith(PREFIX))continue;
  try{const record=JSON.parse(String(world.getDynamicProperty(property)));if(record&&record.key)records.set(record.key,record);}
  catch(error){console.warn(`[Herbal] Cannot read saved block ${property}: ${error}`);}
 }
 return records;
}
export const getRecord=key=>records.get(typeof key==='string'?key:blockKey(key));
export function saveRecord(record){
 // Write before confirming a consumed input or a persistent state transition.
 world.setDynamicProperty(PREFIX+record.key,JSON.stringify(record));records.set(record.key,record);
}
export function removeRecord(key){world.setDynamicProperty(PREFIX+key,undefined);records.delete(key);}
export function newRecord(block,type){return {key:blockKey(block),dimension:block.dimension.id,location:{...block.location},type};}
// The block at a location, or undefined when its chunk is not loaded or the location is outside the world.
export function blockAt(dimension,location){try{return dimension.getBlock(location);}catch{return undefined;}}
export function loadedBlock(record){
 try{return world.getDimension(record.dimension).getBlock(record.location);}catch{return undefined;}
}
export const allRecords=()=>records.values();
// Bedrock (BDS 1.26.52, @minecraft/server 2.7.0) also runs a block's onPlace when a script calls
// setPermutation on it, and previousBlock cannot tell the two apart. Every station redraw goes through
// setStates, which stamps the position, so onPlace can ignore its own redraws (isRedraw).
const writes=new Map(),WRITE_WINDOW=2;
// Writes only the states that differ; returns whether anything was written.
export function setStates(block,want){
 let perm=block.permutation,changed=false;
 for(const [state,value] of Object.entries(want))if(perm.getState(/** @type {any} */(state))!==value){perm=perm.withState(/** @type {any} */(state),value);changed=true;}
 if(!changed)return false;
 const now=system.currentTick;
 if(writes.size>4096)for(const [key,tick] of writes)if(now-tick>WRITE_WINDOW)writes.delete(key);
 writes.set(blockKey(block),now);block.setPermutation(perm);return true;
}
// True when onPlace was caused by our own redraw, or the position still holds a live record of this
// station (a real re-placement always passes through break or explosion first, which clears it).
export function isRedraw(block,type){
 const tick=writes.get(blockKey(block));
 if(tick!==undefined&&system.currentTick-tick<=WRITE_WINDOW)return true;
 return !!type&&getRecord(block)?.type===type;
}
