import {ItemStack,MolangVariableMap,system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {POWDER_ITEMS,MIN_POWDERS,MAX_POWDERS,STROKES,DOSES,mixResult,strangeMark,mixColor} from '../data/powders.js';
import {SLIP,FORMULA,slipLore} from '../data/prescription.js';
import {PILL_COUNT,HONEY,pillFor,pillAccepts,pillReady,isPillMaking,isMedicine} from '../data/pills.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,give,drop,feedback,refuse} from '../utils/items.js';
import {emitEvt} from '../utils/bus.js';
import {playFrames} from '../utils/frames.js';
// v1.1.0 藥缽: the mixing bowl. Put in two or three powders, pound three times with an empty hand, and take
// two doses of what they make. It no longer grinds herbs; Cookery's millstone does that.
// v1.2.0: or two doses of one medicinal powder and a bottle of honey, rolled into four honey pills.
const FILLED=id('filled'),SALT=id('salt'),PESTLE=id('pestle');
// v1.1.0: one stroke. The pestle rises, strikes (a knock and a puff in the powders' colour) and settles; ticks from the click.
const STRIKE=3,SETTLE=7;
function pound(block,powders,pitch,sound='dig.stone'){
 const color=mixColor(powders);
 playFrames(block,[{at:0,states:{[PESTLE]:1}},{at:STRIKE,states:{[PESTLE]:2},then:b=>{
  const at={x:b.x+.5,y:b.y+.4,z:b.z+.5};
  try{const v=new MolangVariableMap();v.setColorRGB('variable.color',{red:color[0],green:color[1],blue:color[2]});b.dimension.spawnParticle(id('powder_puff'),at,v);}catch{}
  try{b.dimension.playSound(sound,at,{volume:.5,pitch});}catch{}
 }},{at:SETTLE,states:{[PESTLE]:0}}]);
}
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
 const result=mixResult(r.powders,worldSalt());pound(block,r.powders,1.25);
 const stack=new ItemStack(result.item,DOSES);
 if(result.mark!==undefined)stack.setLore([strangeMark(result.mark)]);
 // The record goes first: a crash after this point loses the doses, never duplicates the powders.
 removeRecord(r.key);sync(block,undefined);
 if(result.formula)lastMix.set(blockKey(block),result.formula);else lastMix.delete(blockKey(block));
 // The doses appear as the last stroke lands and settle on the mortar instead of bouncing away. This runs even
 // if the mortar is broken meanwhile: the powders are already used up.
 const dimension=block.dimension,at={x:block.location.x+.5,y:block.location.y+.45,z:block.location.z+.5};
 system.runTimeout(()=>{
  try{const entity=dimension.spawnItem(stack,at);try{entity.clearVelocity();}catch{}}catch(error){console.warn('[Herbal] mortar: '+error);return;}
  try{dimension.spawnParticle('minecraft:crop_growth_emitter',at);dimension.playSound(result.formula?'random.orb':'random.fizz',at,{volume:.45,pitch:1});}catch{}
 },STRIKE+1);
 emitEvt('powder_mixed',player,{id:result.item});
}
// v1.2.0: two doses of one powder and a bottle of honey roll into four honey pills; the bottle comes back.
function roll(block,player,r,powder){
 pound(block,r.powders,1.1,'dig.cloth');
 removeRecord(r.key);sync(block,undefined);lastMix.delete(blockKey(block));
 const pill=pillFor(powder),pills=new ItemStack(pill,PILL_COUNT);
 const dimension=block.dimension,at={x:block.location.x+.5,y:block.location.y+.45,z:block.location.z+.5};
 system.runTimeout(()=>{
  for(const stack of [pills,new ItemStack('minecraft:glass_bottle',1)]){
   try{const entity=dimension.spawnItem(stack,at);try{entity.clearVelocity();}catch{}}catch(error){console.warn('[Herbal] mortar: '+error);}
  }
  try{dimension.spawnParticle('minecraft:crop_growth_emitter',at);dimension.playSound('random.orb',at,{volume:.4,pitch:1.3});}catch{}
 },STRIKE+1);
 emitEvt('powder_mixed',player,{id:pill,from:powder,pill:true});
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
  if(POWDER_ITEMS.has(held)||held===HONEY||isMedicine(held)){
   const verdict=pillAccepts(r?.powders??[],held,i=>POWDER_ITEMS.has(i));
   if(verdict!=='ok'){refuse(block,verdict);return;}
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
  const making=isPillMaking(r.powders),powder=making?pillReady(r.powders):undefined;
  if(making?!powder:r.powders.length<MIN_POWDERS){refuse(block,'fizz');return;}
  r.strokes=(r.strokes??0)+1;
  if(r.strokes<STROKES){saveRecord(r);if(making)pound(block,r.powders,.9+r.strokes*.1,'dig.cloth');else pound(block,r.powders,.8+r.strokes*.15);return;}
  if(making)roll(block,player,r,powder);else mix(block,player,r);
 },
 onPlayerBreak({block}){spillMortar(block);},
 onBreak({block}){spillMortar(block);},
};
