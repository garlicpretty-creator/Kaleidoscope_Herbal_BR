import {ItemStack,system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {blockKey} from '../utils/blockStore.js';
import {creative} from '../utils/items.js';

const pending=new Map();
export const isDawn=time=>time>=23000||time<=1000;

// onBreak also runs for player/explosion destruction. Briefly defer so the
// specific event can select dawn flowers or suppress a creative-mode harvest.
function queueDrop(block,flower,priority){
 const key=blockKey(block),existing=pending.get(key);
 if(existing){
  if(priority>=existing.priority){existing.flower=flower;existing.priority=priority;}
  return;
 }
 const record={flower,priority,dimension:block.dimension,location:{x:block.x+.5,y:block.y+.5,z:block.z+.5}};
 pending.set(key,record);
 system.runTimeout(()=>{
  if(pending.get(key)===record)pending.delete(key);
  if(!record.flower)return;
  record.dimension.spawnItem(new ItemStack(id(record.flower)),record.location);
  record.dimension.spawnItem(new ItemStack(id('honeysuckle_seeds')),record.location);
 },2);
}

export const wildHoneysuckle={
 onPlace({block}){pending.delete(blockKey(block));},
 onBreak({block}){queueDrop(block,'honeysuckle',0);},
};

export function handleHoneysuckleHarvest(event){
 if(event.brokenBlockPermutation.type.id!==id('wild_honeysuckle'))return;
 const flower=creative(event.player)?undefined:isDawn(world.getTimeOfDay())?'dewy_honeysuckle':'honeysuckle';
 queueDrop(event.block,flower,1);
}

export function handleHoneysuckleExplosion({block,explodedBlockPermutation}){
 if(explodedBlockPermutation.type.id===id('wild_honeysuckle'))queueDrop(block,'honeysuckle',1);
}
