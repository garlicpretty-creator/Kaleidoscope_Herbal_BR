import {ItemStack} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {hand,heldId,takeOne,giveStack,feedback,refuse} from '../utils/items.js';
// Jars and parcels stack on one block; drops per count come from each permutation's loot table.
export const DECOR_STACKS={[id('medicine_jar')]:{state:id('jar_count'),max:3},[id('herb_packets')]:{state:id('pack_count'),max:4}};
export const decorStack={
 onPlayerInteract({block,player=undefined}){
  const stack=DECOR_STACKS[block.typeId];if(!player||!stack)return;
  const state=/** @type {any} */(stack.state),count=Number(block.permutation.getState(state)??1),slot=hand(player),held=heldId(slot);
  if(held===block.typeId){
   if(count>=stack.max){refuse(block,'full');return;}
   block.setPermutation(block.permutation.withState(state,count+1));takeOne(player,slot);
   feedback(block,'minecraft:crop_growth_emitter','dig.wood');return;
  }
  if(held||!player.isSneaking)return;
  giveStack(player,new ItemStack(block.typeId));
  if(count>1)block.setPermutation(block.permutation.withState(state,count-1));
  else block.setType('minecraft:air');
 },
};
