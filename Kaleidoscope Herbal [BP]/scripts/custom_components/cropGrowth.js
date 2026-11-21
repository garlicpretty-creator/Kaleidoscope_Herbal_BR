import {HERBS,id} from '../data/herbs.js';
import {hand,heldId,takeOne,drop,feedback,damageTool} from '../utils/items.js';
import {growthBoost} from '../utils/awwWorld.js';
import {blockAt} from '../utils/blockStore.js';
import {emitEvt} from '../utils/bus.js';
const GROWTH=/** @type {any} */(id('growth'));
// Sneak-using a ripe herb with the trowel or any hoe lifts every ripe herb of that kind in the 3x3 around it.
export const isAreaTool=item=>item===id('herbal_trowel')||/:(?:[a-z0-9_]*_)?hoe$/.test(item??'');
// The clicked spot first, then the eight around it on the same level.
export function areaAround(location){
 const spots=[{...location}];
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz)spots.push({x:location.x+dx,y:location.y,z:location.z+dz});
 return spots;
}
// The ripe blocks of this crop's kind in the 3x3, the clicked one first.
export function ripeAround(block,ripe){
 const found=[];
 for(const p of areaAround(block.location)){
  const b=p.x===block.location.x&&p.z===block.location.z?block:blockAt(block.dimension,p);
  if(b?.typeId===block.typeId&&Number(b.permutation.getState(GROWTH)??0)===ripe)found.push(b);
 }
 return found;
}
function harvest(block,herb,player){
 drop(block,id(herb.fresh),1);if(Math.random()<.35)drop(block,id(herb.key+'_seeds'));
 block.setPermutation(block.permutation.withState(GROWTH,0));feedback(block);
 emitEvt('herb_harvested',player,{herb:herb.key,wild:false});
}
export const cropGrowth={
 onRandomTick({block}){
  const age=Number(block.permutation.getState(GROWTH)??0);
  // v1.2.12: twice as likely while an A Witch Way sky event runs in this dimension
  if(age>=2||Math.random()>.2*growthBoost(block.dimension?.id)||block.getLightLevel()<9)return;
  block.setPermutation(block.permutation.withState(GROWTH,age+1));
 },
 onPlayerInteract({block,player=undefined}){
  if(!player)return;const age=Number(block.permutation.getState(GROWTH)??0),slot=hand(player);
  if(age<2&&heldId(slot)==='minecraft:bone_meal'){
   block.setPermutation(block.permutation.withState(GROWTH,age+1));takeOne(player,slot);feedback(block);return;
  }
  if(age!==2)return;
  const herb=HERBS.find(h=>block.typeId===id(h.key+'_crop'));if(!herb)return;
  if(!player.isSneaking||!isAreaTool(heldId(slot))){harvest(block,herb,player);return;}
  // v1.3.2: one sweep, one wear on the tool.
  for(const b of ripeAround(block,2))harvest(b,herb,player);
  damageTool(player,slot);
 },
};
