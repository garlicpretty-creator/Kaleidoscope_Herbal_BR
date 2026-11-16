import {ItemStack,system,world} from '@minecraft/server';
import {DRYING,id} from '../data/herbs.js';
import {getRecord,newRecord,saveRecord,removeRecord,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,drop,feedback,giveStack,creative,refuse} from '../utils/items.js';
import {isRaining} from './reishiSpread.js';
import {shownStates} from '../data/displayItems.js';
import {startSetLoop,CHECKPOINT_TICKS,StationSet} from '../utils/loops.js';
import {harvestFactor} from '../utils/senluoWeek.js';
// 簸箕: herbs dry only under open sky in daylight; rain or a roof pauses them. Works without Cookery.
export const activeBaskets=new StationSet();
export const BASKET_CAPACITY=8,DRY_TICKS=6000;
const SHOWN=/** @type {any} */(id('shown')),PAGE=/** @type {any} */(id('shown_page')),PILE=/** @type {any} */(id('pile'));
const deny=block=>feedback(block,'minecraft:basic_smoke_particle','random.fizz');
// The tray shows the herb actually on it (fresh, then dried), one picture per two items, up to four.
export const pileOf=count=>Math.max(1,Math.min(4,Math.ceil(count/2)));
function sync(block,r){
 const {shown,page}=shownStates(r?.item),pile=pileOf(r?.count??0);
 try{setStates(block,{[SHOWN]:shown,[PAGE]:page,[PILE]:pile});}catch{}
}
export const isDaytime=time=>time<12000||time>=23500;
// v1.2.6: one pass checks every basket on the same tick, so the clock and the weather are read once per
// pass, and each basket's roof (a column scan) is re-checked every 10 s instead of every second.
export const ROOF_TICKS=200;
let skyTick=-1,daylight=false;
const raining=new Map(),roofs=new Map();
function openSky(block){
 const now=system.currentTick;
 if(now!==skyTick){skyTick=now;daylight=isDaytime(world.getTimeOfDay());raining.clear();}
 if(!daylight)return false;
 const dim=block.dimension;
 let wet=raining.get(dim.id);if(wet===undefined){wet=isRaining(dim);raining.set(dim.id,wet);}
 return !wet;
}
function roofless(block){
 const key=`${block.dimension.id}|${block.x}|${block.y}|${block.z}`,now=system.currentTick,seen=roofs.get(key);
 if(seen&&now-seen.at<ROOF_TICKS)return seen.open;
 let open=true;
 try{const top=block.dimension.getTopmostBlock({x:block.x,z:block.z});open=!top||top.y<=block.y;}catch{}
 roofs.set(key,{open,at:now});return open;
}
export function sunlit(block){return openSky(block)&&roofless(block);}
const forget=key=>{activeBaskets.delete(key);roofs.delete(key);};
export function spillBasket(block){
 const r=getRecord(block);if(!r||r.type!=='drying_basket')return;
 drop(block,r.item,r.count);activeBaskets.delete(r.key);removeRecord(r.key);
}
export const dryingBasket={
 onPlace({block}){if(isRedraw(block,'drying_basket'))return;spillBasket(block);sync(block,undefined);},
 onPlayerInteract({block,player=undefined}){
  if(!player)return;
  const slot=hand(player),held=heldId(slot),r=getRecord(block);
  if(held&&DRYING[held]){
   // One kind per basket, added from the held stack up to capacity.
   if(r&&r.item!==held){refuse(block,'wrong');return;}
   if(r&&(r.done||r.count>=BASKET_CAPACITY)){refuse(block,'full');return;}
   const next=r??{...newRecord(block,'drying_basket'),item:held,count:0,progress:0,done:false};
   const take=Math.min(BASKET_CAPACITY-next.count,creative(player)?BASKET_CAPACITY:slot.amount);
   next.count+=take;saveRecord(next);activeBaskets.add(next.key);
   if(!creative(player)){if(slot.amount>take)slot.amount-=take;else slot.setItem(undefined);}
   sync(block,next);feedback(block);return;
  }
  if(held||!r)return;
  // Empty hand collects whatever is on the tray, fresh or dried.
  giveStack(player,new ItemStack(r.item,r.count));activeBaskets.delete(r.key);removeRecord(r.key);sync(block,undefined);
  feedback(block,'minecraft:crop_growth_emitter','dig.grass');
 },
 onPlayerBreak({block}){spillBasket(block);},
 onBreak({block}){spillBasket(block);},
};
export function tickBasket(key){
 const r=getRecord(key);if(!r||r.done){forget(key);return;}
 const block=loadedBlock(r);if(!block)return;
 if(block.typeId!==id('drying_basket')){spillBasket(block);return;}
 if(!sunlit(block))return;
 const before=r.progress;
 r.progress+=20*harvestFactor(); // v1.2.13: 1.5x in 森羅週曆's harvest week
 if(r.progress>=DRY_TICKS){
  r.item=DRYING[r.item]??r.item;r.done=true;saveRecord(r);forget(key);sync(block,r);
  feedback(block,'minecraft:crop_growth_emitter','random.orb');
 }else if(Math.floor(r.progress/CHECKPOINT_TICKS)!==Math.floor(before/CHECKPOINT_TICKS))saveRecord(r); // checkpoint every 30 s of sunshine
}
export function tickBaskets(){for(const key of [...activeBaskets])tickBasket(key);}
export function startBasketLoop(){startSetLoop(activeBaskets,tickBasket,20);}
