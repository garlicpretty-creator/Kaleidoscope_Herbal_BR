import {id} from '../data/herbs.js';
import {hand,heldId,drop,feedback,damageTool,refuse} from '../utils/items.js';
import {growthBoost} from '../utils/awwWorld.js';
import {emitEvt} from '../utils/bus.js';
import {ripeAround} from './cropGrowth.js';
const GROWTH=/** @type {any} */(id('growth')),MATURE=3,TROWEL=id('herbal_trowel');
// Understory ginseng: shade only, slow, and bone meal does nothing.
export const GINSENG_LIGHT={min:4,max:11},GINSENG_CHANCE=.08;
export const canGrowGinseng=light=>light>=GINSENG_LIGHT.min&&light<=GINSENG_LIGHT.max;
// Digging the root lifts the whole plant.
function dig(block,player,slot){
 drop(block,id('fresh_ginseng'),1);drop(block,id('ginseng_seeds'),1+Math.floor(Math.random()*2));
 damageTool(player,slot);feedback(block,'minecraft:crop_growth_emitter','dig.grass');
 block.setType('minecraft:air');
 emitEvt('herb_harvested',player,{herb:'ginseng',wild:false});
}
export const ginsengCrop={
 onRandomTick({block}){
  const age=Number(block.permutation.getState(GROWTH)??0);
  // v1.2.12: twice as likely while an A Witch Way sky event runs in this dimension
  if(age>=MATURE||Math.random()>=GINSENG_CHANCE*growthBoost(block.dimension?.id)||!canGrowGinseng(block.getLightLevel()))return;
  block.setPermutation(block.permutation.withState(GROWTH,age+1));
 },
 onPlayerInteract({block,player=undefined}){
  if(!player)return;
  const age=Number(block.permutation.getState(GROWTH)??0),slot=hand(player),held=heldId(slot);
  // v1.4.0: bone meal is turned away with the low note and a grey puff, and stays in the hand.
  if(held==='minecraft:bone_meal'){refuse(block,'wrong');return;}
  if(age<MATURE)return;
  // A ripe root will not come up for the bare hand or any other tool.
  if(held!==TROWEL){refuse(block,'wrong');return;}
  // v1.4.0: sneaking digs every ripe root in the 3x3, each wearing the trowel as one dig would.
  const roots=player.isSneaking?ripeAround(block,MATURE):[block];
  for(const root of roots){if(heldId(slot)!==TROWEL)break;dig(root,player,slot);}
 },
};
