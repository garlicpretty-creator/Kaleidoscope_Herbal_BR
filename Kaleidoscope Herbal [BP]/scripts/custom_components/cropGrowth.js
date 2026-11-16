import {HERBS,id} from '../data/herbs.js';
import {hand,heldId,takeOne,drop,feedback} from '../utils/items.js';
import {growthBoost} from '../utils/awwWorld.js';
export const cropGrowth={
 onRandomTick({block}){
  const age=Number(block.permutation.getState(id('growth'))??0);
  // v1.2.12: twice as likely while an A Witch Way sky event runs in this dimension
  if(age>=2||Math.random()>.2*growthBoost(block.dimension?.id)||block.getLightLevel()<9)return;
  block.setPermutation(block.permutation.withState(id('growth'),age+1));
 },
 onPlayerInteract({block,player=undefined}){
  if(!player)return;const age=Number(block.permutation.getState(id('growth'))??0),slot=hand(player);
  if(age<2&&heldId(slot)==='minecraft:bone_meal'){
   block.setPermutation(block.permutation.withState(id('growth'),age+1));takeOne(player,slot);feedback(block);return;
  }
  if(age!==2)return;
  const herb=HERBS.find(h=>block.typeId===id(h.key+'_crop'));if(!herb)return;
  drop(block,id(herb.fresh),1);if(Math.random()<.35)drop(block,id(herb.key+'_seeds'));
  block.setPermutation(block.permutation.withState(id('growth'),0));feedback(block);
 },
};
