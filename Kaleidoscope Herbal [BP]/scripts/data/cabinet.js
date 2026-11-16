// 百子櫃 (v1.2): the stock lives in the block record — one herb kind and a count — not in a storage entity.
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
// How many of `amount` fit. Leftovers from the nine-drawer days must come out before anything goes in.
export function depositAmount(record,typeId,amount,max){
 if(record?.legacy?.length)return 0;
 if(record?.item&&record.item!==typeId)return 0;
 return Math.max(0,Math.min(amount,capacityOf(max)-(record?.count??0)));
}
// The next stack an empty hand takes: legacy leftovers first, then the main herb, one full stack at a time.
export function nextWithdrawal(record,maxOf){
 if(record?.legacy?.length){const s=record.legacy[0];return {typeId:s.typeId,amount:s.amount,legacy:true};}
 if(record?.item&&record.count>0)return {typeId:record.item,amount:Math.min(record.count,maxOf(record.item)),legacy:false};
 return undefined;
}
export function applyWithdrawal(record,w){
 if(w.legacy)record.legacy.shift();
 else{record.count-=w.amount;if(record.count<=0){delete record.item;record.count=0;}}
 if(record.legacy&&!record.legacy.length)delete record.legacy;
 return record;
}
export const isEmpty=record=>!record?.item&&!record?.legacy?.length;
// Everything a broken cabinet drops, in stacks no larger than the item allows.
export function spillStacks(record,maxOf){
 const out=(record?.legacy??[]).map(s=>({typeId:s.typeId,amount:s.amount}));
 for(let n=record?.count??0;record?.item&&n>0;){const a=Math.min(n,maxOf(record.item));out.push({typeId:record.item,amount:a});n-=a;}
 return out;
}
// v1.1 -> v1.2: a storage entity's slots [{typeId, amount, plain}] become record fields.
// The most plentiful plain kind is the cabinet's herb; other plain kinds come out first as legacy;
// stacks with names or data are returned as `drops` for the caller to spawn unchanged.
export function migrateCabinet(stacks){
 const plain=stacks.filter(s=>s&&s.plain),drops=stacks.filter(s=>s&&!s.plain);
 const totals=new Map();for(const s of plain)totals.set(s.typeId,(totals.get(s.typeId)??0)+s.amount);
 let item,count=0;for(const [typeId,n] of totals)if(n>count){item=typeId;count=n;}
 const legacy=plain.filter(s=>s.typeId!==item).map(s=>({typeId:s.typeId,amount:s.amount}));
 return {item,count,legacy,drops};
}
