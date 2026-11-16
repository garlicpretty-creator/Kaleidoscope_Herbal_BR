import {ItemStack,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {POWDER_ITEMS,MIN_POWDERS,MAX_POWDERS,STROKES,DOSES,mixResult,strangeMark} from '../data/powders.js';
import {SLIP,FORMULA,slipLore} from '../data/prescription.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,give,drop,feedback,refuse} from '../utils/items.js';
import {emitEvt} from '../utils/bus.js';
// v1.1.0 藥缽: the mixing bowl. Put in two or three powders, pound three times with an empty hand, and take
// two doses of what they make. It no longer grinds herbs; Cookery's millstone does that.
const FILLED=id('filled'),SALT=id('salt');
// The formula of the last good mix in each mortar, kept until the next powder goes in or the server restarts.
const lastMix=new Map();
function sync(block,r){try{setStates(block,{[FILLED]:!!r?.powders?.length});}catch{}}
// One number per world decides which effect each wrong mix gives.
export function worldSalt(){
 let salt=world.getDynamicProperty(SALT);
 if(typeof salt!=='number'){salt=Math.floor(Math.random()*0x7fffffff);world.setDynamicProperty(SALT,salt);}
 return salt;
}
export function spillMortar(block){
 const r=getRecord(block);lastMix.delete(blockKey(block));if(!r||r.type!=='mortar')return;
 for(const item of r.powders??[])drop(block,item);
 removeRecord(r.key);
}
function mix(block,player,r){
 const result=mixResult(r.powders,worldSalt());
 const stack=new ItemStack(result.item,DOSES);
 if(result.mark!==undefined)stack.setLore([strangeMark(result.mark)]);
 // The record goes first: a crash after this point loses the doses, never duplicates the powders.
 removeRecord(r.key);sync(block,undefined);
 block.dimension.spawnItem(stack,{x:block.location.x+.5,y:block.location.y+.55,z:block.location.z+.5});
 if(result.formula)lastMix.set(blockKey(block),result.formula);else lastMix.delete(blockKey(block));
 feedback(block,'minecraft:crop_growth_emitter',result.formula?'random.orb':'random.fizz');
 emitEvt('powder_mixed',player,{id:result.item});
}
export const mortar={
 onPlace({block}){if(isRedraw(block,'mortar'))return;sync(block,undefined);},
 onPlayerInteract({block,player=undefined}){
  if(!player)return;
  const slot=hand(player);if(!slot)return;
  const held=heldId(slot),key=blockKey(block);let r=getRecord(block);
  if(r&&r.type!=='mortar')return;
  if(held===SLIP){
   // Copy the mix that was just made; an empty or half-filled mortar has nothing to copy.
   const formula=lastMix.get(key);if(!player.isSneaking||!formula){refuse(block,'fizz');return;}
   const stack=slot.getItem();stack.setDynamicProperty(FORMULA,JSON.stringify(formula));stack.setLore(slipLore(formula));slot.setItem(stack);
   feedback(block,'minecraft:crop_growth_emitter','item.book.page_turn');return;
  }
  if(POWDER_ITEMS.has(held)){
   if((r?.powders?.length??0)>=MAX_POWDERS){refuse(block,'full');return;}
   r??={...newRecord(block,'mortar'),powders:[],strokes:0};
   r.powders.push(held);r.strokes=0;saveRecord(r);takeOne(player,slot);lastMix.delete(key);
   sync(block,r);feedback(block,'minecraft:basic_smoke_particle','dig.sand');return;
  }
  if(held){refuse(block,'wrong');return;}
  if(!r?.powders?.length){refuse(block,'fizz');return;}
  if(player.isSneaking){
   const item=r.powders.pop();r.strokes=0;
   if(r.powders.length)saveRecord(r);else removeRecord(r.key);
   give(player,item);sync(block,getRecord(block));feedback(block,'minecraft:basic_smoke_particle','dig.sand');return;
  }
  if(r.powders.length<MIN_POWDERS){refuse(block,'fizz');return;}
  r.strokes=(r.strokes??0)+1;
  if(r.strokes<STROKES){saveRecord(r);feedback(block,'minecraft:basic_smoke_particle','dig.stone',.8+r.strokes*.15);return;}
  mix(block,player,r);
 },
 onPlayerBreak({block}){spillMortar(block);},
 onBreak({block}){spillMortar(block);},
};
