import {id} from './herbs.js';
import {POWDER_FORMULAS} from './powders.js';
// v1.2.0 丸劑: two doses of one medicinal powder and a bottle of honey, rolled in the mortar, make four honey
// pills. A pill keeps its powder's effects at the same level, lasts 1.5 times as long and carries half the heat;
// it is eaten in a moment, so it suits a pack better than a bowl. Each powder has its own pill (明目散 -> 明目丸):
// the Script API keeps item data only on items that do not stack, so the kind has to be the item itself.
export const HONEY='minecraft:honey_bottle';
export const PILL_POWDERS=2,PILL_COUNT=4,PILL_TIME=1.5,PILL_HEAT=.5;
const BY_RESULT=new Map(POWDER_FORMULAS.map(f=>[f.result,f]));
// ming_mu_powder -> ming_mu_pill, and back.
export const pillFor=powder=>BY_RESULT.has(powder)?powder.replace(/_powder$/,'_pill'):undefined;
export const PILLS=new Map(POWDER_FORMULAS.map(f=>[pillFor(f.result),f.result]));
export const isPill=item=>PILLS.has(item);
export const powderOf=pill=>PILLS.get(pill);
export const isMedicine=item=>BY_RESULT.has(item);
// What a pill made from this powder does: same effects, longer; half the heat (rounded toward zero).
export function pillEffects(powder){
 const f=BY_RESULT.get(powder);if(!f)return undefined;
 return {from:powder,effects:f.effects.map(e=>({...e,ticks:Math.round(e.ticks*PILL_TIME)})),clear:f.clear,heat:Math.trunc((f.heat??0)*PILL_HEAT)};
}
// Whether this item may go into a mortar already holding `items`. Herb powders and pill makings never mix;
// a pill needs two of one powder and one honey. Returns 'ok', 'wrong' (does not belong) or 'full'.
export function pillAccepts(items,item,isHerbPowder){
 const making=items.some(i=>i===HONEY||isMedicine(i)),herbs=items.some(isHerbPowder);
 if(item===HONEY||isMedicine(item)){
  if(herbs)return 'wrong';
  if(item===HONEY)return items.includes(HONEY)?'full':'ok';
  const doses=items.filter(isMedicine);
  if(doses.length&&doses[0]!==item)return 'wrong';
  return doses.length>=PILL_POWDERS?'full':'ok';
 }
 return making?'wrong':'ok';
}
// The powder a full set of pill makings rolls into, or undefined while something is missing.
export function pillReady(items){
 const doses=items.filter(isMedicine);
 return items.length===PILL_POWDERS+1&&items.includes(HONEY)&&doses.length===PILL_POWDERS&&doses[0]===doses[1]?doses[0]:undefined;
}
export const isPillMaking=items=>items.some(i=>i===HONEY||isMedicine(i));
