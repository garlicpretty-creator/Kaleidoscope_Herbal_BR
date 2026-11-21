import {ItemStack,MolangVariableMap,system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {POWDER_ITEMS,MIN_POWDERS,MAX_POWDERS,STROKES,DOSES,mixResult,strangeMark,mixColor,batchSets} from '../data/powders.js';
import {SLIP,FORMULA,slipLore} from '../data/prescription.js';
import {PILL_COUNT,HONEY,pillFor,pillAccepts,pillReady,isPillMaking,isMedicine} from '../data/pills.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,give,drop,feedback,refuse,countItems,removeItems} from '../utils/items.js';
import {emitEvt} from '../utils/bus.js';
import {playFrames} from '../utils/frames.js';
// v1.1.0 藥缽: the mixing bowl. Put in two or three powders, pound three times with an empty hand, and take
// two doses of what they make. It no longer grinds herbs; Cookery's millstone does that.
// v1.2.0: or two doses of one medicinal powder and a bottle of honey, rolled into four honey pills.
const FILLED=id('filled'),SALT=id('salt'),PESTLE=id('pestle');
// v1.1.0: one stroke. The pestle rises, strikes (a knock and a puff in the powders' colour) and settles; ticks from the click.
const STRIKE=3,SETTLE=7;
function strike(b,color,sound,pitch){
 const at={x:b.x+.5,y:b.y+.4,z:b.z+.5};
 try{const v=new MolangVariableMap();v.setColorRGB('variable.color',{red:color[0],green:color[1],blue:color[2]});b.dimension.spawnParticle(id('powder_puff'),at,v);}catch{}
 try{b.dimension.playSound(sound,at,{volume:.5,pitch});}catch{}
}
function pound(block,powders,pitch,sound='dig.stone'){
 const color=mixColor(powders);
 playFrames(block,[{at:0,states:{[PESTLE]:1}},{at:STRIKE,states:{[PESTLE]:2},then:b=>strike(b,color,sound,pitch)},{at:SETTLE,states:{[PESTLE]:0}}]);
}
// v1.3.2: a sneak batch pounds stroke after stroke, BATCH_STEP ticks apart, each with its knock and puff.
// Returns the tick of the last strike, when the doses appear.
export const BATCH_STEP=4;
export function batchFrames(count,strikeAt){
 const frames=[];
 for(let i=0;i<count;i++){const t=i*BATCH_STEP;frames.push({at:t,states:{[PESTLE]:1}},{at:t+2,states:{[PESTLE]:2},then:b=>strikeAt(b,i)});}
 const last=(count-1)*BATCH_STEP+2;frames.push({at:last+SETTLE-STRIKE,states:{[PESTLE]:0}});
 return {frames,last};
}
function poundAll(block,powders,count,making){
 const color=mixColor(powders),{frames,last}=batchFrames(count,(b,i)=>strike(b,color,making?'dig.cloth':'dig.stone',(making?.9:.8)+(i%STROKES+1)*(making?.1:.15)));
 playFrames(block,frames);return last;
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
function mix(block,player,r,sets=1,delay=STRIKE+1){
 const result=mixResult(r.powders,worldSalt());
 const stack=new ItemStack(result.item,DOSES*sets);
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
 },delay);
 for(let i=0;i<sets;i++)emitEvt('powder_mixed',player,{id:result.item});
}
// v1.2.0: two doses of one powder and a bottle of honey roll into four honey pills; the bottle comes back.
function roll(block,player,r,powder,sets=1,delay=STRIKE+1){
 removeRecord(r.key);sync(block,undefined);lastMix.delete(blockKey(block));
 const pill=pillFor(powder),pills=new ItemStack(pill,PILL_COUNT*sets);
 const dimension=block.dimension,at={x:block.location.x+.5,y:block.location.y+.45,z:block.location.z+.5};
 system.runTimeout(()=>{
  for(const stack of [pills,new ItemStack('minecraft:glass_bottle',sets)]){
   try{const entity=dimension.spawnItem(stack,at);try{entity.clearVelocity();}catch{}}catch(error){console.warn('[Herbal] mortar: '+error);}
  }
  try{dimension.spawnParticle('minecraft:crop_growth_emitter',at);dimension.playSound('random.orb',at,{volume:.4,pitch:1.3});}catch{}
 },delay);
 for(let i=0;i<sets;i++)emitEvt('powder_mixed',player,{id:pill,from:powder,pill:true});
}
// A full mortar: enough herb powders to mix, or a complete set of pill makings.
const complete=powders=>isPillMaking(powders)?!!pillReady(powders):powders.length>=MIN_POWDERS;
// v1.3.2: sneak-use a full mortar holding one of its makings and it works that set and up to three more of the
// same from the inventory, every stroke in a row, and gives all the doses at once.
function batch(block,player,r){
 const making=isPillMaking(r.powders),powder=making?pillReady(r.powders):undefined;
 const sets=batchSets(r.powders,countItems(player));
 if(sets>1){const more=new Map();for(const item of r.powders)more.set(item,(more.get(item)??0)+sets-1);removeItems(player,more);}
 const last=poundAll(block,r.powders,Math.max(1,sets*STROKES-(r.strokes??0)),making);
 if(making)roll(block,player,r,powder,sets,last+1);else mix(block,player,r,sets,last+1);
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
   if(player.isSneaking&&r?.powders?.includes(held)&&complete(r.powders)){batch(block,player,r);return;}
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
  if(making){pound(block,r.powders,1.1,'dig.cloth');roll(block,player,r,powder);}else{pound(block,r.powders,1.25);mix(block,player,r);}
 },
 onPlayerBreak({block}){spillMortar(block);},
 onBreak({block}){spillMortar(block);},
};
