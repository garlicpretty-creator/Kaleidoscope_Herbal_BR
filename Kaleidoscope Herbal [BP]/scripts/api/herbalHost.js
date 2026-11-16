import {system,world,ItemTypes} from '@minecraft/server';
import {VERSION} from '../data/version.js';
import {HERBS,NS,id} from '../data/herbs.js';
import {FOOD_EFFECTS,EXTERNAL_RECIPES,EXTERNAL_ADJUVANTS,matchBuiltin,decoctionCatalog,adjuvantCatalog} from '../data/decoctions.js';
import {HEAT_VALUES,EXTERNAL_HEAT} from '../data/constitution.js';
import {getHeat,shiftHeat} from '../utils/constitution.js';
import {createHerbalHost} from './herbalHostCore.js';
// v1.1.0: wires the host API (herbalHostCore.js, docs/API.md) to the world.
const catalogs={
 herbs:()=>HERBS.map(h=>({key:h.key,fresh:id(h.fresh),dry:id(h.dry),...(h.processed?{processed:id(h.processed)}:{}),wild:id(h.wild),cultivable:h.cultivable})),
 foods:()=>Object.entries(FOOD_EFFECTS).map(([item,data])=>({id:item,heat:HEAT_VALUES.get(item)??0,
  effects:data.effects.map(e=>[e.name,e.ticks,e.amplifier]),...(data.clear?.length?{clear:data.clear}:{})})),
 decoctions:decoctionCatalog,adjuvants:adjuvantCatalog, // v1.2.0
};
// A recipe whose output no installed pack defines would leave the pot holding nothing; if the lookup itself fails, trust the sender.
function itemExists(item){try{return !!ItemTypes.get(item);}catch{return true;}}
function getPlayer(playerId){
 try{const entity=world.getEntity(playerId);return entity?.isValid&&entity.typeId==='minecraft:player'?entity:undefined;}catch{return undefined;}
}
export function startHerbalHost(){
 const host=createHerbalHost({
  send:(event,message)=>system.sendScriptEvent(event,message),now:()=>system.currentTick,version:VERSION,
  catalogs,externalHeat:EXTERNAL_HEAT,ownsItem:item=>item.startsWith(NS+':'),
  externalRecipes:EXTERNAL_RECIPES,externalAdjuvants:EXTERNAL_ADJUVANTS,matchBuiltin,itemExists,
  getPlayer,getHeat,shiftHeat,log:text=>console.warn('[Herbal] API '+text),
 });
 system.afterEvents.scriptEventReceive.subscribe(event=>{host.handle(event.id,event.message,event.sourceType);},{namespaces:[NS]});
 // Packs that loaded first hear this; packs that load later ping and get the same answer.
 system.run(()=>host.announce());
 return host;
}
