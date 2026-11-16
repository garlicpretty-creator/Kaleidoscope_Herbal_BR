import {world,system,ItemStack,EquipmentSlot} from '@minecraft/server';
import {ActionFormData} from '@minecraft/server-ui';
import {id,NS} from '../data/herbs.js';
import {SLIP,FORMULA,parseFormula,slipLore,tally} from '../data/prescription.js';
import {SEALED,sealedFormula} from '../data/powders.js';
import {emitEvt} from './bus.js';
// v1.1.0 藥方手札: what each player has learned. Cookery's guidebook is one book for everybody and cannot
// show pages per player, so learned formulas live on the player and are read through this notebook.
export const NOTEBOOK=id('formula_notebook');
const LEARNED=id('learned'),MAX_LEARNED=64;
const short=item=>item.startsWith(NS+':')?item.slice(NS.length+1):item;
export function learnedOf(player){
 try{const list=JSON.parse(String(player.getDynamicProperty(LEARNED)??'[]'));return Array.isArray(list)?list.filter(f=>parseFormula(JSON.stringify(f))):[];}catch{return [];}
}
// Adds the formula to the list (one entry per result; a newer slip replaces the older wording). Pure.
export function withFormula(list,formula){
 const entry={result:formula.result,ingredients:[...formula.ingredients].sort(),...(formula.via==='mortar'?{via:'mortar'}:{})};
 const same=list.find(f=>f.result===entry.result);
 if(same&&JSON.stringify(same)===JSON.stringify(entry))return {list,added:false};
 const next=[...list.filter(f=>f.result!==entry.result),entry];
 return next.length>MAX_LEARNED?{list,added:false}:{list:next,added:true};
}
export function learn(player,formula){
 const {list,added}=withFormula(learnedOf(player),formula);if(!added)return false;
 player.setDynamicProperty(LEARNED,JSON.stringify(list));
 emitEvt('formula_learned',player,{id:formula.result});
 return true;
}
const name=item=>({translate:`kh.name.${short(item)}`});
// The page of one formula: where it is made, then each herb with its count.
export function formulaPage(formula){
 return {rawtext:[{translate:formula.via==='mortar'?'kh.notebook.mortar':'kh.notebook.pot'},{text:'\n\n'},
  ...[...tally(formula.ingredients)].flatMap(([item,n])=>[{text:'· '},name(item),{text:` ×${n}\n`}])]};
}
async function openNotebook(player){
 const list=learnedOf(player);
 const menu=new ActionFormData().title({translate:'kh.notebook.title'}).body({translate:list.length?'kh.notebook.pick':'kh.notebook.empty'});
 for(const formula of list)menu.button(name(formula.result));
 if(!list.length)menu.button({translate:'kh.notebook.back'});
 const picked=await menu.show(player);
 if(picked.canceled||picked.selection===undefined||!list.length)return;
 const formula=list[picked.selection];
 const page=await new ActionFormData().title(name(formula.result)).body(formulaPage(formula)).button({translate:'kh.notebook.back'}).show(player);
 if(!page.canceled)openNotebook(player);
}
// Breaking the seal turns one sealed slip into a written one. The written slip is made first and the sealed
// one taken only once it is safely in the inventory or on the ground.
function unseal(player){
 const slot=player.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
 if(!slot?.hasItem()||slot.typeId!==SEALED)return;
 const formula=sealedFormula(),slip=new ItemStack(SLIP,1);
 slip.setDynamicProperty(FORMULA,JSON.stringify(formula));slip.setLore(slipLore(formula));
 if(slot.amount>1){
  const left=player.getComponent('minecraft:inventory')?.container?.addItem(slip);
  if(left)player.dimension.spawnItem(left,player.location);
  slot.amount--;
 }else slot.setItem(slip);
 try{player.playSound('item.book.page_turn',{volume:.6,pitch:.9});}catch{}
}
export function startFormulaBook(){
 world.afterEvents.itemUse.subscribe(({source,itemStack})=>{
  if(source?.typeId!=='minecraft:player'||!itemStack)return;
  if(itemStack.typeId===NOTEBOOK){system.run(()=>{openNotebook(source).catch(error=>console.warn('[Herbal] notebook: '+error));});return;}
  if(itemStack.typeId===SEALED){system.run(()=>{try{unseal(source);}catch(error){console.warn('[Herbal] sealed slip: '+error);}});return;}
  if(itemStack.typeId!==SLIP)return;
  // A slip aimed at a block is being used on that block (pot, mortar); only one used in the open air is read.
  let aimed;try{aimed=source.getBlockFromViewDirection({maxDistance:6});}catch{}
  if(aimed)return;
  const formula=parseFormula(itemStack.getDynamicProperty(FORMULA));if(!formula)return;
  const sound=learn(source,formula)?'random.levelup':'item.book.page_turn';
  try{source.playSound(sound,{volume:.5,pitch:1.2});}catch{}
 });
}
