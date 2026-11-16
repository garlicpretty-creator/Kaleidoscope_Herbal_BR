import {id} from '../data/herbs.js';
import {hand,heldId,drop,feedback,damageTool} from '../utils/items.js';
import {growthBoost} from '../utils/awwWorld.js';
import {emitEvt} from '../utils/bus.js';
const GROWTH=/** @type {any} */(id('growth')),MATURE=3;
// Understory ginseng: shade only, slow, and bone meal does nothing.
export const GINSENG_LIGHT={min:4,max:11},GINSENG_CHANCE=.08;
export const canGrowGinseng=light=>light>=GINSENG_LIGHT.min&&light<=GINSENG_LIGHT.max;
export const ginsengCrop={
 onRandomTick({block}){
  const age=Number(block.permutation.getState(GROWTH)??0);
  // v1.2.12: twice as likely while an A Witch Way sky event runs in this dimension
  if(age>=MATURE||Math.random()>=GINSENG_CHANCE*growthBoost(block.dimension?.id)||!canGrowGinseng(block.getLightLevel()))return;
  block.setPermutation(block.permutation.withState(GROWTH,age+1));
 },
 onPlayerInteract({block,player=undefined}){
  if(!player)return;
  const age=Number(block.permutation.getState(GROWTH)??0),slot=hand(player);
  if(age<MATURE||heldId(slot)!==id('herbal_trowel'))return;
  // Digging the root lifts the whole plant.
  drop(block,id('fresh_ginseng'),1);drop(block,id('ginseng_seeds'),1+Math.floor(Math.random()*2));
  damageTool(player,slot);feedback(block,'minecraft:crop_growth_emitter','dig.grass');
  block.setType('minecraft:air');
  emitEvt('herb_harvested',player,{herb:'ginseng',wild:false});
 },
};
