import {system} from '@minecraft/server';
import {HERB_ITEMS,NS,id} from '../data/herbs.js';
import {matchDecoction,advancePot,contentsOnBreak,burnLimit,potEvent,isExternalIngredient,MAX_INGREDIENTS} from '../data/decoctions.js';
import {getRecord,newRecord,saveRecord,removeRecord,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,exchangeOne,drop,feedback,countItems,removeItems,refuse} from '../utils/items.js';
import {heatBelow} from '../utils/heat.js';
import {startSetLoop,onBeat,CHECKPOINT_TICKS,StationSet} from '../utils/loops.js';
import {shownStates} from '../data/displayItems.js';
import {emitEvt} from '../utils/bus.js';
import {SLIP,FORMULA,formulaFrom,parseFormula,planFill,slipLore,tally} from '../data/prescription.js';
import {isPlain} from '../data/cabinet.js';
export const activePots=new StationSet();
const deny=block=>feedback(block,'minecraft:basic_smoke_particle','random.fizz');
// v1.2.7: no servings block state (nothing drew it; the count lives in the record) - 19,200 -> 3,840 permutations.
const STAGE=id('stage');
// v1.1.0: a brew registered by another pack (docs/API.md) may outlive that pack; its output then no longer
// exists and cannot be spawned, so the pot gives bitter dregs instead of jamming.
// Returns the item that was dropped (v1.1.0), so the served broadcast names what the player really got.
function dropOutput(block,item,count=1){
 try{drop(block,item,count);return item;}catch(error){if(item.startsWith(NS+':'))throw error;drop(block,id('bitter_dregs'),count);return id('bitter_dregs');}
}
// The last herb put in floats on the water until the brew is done; burnt or empty pots show nothing.
export const shownFor=r=>r&&r.stage>=1&&r.stage<=3&&r.ingredients?.length?shownStates(r.ingredients.at(-1)):{shown:0,page:0};
// The pot is redrawn from the loop every second, so only changed states are written (setStates).
function sync(block,r,lidOpen=false){
 const {shown,page}=shownFor(r);
 setStates(block,{[STAGE]:r.stage,[id('herbed')]:(r.ingredients?.length??0)>0,[id('lid_open')]:lidOpen,
  [id('shown')]:shown,[id('shown_page')]:page});
}
// 藥方籤: sneak to copy a finished brew onto the slip; use a written slip on fresh water to put the herbs in.
function useSlip(block,player,slot,r){
 const stack=slot.getItem();
 if(player.isSneaking){
  const formula=formulaFrom(r);if(!formula){deny(block);return;}
  stack.setDynamicProperty(FORMULA,JSON.stringify(formula));stack.setLore(slipLore(formula));slot.setItem(stack);
  feedback(block,'minecraft:crop_growth_emitter','item.book.page_turn');return;
 }
 const formula=parseFormula(stack.getDynamicProperty(FORMULA));
 // Nothing goes in unless every herb is in the inventory; the slip's tooltip lists what is needed.
 if(r.stage!==1||r.ingredients.length||!formula||formula.via==='mortar'||!planFill(formula.ingredients,countItems(player)).ok){deny(block);return;}
 removeItems(player,tally(formula.ingredients));
 r.ingredients=[...formula.ingredients];saveRecord(r);sync(block,r);feedback(block);
}
export function restorePotVisual(record){const block=loadedBlock(record);if(block?.typeId===id('clay_pot'))sync(block,record);}
export function spillPot(block){
 const r=getRecord(block);if(!r||r.type!=='clay_pot')return;
 const items=contentsOnBreak(r);
 // Retain an explicit remaining-drop journal if a spawn throws; never erase failed drops.
 // v1.1.0: another pack's brew may not stack (soups, potions), and a stack of three of those would drop as one or not at
 // all; those are dropped one at a time. Our own items stack to 16.
 r.pendingDrops??=items.flatMap(item=>item.id.startsWith(NS+':')||item.count<=1?[item]:Array.from({length:item.count},()=>({id:item.id,count:1})));
 while(r.pendingDrops.length){const item=r.pendingDrops[0];dropOutput(block,item.id,item.count);r.pendingDrops.shift();saveRecord(r);}
 activePots.delete(r.key);removeRecord(r.key);
}
export const clayPot={
 onPlace({block}){
  if(isRedraw(block,'clay_pot'))return; // our own redraw, not a placement
  if(getRecord(block))spillPot(block);
  sync(block,{stage:0,servings:0});
 },
 onPlayerInteract({block,player=undefined}){
  if(!player)return;
  const slot=hand(player),held=heldId(slot);
  const r=getRecord(block)??{...newRecord(block,'clay_pot'),stage:0,servings:0,ingredients:[]};
  if(held===SLIP){useSlip(block,player,slot,r);return;}
  if(r.stage===0&&held==='minecraft:water_bucket'){
   if(!exchangeOne(player,slot,held,'minecraft:bucket'))return;
   r.stage=1;r.ingredients=[];saveRecord(r);sync(block,r);feedback(block,'minecraft:water_splash_particle','bucket.empty_water');return;
  }
  if(r.stage===1&&(HERB_ITEMS.has(held)||isExternalIngredient(held))){
   if(r.ingredients.length>=MAX_INGREDIENTS){refuse(block,'full');return;}
   // v1.1.0: the pot remembers only which item went in. Another pack's ingredient that is named, enchanted or carries data
   // would come back as a plain one when the pot is broken, so it is not taken.
   if(!HERB_ITEMS.has(held)&&!isPlain(slot.getItem())){refuse(block,'wrong');return;}
   r.ingredients.push(held);saveRecord(r);sync(block,r);takeOne(player,slot);feedback(block);return;
  }
  if(r.stage===1&&!held&&player.isSneaking){
   // Empty water or a cold hearth fizzles instead of silently wasting the pot.
   if(!r.ingredients.length||!heatBelow(block)){deny(block);return;}
   const recipe=matchDecoction(r.ingredients);
   Object.assign(r,{stage:2,progress:0,warm:0,time:recipe?.time??400,result:recipe?.result??id('bitter_dregs'),recipeServings:recipe?.servings??1,by:player.id}); // by: who the burnt/bitter broadcast names
   saveRecord(r);sync(block,r);activePots.add(r.key);feedback(block,'minecraft:basic_smoke_particle','fire.ignite');return;
  }
  if((r.stage===3||r.stage===4)&&held==='minecraft:bowl'){
   // Output must spawn successfully before consuming the bowl or reducing the serving.
   const served=dropOutput(block,r.output);takeOne(player,slot);r.servings--;emitEvt('decoction_served',player,{id:served});
   if(r.servings<=0){removeRecord(r.key);activePots.delete(r.key);sync(block,{stage:0,servings:0});}
   else{saveRecord(r);sync(block,r,true);system.runTimeout(()=>{const current=getRecord(r.key),loaded=current&&loadedBlock(current);if(loaded?.typeId===id('clay_pot'))sync(loaded,current);},12);}return;
  }
 },
 onPlayerBreak({block}){spillPot(block);},
};
const lastSave=new Map();
export function tickPot(key){
 const r=getRecord(key);if(!r){activePots.delete(key);lastSave.delete(key);return;}
 const block=loadedBlock(r);if(!block)return; // Unloaded chunks never advance.
 if(block.typeId!==id('clay_pot')||r.pendingDrops){spillPot(block);return;}
 const before=r.stage;
 const heat=heatBelow(block);
 // Progress is checkpointed every 30 s (v1.2.6, was 5 s); stage transitions are saved at once.
 if(advancePot(r,heat)&&(before!==r.stage||system.currentTick-(lastSave.get(key)??0)>=CHECKPOINT_TICKS)){saveRecord(r);lastSave.set(key,system.currentTick);}
 const event=potEvent(before,r);if(event&&r.by)emitEvt(event.t,{id:r.by},event.fields);
 if(before!==r.stage){sync(block,r);if(r.stage===3)feedback(block,'kaleidoscope_herbal:pot_ready','random.orb');else if(r.stage===4)feedback(block,'minecraft:basic_smoke_particle','random.fizz');}
 // Ambient cues run on a slower, staggered beat; warnings stay every second.
 if(r.stage===2&&heat&&onBeat(key,3))feedback(block,'kaleidoscope_herbal:pot_simmer','bubble.pop');
 else if(r.stage===3){
  if(onBeat(key,2))try{block.dimension.spawnParticle('kaleidoscope_herbal:pot_ready',{x:block.x+.5,y:block.y+.6,z:block.z+.5});}catch{}
  // Past half of the scorch window the pot smokes and hisses before it burns.
  if(heat&&r.warm>=burnLimit(heat)/2)feedback(block,'minecraft:basic_smoke_particle','random.fizz');
 }
 if(r.stage===4){activePots.delete(key);lastSave.delete(key);}
}
export function startPotLoop(){startSetLoop(activePots,tickPot,20);}
