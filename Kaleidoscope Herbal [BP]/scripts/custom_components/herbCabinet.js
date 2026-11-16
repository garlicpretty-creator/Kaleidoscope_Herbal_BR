import {ItemStack} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {shownStates} from '../data/displayItems.js';
import {isPlain,depositAmount,nextWithdrawal,applyWithdrawal,isEmpty,spillStacks} from '../data/cabinet.js';
import {getRecord,newRecord,saveRecord,removeRecord,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,refuse} from '../utils/items.js';
// The cabinet is a plain block. Its stock is a block record (one herb and a count) and the middle drawer's
// picture is the `shown` block state.
const SHOWN=id('shown'),PAGE=id('shown_page');
const maxOf=typeId=>{try{return new ItemStack(typeId).maxAmount??64;}catch{return 64;}};
function sync(block,r){
 const {shown,page}=shownStates(r?.item);
 try{setStates(block,{[SHOWN]:shown,[PAGE]:page});}catch{}
}
export const isFront=(facing,face)=>String(face).toLowerCase()===facing;
function spawnAt(dimension,location,stack){dimension.spawnItem(stack,location);}
export function spillCabinet(block){
 const r=getRecord(block);if(!r||r.type!=='herb_cabinet')return;
 r.pendingDrops??=spillStacks(r,maxOf);saveRecord(r);
 while(r.pendingDrops.length){const s=r.pendingDrops[0];spawnAt(block.dimension,block.center(),new ItemStack(s.typeId,s.amount));r.pendingDrops.shift();saveRecord(r);}
 removeRecord(r.key);
}
export const herbCabinet={
 onPlace({block}){if(isRedraw(block,'herb_cabinet'))return;sync(block,undefined);},
 onPlayerInteract({block,player=undefined,face}){
  if(!player)return;
  const facing=String(block.permutation.getState(/** @type {any} */('minecraft:cardinal_direction'))??'north');
  if(!isFront(facing,face))return;
  const slot=hand(player);if(!slot)return;
  const r=getRecord(block);if(r&&r.type!=='herb_cabinet')return;
  const held=slot.getItem();let moved=false;
  if(held){
   if(!held.hasTag(id('herb'))||!isPlain(held)){refuse(block,'wrong');return;}
   const take=depositAmount(r,held.typeId,held.amount,held.maxAmount);if(!take){refuse(block,r?.item&&r.item!==held.typeId?'wrong':'full');return;}
   const next=r??{...newRecord(block,'herb_cabinet'),count:0};
   next.item=held.typeId;next.count=(next.count??0)+take;saveRecord(next);
   if(take===held.amount)slot.setItem(undefined);else{held.amount-=take;slot.setItem(held);}
   moved=true;
  }else{
   const w=nextWithdrawal(r,maxOf);
   if(w){
    slot.setItem(new ItemStack(w.typeId,w.amount));applyWithdrawal(r,w);
    if(isEmpty(r))removeRecord(r.key);else saveRecord(r);
    moved=true;
   }
  }
  sync(block,getRecord(block));
  if(moved)try{block.dimension.playSound('random.wood_click',block.center(),{volume:.3,pitch:1});}catch{}
 },
 onPlayerBreak({block}){spillCabinet(block);},
 onBreak({block}){spillCabinet(block);},
};
