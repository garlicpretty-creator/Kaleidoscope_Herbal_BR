import {system} from '@minecraft/server';
import {MILLING,id} from '../data/herbs.js';
import {localShown} from '../data/displayItems.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,drop,feedback,creative,refuse} from '../utils/items.js';
import {playStationAnimation,stopStationAnimation,settleStationVisual} from '../utils/stationAnimation.js';
// 藥碾: the batch mill. Holds up to eight of one millable herb; three rolls of the wheel grind the whole load.
export const GRINDER_CAPACITY=8,GRINDER_ROLLS=3,ROLL_TICKS=24;
const busy=new Map();
const FILLED=id('filled'),STEP=id('grind_step'),SHOWN=id('shown'),PILE=id('pile');
const deny=block=>feedback(block,'minecraft:basic_smoke_particle','random.fizz');
function sync(block,r){
 // The trough shows the loaded herb's own picture; a second copy once it holds more than four.
 // v1.2.8: its own short display list (no shown_page state).
 try{setStates(block,{[FILLED]:!!r,[STEP]:Math.min(2,r?.rolls??0),[SHOWN]:localShown('herb_grinder',r?.input),[PILE]:(r?.count??0)>4?2:1});}catch{}
}
/** v1.2.8 display migration: redraw from the saved record. */
export const redrawGrinder=block=>{const r=getRecord(block);sync(block,r?.type==='herb_grinder'?r:undefined);};
export function grinderOutputs(input,count,random=Math.random){
 const recipe=MILLING.find(x=>x.input===input);if(!recipe)return [];
 return recipe.outputs.map(out=>{let n=0;for(let i=0;i<count;i++)if(random()<out.chance)n+=out.count;return {id:out.id,count:n};}).filter(x=>x.count>0);
}
function finish(block,r){
 if(block.typeId!==id('herb_grinder_decor')||getRecord(block)!==r)return;
 r.pendingDrops??=grinderOutputs(r.input,r.count);saveRecord(r);
 while(r.pendingDrops.length){const out=r.pendingDrops[0];drop(block,out.id,out.count);r.pendingDrops.shift();saveRecord(r);}
 removeRecord(r.key);sync(block,undefined);
}
export function spillGrinder(block){
 stopStationAnimation(block);busy.delete(blockKey(block));
 const r=getRecord(block);if(!r||r.type!=='herb_grinder')return;
 if(r.pendingDrops)for(const out of r.pendingDrops)drop(block,out.id,out.count);
 else drop(block,r.input,r.count);
 removeRecord(r.key);
}
export function restoreGrinder(block){
 const r=getRecord(block);
 if(r?.type==='herb_grinder'&&r.rolls>=GRINDER_ROLLS&&!busy.has(r.key))finish(block,r);
 else sync(block,r?.type==='herb_grinder'?r:undefined);
 settleStationVisual(block);
}
export const herbGrinder={
 onPlace({block}){if(isRedraw(block,'herb_grinder'))return;spillGrinder(block);sync(block,undefined);},
 onTick({block}){restoreGrinder(block);},
 onPlayerInteract({block,player=undefined}){
  if(!player||busy.has(blockKey(block)))return;
  const slot=hand(player),held=heldId(slot),r=getRecord(block);
  if(held&&MILLING.some(x=>x.input===held)){
   if(r&&r.rolls>0){deny(block);return;}
   if(r&&r.input!==held){refuse(block,'wrong');return;}
   if(r&&r.count>=GRINDER_CAPACITY){refuse(block,'full');return;}
   const next=r??{...newRecord(block,'herb_grinder'),input:held,count:0,rolls:0};
   const take=Math.min(GRINDER_CAPACITY-next.count,creative(player)?GRINDER_CAPACITY:slot.amount);
   next.count+=take;saveRecord(next);
   if(!creative(player)){if(slot.amount>take)slot.amount-=take;else slot.setItem(undefined);}
   sync(block,next);feedback(block,'minecraft:crop_growth_emitter','dig.gravel');return;
  }
  if(held)return;
  playStationAnimation(block,'herb_grinder_decor',ROLL_TICKS);
  if(!r)return; // an empty wheel still rolls for show
  r.rolls++;saveRecord(r);sync(block,r);busy.set(r.key,r);
  feedback(block,'minecraft:basic_smoke_particle','dig.stone');
  system.runTimeout(()=>{
   if(busy.get(r.key)!==r)return;busy.delete(r.key);
   const loaded=loadedBlock(r);if(loaded&&r.rolls>=GRINDER_ROLLS)finish(loaded,r);
  },ROLL_TICKS);
 },
 onPlayerBreak({block}){spillGrinder(block);},
 onBreak({block}){spillGrinder(block);},
};
