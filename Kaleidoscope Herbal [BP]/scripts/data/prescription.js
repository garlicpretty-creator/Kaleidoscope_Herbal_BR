import {id,NS} from './herbs.js';
// 藥方籤: a paper slip that remembers a finished brew and refills an empty pot from the inventory.
export const SLIP=id('prescription_slip'),FORMULA=id('formula');
const short=item=>item.startsWith(NS+':')?item.slice(NS.length+1):item;
// Only a successful, finished brew can be copied; bitter dregs teach nothing.
export function formulaFrom(record){
 if(record?.stage!==3||!record.ingredients?.length||!record.result||record.result===id('bitter_dregs'))return undefined;
 return {result:record.result,ingredients:[...record.ingredients].sort()};
}
export function parseFormula(raw){
 if(typeof raw!=='string')return undefined;
 try{
  const f=JSON.parse(raw);
  return typeof f?.result==='string'&&Array.isArray(f.ingredients)&&f.ingredients.length&&f.ingredients.length<=6&&f.ingredients.every(x=>typeof x==='string')?f:undefined;
 }catch{return undefined;}
}
export const tally=list=>list.reduce((m,x)=>m.set(x,(m.get(x)??0)+1),new Map());
// All or nothing: either every ingredient is on hand, or the pot is left untouched.
export function planFill(ingredients,have){
 const missing=[];
 for(const [item,need] of tally(ingredients)){const got=have.get(item)??0;if(got<need)missing.push({item,count:need-got});}
 return {ok:missing.length===0,missing};
}
// Tooltip lines, localized by the client: the brew's name, then each herb with its count.
export function slipLore(formula){
 return [{rawtext:[{text:'§6'},{translate:`kh.name.${short(formula.result)}`}]},
  ...[...tally(formula.ingredients)].map(([item,n])=>({rawtext:[{text:'§7· '},{translate:`kh.name.${short(item)}`},{text:` ×${n}`}]}))];
}
