import {ItemStack,system} from '@minecraft/server';
import {SOUPS} from '../data/placeableSoups.js';
import {FOOD_EFFECTS} from '../data/decoctions.js';
import {blockKey} from '../utils/blockStore.js';
import {hand,heldId,giveStack,creative} from '../utils/items.js';
import {applyHeat} from '../utils/constitution.js';
import {emitEvt} from '../utils/bus.js';
const pending=new Map();
function queue(block,permutation,suppress=false,priority=0){
 const type=permutation?.type.id;if(!SOUPS[type])return;
 const key=blockKey(block),old=pending.get(key);
 if(old){if(priority>=old.priority)Object.assign(old,{type,suppress,priority});return;}
 const r={type,suppress,priority,dimension:block.dimension,location:block.center()};pending.set(key,r);
 system.runTimeout(()=>{if(pending.get(key)===r)pending.delete(key);if(!r.suppress)r.dimension.spawnItem(new ItemStack(r.type),r.location);},2);
}
export function spillExplodedSoup({block,explodedBlockPermutation}){queue(block,explodedBlockPermutation,false,1);}
export const herbalSoup={
 onPlace({block}){pending.delete(blockKey(block));},
 onBreak({block,brokenBlockPermutation}){queue(block,brokenBlockPermutation);},
 onPlayerBreak({block,brokenBlockPermutation,player=undefined}){queue(block,brokenBlockPermutation,player?creative(player):false,1);},
 onPlayerInteract({block,player=undefined}){
  if(!player||heldId(hand(player)))return;
  const food=SOUPS[block.typeId];if(!food)return;
  if(player.isSneaking)giveStack(player,new ItemStack(block.typeId));
  else{
   giveStack(player,new ItemStack('minecraft:bowl'));
   const hunger=player.getComponent('minecraft:player.hunger'),saturation=player.getComponent('minecraft:player.saturation');
   if(hunger)hunger.setCurrentValue(Math.min(hunger.effectiveMax,hunger.currentValue+food.nutrition));
   if(saturation)saturation.setCurrentValue(Math.min(saturation.effectiveMax,saturation.currentValue+food.nutrition*food.saturation*2));
   const data=FOOD_EFFECTS[block.typeId];
   for(const name of data?.clear??[])player.removeEffect(name);
   for(const effect of data?.effects??[])player.addEffect(effect.name,effect.ticks,{amplifier:effect.amplifier,showParticles:true});
   applyHeat(player,block.typeId);emitEvt('ate_placed',player,{id:block.typeId,kind:'soup'});
   try{block.dimension.playSound('random.drink',player.location,{volume:.45,pitch:1});}catch{}
  }
  queue(block,block.permutation,true,2);block.setType('minecraft:air');
 },
};
