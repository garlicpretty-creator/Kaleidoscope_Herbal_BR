// 百子櫃: the stock lives in the block record — one herb kind and a count.
export const CABINET_SLOTS=27;
export const capacityOf=max=>CABINET_SLOTS*max;
// Only plain stacks fit: a count cannot keep a custom name, lore, enchantments or script data.
export function isPlain(stack){
 try{
  if(stack.nameTag)return false;
  if((stack.getLore?.()??[]).length)return false;
  if((stack.getDynamicPropertyIds?.()??[]).length)return false;
  if(stack.getComponent?.('minecraft:enchantable')?.getEnchantments?.()?.length)return false;
  return true;
 }catch{return false;}
}
// How many of `amount` fit.
export function depositAmount(record,typeId,amount,max){
 if(record?.item&&record.item!==typeId)return 0;
 return Math.max(0,Math.min(amount,capacityOf(max)-(record?.count??0)));
}
// The next stack an empty hand takes: one full stack at a time.
export function nextWithdrawal(record,maxOf){
 if(record?.item&&record.count>0)return {typeId:record.item,amount:Math.min(record.count,maxOf(record.item))};
 return undefined;
}
export function applyWithdrawal(record,w){
 record.count-=w.amount;if(record.count<=0){delete record.item;record.count=0;}
 return record;
}
export const isEmpty=record=>!record?.item;
// Everything a broken cabinet drops, in stacks no larger than the item allows.
export function spillStacks(record,maxOf){
 const out=[];
 for(let n=record?.count??0;record?.item&&n>0;){const a=Math.min(n,maxOf(record.item));out.push({typeId:record.item,amount:a});n-=a;}
 return out;
}
