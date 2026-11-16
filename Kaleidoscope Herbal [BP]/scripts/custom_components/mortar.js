import {system} from '@minecraft/server';
import {MILLING,id} from '../data/herbs.js';
import {localShown} from '../data/displayItems.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,drop,feedback} from '../utils/items.js';
import {playStationAnimation,stopStationAnimation} from '../utils/stationAnimation.js';
const busy=new Map();
function sync(block,r){
 // Called from the block tick too; setStates only writes (and sends a block update) when something changed.
 // v1.2.8: its own short display list (no shown_page state).
 setStates(block,{[id('filled')]:!!r,[id('grind_step')]:Math.min(3,r?.turns??0),[id('shown')]:localShown('mortar',r?.input)});
}
/** v1.2.8 display migration: redraw from the saved record. */
export const redrawMortar=block=>{const r=getRecord(block);sync(block,r?.type==='mortar'?r:undefined);};
function finish(block,r){
 if(block.typeId!==id('mortar')||getRecord(block)!==r)return;
 const recipe=MILLING.find(x=>x.input===r.input);if(!recipe){spillMortar(block);return;}
 r.pendingDrops??=recipe.outputs.filter(out=>Math.random()<out.chance).map(out=>({id:out.id,count:out.count}));saveRecord(r);
 while(r.pendingDrops.length){const out=r.pendingDrops[0];drop(block,out.id,out.count);r.pendingDrops.shift();saveRecord(r);}
 removeRecord(r.key);sync(block,undefined);
}
export function restoreMortarVisual(block){const r=getRecord(block);if(r?.type==='mortar'&&r.turns>=4&&!busy.has(r.key))finish(block,r);else sync(block,r?.type==='mortar'?r:undefined);}
export function spillMortar(block){
 stopStationAnimation(block);busy.delete(blockKey(block));
 const r=getRecord(block);if(!r||r.type!=='mortar')return;
 if(r.pendingDrops){while(r.pendingDrops.length){const out=r.pendingDrops[0];drop(block,out.id,out.count);r.pendingDrops.shift();saveRecord(r);}}
 else drop(block,r.input);
 removeRecord(r.key);
}
export const mortar={
 onPlace({block}){if(isRedraw(block,'mortar'))return;spillMortar(block);sync(block,undefined);},
 onPlayerInteract({block,player=undefined}){
  if(!player||busy.has(blockKey(block)))return;
  const slot=hand(player),held=heldId(slot),r=getRecord(block);
  if(!r){
   if(!MILLING.some(x=>x.input===held))return;
   const next={...newRecord(block,'mortar'),input:held,turns:0};saveRecord(next);sync(block,next);takeOne(player,slot);feedback(block);return;
  }
  if(held)return;
  if(r.turns>=4){finish(block,r);return;}
  r.turns++;saveRecord(r);sync(block,r);busy.set(r.key,r);
  playStationAnimation(block,'mortar',16);feedback(block,'minecraft:basic_smoke_particle','dig.stone');
  system.runTimeout(()=>{if(busy.get(r.key)!==r)return;busy.delete(r.key);const loaded=loadedBlock(r);if(loaded&&r.turns>=4)finish(loaded,r);},16);
 },
 onPlayerBreak({block}){spillMortar(block);},
};
