import {ItemStack,system} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {FOOD_EFFECTS} from '../data/decoctions.js';
import {HERBAL_WINES} from '../data/tavernRecipes.js';
import {blockKey} from '../utils/blockStore.js';
import {hand,heldId,takeOne,giveStack,creative,refuse} from '../utils/items.js';
import {applyHeat} from '../utils/constitution.js';
import {emitEvt} from '../utils/bus.js';
const WINE_IDS=new Set(HERBAL_WINES.map(w=>id(w.key))),pending=new Map();
const COUNT=/** @type {any} */(id('bottle_count'));
function queue(block,permutation,suppress=false,priority=0){
 const type=permutation?.type.id;if(!WINE_IDS.has(type))return;
 const key=blockKey(block),count=Number(permutation.getState(COUNT)??1),old=pending.get(key);
 if(old){if(priority>=old.priority)Object.assign(old,{type,count,suppress,priority});return;}
 const r={type,count,suppress,priority,dimension:block.dimension,location:block.center()};pending.set(key,r);
 system.runTimeout(()=>{if(pending.get(key)===r)pending.delete(key);if(!r.suppress)r.dimension.spawnItem(new ItemStack(r.type,r.count),r.location);},2);
}
export function spillExplodedWine({block,explodedBlockPermutation}){queue(block,explodedBlockPermutation,false,1);}
function removeOne(block,count){if(count>1)block.setPermutation(block.permutation.withState(COUNT,count-1));else{queue(block,block.permutation,true,2);block.setType('minecraft:air');}}
export const herbalWine={
 onPlace({block}){pending.delete(blockKey(block));},
 onBreak({block,brokenBlockPermutation}){queue(block,brokenBlockPermutation);},
 onPlayerBreak({block,brokenBlockPermutation,player=undefined}){queue(block,brokenBlockPermutation,player?creative(player):false,1);},
 onPlayerInteract({block,player=undefined}){
  if(!player||!WINE_IDS.has(block.typeId))return;
  const count=Number(block.permutation.getState(COUNT)??1),slot=hand(player),held=heldId(slot);
  if(held===block.typeId){if(count>=4){refuse(block,'full');return;}block.setPermutation(block.permutation.withState(COUNT,count+1));takeOne(player,slot);return;}
  if(held)return;
  if(player.isSneaking){giveStack(player,new ItemStack(block.typeId));removeOne(block,count);return;}
  const data=FOOD_EFFECTS[block.typeId];if(!data)return;
  const wine=block.typeId;
  giveStack(player,new ItemStack('minecraft:glass_bottle'));removeOne(block,count);
  for(const name of data.clear??[])player.removeEffect(name);
  for(const effect of data.effects)player.addEffect(effect.name,effect.ticks,{amplifier:effect.amplifier,showParticles:true});
  applyHeat(player,wine);emitEvt('ate_placed',player,{id:wine,kind:'wine'});
  try{block.dimension.playSound('random.drink',player.location,{volume:.45,pitch:1});}catch{}
 },
};
