import {spillExplodedSoup} from '../custom_components/herbalSoup.js';
import {system,world,WeatherType} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {FOOD_EFFECTS} from '../data/decoctions.js';
import {hasExternalHeat} from '../data/constitution.js';
import {onSky,onReaction} from '../utils/awwWorld.js';
import {onSenluoEvent} from '../utils/senluoWeek.js';
import {readStore} from '../utils/blockStore.js';
import {activePots,startPotLoop,spillPot,restorePotVisual} from '../custom_components/clayPot.js';
import {trackBurner,startIncenseLoop,spillBurner} from '../custom_components/incenseBurner.js';
import {startReishiInoculation} from '../custom_components/reishiSpawn.js';
import {applyHeat,startConstitution} from '../utils/constitution.js';
import {startStoreSweep} from '../utils/storeSweep.js';
import {handleGinsengBreak,handleWildHarvest} from '../utils/ginsengHarvest.js';
import {spillCabinet} from '../custom_components/herbCabinet.js';
import {spillMortar} from '../custom_components/mortar.js';
import {STRANGE,STRANGE_EFFECTS,parseMark} from '../data/powders.js';
import {startFormulaBook} from '../utils/formulaBook.js';
import {handleHoneysuckleHarvest,handleHoneysuckleExplosion} from '../custom_components/wildHoneysuckle.js';
import {spillExplodedWine} from '../custom_components/herbalWine.js';
import {spillExplodedTea} from '../utils/teaDrops.js';
export {isDawn} from '../custom_components/wildHoneysuckle.js';
// The effects of eating or drinking one of our foods: clears, potion effects and constitution heat.
// Shared by real eating (itemCompleteUse) and A Witch Way's backpack auto-feed. Bowls and cups are returned
// only by food.using_converts_to, never here; hunger is the game's (or AWW's) job.
export function applyFood(source,typeId){
 const data=FOOD_EFFECTS[typeId];if(!source)return false;
 if(!data){ // v1.1.0: another pack's food carries only the 寒熱 value it registered through the Herbal API
  if(source.typeId!=='minecraft:player'||!hasExternalHeat(typeId))return false;
  applyHeat(source,typeId);return true;
 }
 for(const effect of data.clear??[])source.removeEffect(effect);
 for(const e of data.effects)source.addEffect(e.name,e.ticks,{amplifier:e.amplifier,showParticles:true});
 if(source.typeId==='minecraft:player')applyHeat(source,typeId);
 return true;
}
// 奇怪藥散: the packet's mark names its effect; a packet without one (given by command, auto-fed) picks at random.
export function applyStrange(source,lore){
 if(!source)return false;
 const e=STRANGE_EFFECTS[parseMark(lore)??Math.floor(Math.random()*STRANGE_EFFECTS.length)];
 source.addEffect(e.name,e.ticks,{amplifier:e.amplifier,showParticles:true});
 return true;
}
export function onAwwEvent(event){
 if(event.id!=='aww:evt')return;
 try{
  const m=JSON.parse(event.message);if(m?.v!==1)return;
  // v1.2.12 (phase 3a): sky events speed our crops up, a catalyze reaction grows those nearby.
  if(m.t==='sky'){onSky(m);return;}
  if(m.t==='reaction'){onReaction(m);return;}
  if(m.t!=='autofed'||typeof m.id!=='string'||!(m.id.startsWith('kaleidoscope_herbal:')||hasExternalHeat(m.id)))return;
  const player=world.getEntity(m.p);
  if(player?.isValid&&player.typeId==='minecraft:player'){if(m.id===STRANGE)applyStrange(player);else applyFood(player,m.id);}
 }catch{} // malformed message or player gone: ignore quietly
}
export function startEvents(){
 startReishiInoculation();
 world.afterEvents.itemCompleteUse.subscribe(({source,itemStack})=>{
  if(itemStack.typeId===STRANGE)applyStrange(source,itemStack.getLore());else applyFood(source,itemStack.typeId);
 });
 startFormulaBook();
 // v1.2.11 (B047): A Witch Way's backpack auto-feed does not really eat (it gives Saturation directly), so
 // itemCompleteUse never fires; AWW broadcasts each bite on aww:evt instead. Hunger and the bowl are AWW's.
 system.afterEvents.scriptEventReceive.subscribe(onAwwEvent,{namespaces:['aww']});
 // v1.2.13: 森羅週曆 weekly themes from 魔女手札.
 system.afterEvents.scriptEventReceive.subscribe(onSenluoEvent,{namespaces:['senluo_link']});
 world.afterEvents.weatherChange.subscribe(({dimension,newWeather})=>{
  world.setDynamicProperty(id('rain/'+dimension),newWeather===WeatherType.Rain||newWeather===WeatherType.Thunder);
 });
 world.afterEvents.playerBreakBlock.subscribe(event=>{
  handleHoneysuckleHarvest(event);
  handleGinsengBreak(event);
  handleWildHarvest(event);
 });
 world.afterEvents.blockExplode.subscribe(({block,explodedBlockPermutation})=>{
  const type=explodedBlockPermutation.type.id;
  if(type===id('clay_pot'))spillPot(block);
  if(type===id('herb_cabinet'))spillCabinet(block);
  if(type===id('mortar'))spillMortar(block);
  if(type===id('incense_burner'))spillBurner(block);
  handleHoneysuckleExplosion({block,explodedBlockPermutation});
  spillExplodedTea({block,explodedBlockPermutation});
  spillExplodedWine({block,explodedBlockPermutation});spillExplodedSoup({block,explodedBlockPermutation});
 });
 system.run(()=>{
  const store=readStore();
  for(const record of store.values()){
   if(record.type==='clay_pot')restorePotVisual(record);
   if(record.type==='clay_pot'&&[2,3].includes(record.stage))activePots.add(record.key);
   if(record.type==='incense_burner'&&record.lit)trackBurner(record);
  }
  startPotLoop();startIncenseLoop();startConstitution();startStoreSweep();
 });
}

