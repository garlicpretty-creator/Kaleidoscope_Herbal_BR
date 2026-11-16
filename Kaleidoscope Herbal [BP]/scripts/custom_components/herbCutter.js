import {system} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {getRecord,newRecord,saveRecord,removeRecord,blockKey,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,drop,feedback,refuse} from '../utils/items.js';
import {localShown} from '../data/displayItems.js';
// 鍘刀: one dried root on the board, three presses of the blade -> slices. Works without Cookery.
export const CUTTING={
 [id('dried_ginseng')]:{id:id('ginseng_slices'),count:3},
 [id('dried_broken_ginseng')]:{id:id('ginseng_slices'),count:1},
 [id('dried_angelica')]:{id:id('angelica_slices'),count:3},
 [id('dried_licorice')]:{id:id('licorice_slices'),count:3},
 [id('dried_poria')]:{id:id('poria_slices'),count:3},
};
export const CUTTER_CHOPS=3,BLADE_TICKS=6;
const FILLED=/** @type {any} */(id('filled')),CHOP=/** @type {any} */(id('chop')),DOWN=/** @type {any} */(id('blade_down')),SHOWN=/** @type {any} */(id('shown'));
const busy=new Set();
function set(block,state,value){try{setStates(block,{[state]:value});}catch{}}
function sync(block,r){
 // v1.2.8: its own short display list (no shown_page state).
 set(block,FILLED,!!r);set(block,CHOP,Math.min(2,r?.chops??0));set(block,SHOWN,localShown('herb_cutter',r?.input));
}
/** v1.2.8 display migration: redraw from the saved record (the cutter has no block tick to do it). */
export const redrawCutter=block=>{const r=getRecord(block);sync(block,r?.type==='herb_cutter'?r:undefined);};
export function spillCutter(block){
 busy.delete(blockKey(block));
 const r=getRecord(block);if(!r||r.type!=='herb_cutter')return;
 drop(block,r.input);removeRecord(r.key);
}
export const herbCutter={
 // isRedraw also covers an empty cutter's blade drop, which has no record to recognise.
 onPlace({block}){if(isRedraw(block,'herb_cutter'))return;spillCutter(block);sync(block,undefined);set(block,DOWN,false);},
 onPlayerInteract({block,player=undefined}){
  const key=blockKey(block);if(!player||busy.has(key))return;
  const slot=hand(player),held=heldId(slot),r=getRecord(block);
  if(held&&CUTTING[held]){
   if(r){refuse(block,'full');return;}
   const next={...newRecord(block,'herb_cutter'),input:held,chops:0};saveRecord(next);takeOne(player,slot);
   sync(block,next);feedback(block,'minecraft:crop_growth_emitter','dig.wood');return;
  }
  if(held)return;
  // The blade drops for a moment on every press, loaded or not.
  busy.add(key);set(block,DOWN,true);
  try{block.dimension.playSound('hit.wood',block.center(),{volume:.5,pitch:.8});}catch{}
  if(r){r.chops++;saveRecord(r);sync(block,r);}
  system.runTimeout(()=>{
   busy.delete(key);
   const loaded=r?loadedBlock(r):block;if(!loaded||loaded.typeId!==id('herb_cutter'))return;
   set(loaded,DOWN,false);
   if(r&&r.chops>=CUTTER_CHOPS&&getRecord(loaded)===r){
    const out=CUTTING[r.input];removeRecord(r.key);sync(loaded,undefined);
    if(out)drop(loaded,out.id,out.count);
    feedback(loaded,'minecraft:crop_growth_emitter','dig.grass');
   }
  },BLADE_TICKS);
 },
 onPlayerBreak({block}){spillCutter(block);},
 onBreak({block}){spillCutter(block);},
};
