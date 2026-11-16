import {ItemStack,system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {shownStates} from '../data/displayItems.js';
import {isPlain,depositAmount,nextWithdrawal,applyWithdrawal,isEmpty,spillStacks,migrateCabinet} from '../data/cabinet.js';
import {getRecord,newRecord,saveRecord,removeRecord,allRecords,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,feedback,refuse} from '../utils/items.js';
import {onHerbalEntityLoad} from '../utils/herbalEntities.js';
// v1.2: the cabinet is a plain block. Its stock is a block record (one herb and a count) and the middle
// drawer's picture is the `shown` block state; the v1.1 storage entity only survives to be migrated.
const storageType=id('cabinet_storage'),cabinetType=id('herb_cabinet');
const SHOWN=id('shown'),PAGE=id('shown_page');
const LOST_TICKS=100;
const maxOf=typeId=>{try{return new ItemStack(typeId).maxAmount??64;}catch{return 64;}};
const deny=block=>feedback(block,'minecraft:basic_smoke_particle','random.fizz');
// Leftovers show first, because they come out first.
function sync(block,r){
 const {shown,page}=shownStates(r?.legacy?.[0]?.typeId??r?.item);
 try{setStates(block,{[SHOWN]:shown,[PAGE]:page});}catch{}
}
export const isFront=(facing,face)=>String(face).toLowerCase()===facing;
function spawnAt(dimension,location,stack){dimension.spawnItem(stack,location);}
// v1.1 kept the stock in a storage entity. Move it into the record (rerunnable: migratedFrom marks a
// record already credited, so a crash before cleanup never counts the stock twice), then retire the entity.
export function migrateFromEntity(entity){
 if(entity?.typeId!==storageType||!entity.isValid)return;
 let owner;try{owner=JSON.parse(String(entity.getDynamicProperty(id('cabinet_owner'))));}catch{}
 const container=entity.getComponent('minecraft:inventory')?.container;
 const record=owner?getRecord(owner.key):undefined;
 const block=owner?entity.dimension.getBlock(owner.location):undefined;
 const live=!!record&&record.type==='herb_cabinet'&&!record.retired&&record.entity===entity.id&&block?.typeId===cabinetType;
 const slots=[];
 if(container)for(let i=0;i<container.size;i++){const s=container.getItem(i);if(s)slots.push({slot:i,typeId:s.typeId,amount:s.amount,plain:isPlain(s),stack:s});}
 if(!live){
  // The cabinet was broken or replaced while its entity was away: hand everything back where it stands.
  for(const s of slots){spawnAt(entity.dimension,entity.location,s.stack);container.setItem(s.slot,undefined);}
  if(record?.entity===entity.id)removeRecord(record.key);
  entity.remove();return;
 }
 if(record.migratedFrom!==entity.id){
  const m=migrateCabinet(slots);
  record.item=m.item;record.count=m.count;
  if(m.legacy.length)record.legacy=m.legacy;else delete record.legacy;
  record.migratedFrom=entity.id;saveRecord(record);
 }
 // Named or scripted stacks cannot live in a count; they drop at the cabinet unchanged.
 for(const s of slots){if(!s.plain)spawnAt(block.dimension,block.center(),s.stack);container.setItem(s.slot,undefined);}
 delete record.entity;delete record.migratedFrom;delete record.missingSince;delete record.retired;
 if(isEmpty(record))removeRecord(record.key);else saveRecord(record);
 entity.remove();sync(block,getRecord(record.key));
}
// A record still pointing at an entity is unusable until that entity loads and migrates. If it never
// shows up (killed in v1.1), its stock went with it; after LOST_TICKS the cabinet starts empty.
function awaitEntity(block,r){
 const entity=world.getEntity(r.entity);
 if(entity){migrateFromEntity(entity);return getRecord(block);}
 const tick=system.currentTick;
 if(r.missingSince===undefined||r.missingSince>tick){saveRecord({...r,missingSince:tick});return undefined;}
 if(tick-r.missingSince<LOST_TICKS)return undefined;
 removeRecord(r.key);return null;
}
export function spillCabinet(block){
 let r=getRecord(block);if(!r||r.type!=='herb_cabinet')return;
 if(r.entity){
  const entity=world.getEntity(r.entity);
  if(entity){migrateFromEntity(entity);r=getRecord(block);if(!r)return;}
  // Not loaded: mark it so the entity hands its stock back when it does load.
  else{saveRecord({...r,retired:true});return;}
 }
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
  let r=getRecord(block);if(r&&r.type!=='herb_cabinet')return;
  if(r?.entity){const next=awaitEntity(block,r);if(next===undefined){deny(block);return;}r=next??undefined;}
  const held=slot.getItem();let moved=false;
  if(held){
   if(!held.hasTag(id('herb'))||!isPlain(held)){refuse(block,'wrong');return;}
   const take=depositAmount(r,held.typeId,held.amount,held.maxAmount);if(!take){refuse(block,r?.legacy?.length?'fizz':r?.item&&r.item!==held.typeId?'wrong':'full');return;}
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
// Migrate v1.1 storage entities as they load, and any already loaded at startup.
export function startCabinetStorage(){
 onHerbalEntityLoad((entity,type)=>{if(type===storageType)system.run(()=>{try{migrateFromEntity(entity);}catch(error){console.warn('[Herbal] Cabinet migration kept its stock: '+error);}});});
 system.run(()=>{for(const r of [...allRecords()])if(r.type==='herb_cabinet'&&r.entity){const e=world.getEntity(r.entity);if(e)try{migrateFromEntity(e);}catch(error){console.warn('[Herbal] Cabinet migration kept its stock: '+error);}}});
}
