import {system,world,GameMode} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {emitEvt} from './bus.js';
import {HEAT_DECAY_TICKS,HINT_CLEAR,heatDelta,stepHeat,envStep,heatHint} from '../data/constitution.js';
import {heatOf} from './heat.js';
import {blockAt} from './blockStore.js';
import {dietFactor} from './senluoWeek.js';
import {SOUPS} from '../data/placeableSoups.js';
const KEY=id('heat'),HINT=id('heat_hint');
export function getHeat(player){const value=player.getDynamicProperty(KEY);return typeof value==='number'?value:0;}
function setHeat(player,value){player.setDynamicProperty(KEY,value===0?undefined:value);}
function hint(player,heat,effect){
 const before=player.getDynamicProperty(HINT),flag=typeof before==='number'?before:0;
 const next=heatHint(flag,heat,effect);
 if(next.flag!==flag)player.setDynamicProperty(HINT,next.flag||undefined);
 const head={...player.location,y:player.location.y+1.7};
 if(next.cue==='warm'){
  // 有點上火: a flush of warmth, no text.
  try{player.dimension.spawnParticle('minecraft:redstone_wire_dust_particle',head);}catch{}
  try{player.dimension.playSound('random.fizz',player.location,{volume:.2,pitch:1.5});}catch{}
 }else if(next.cue==='cold'){
  // 有點受寒: a shiver.
  try{player.dimension.spawnParticle('minecraft:snowflake_particle',head);}catch{}
  try{player.dimension.playSound('step.snow',player.location,{volume:.5,pitch:.8});}catch{}
 }
 return next.cue;
}
// Called whenever a player eats or drinks; neutral foods return without touching storage.
export function applyHeat(player,typeId){
 const delta=heatDelta(typeId,player.dimension.id==='minecraft:nether',SOUPS[typeId]?dietFactor():1);if(!delta)return; // 藥膳週: bowls carry half
 shiftHeat(player,delta);
}
// v1.1.0: the one way a player's 寒熱 moves, shared by eating and by the Herbal API's heat_add. Crossing a
// limit is also broadcast on kaleidoscope_herbal:evt as {t:'constitution', state:'overheat'|'chill'}.
export function shiftHeat(player,delta){
 const {heat,effect}=stepHeat(getHeat(player),delta);setHeat(player,heat);if(heat)wakeDecay();
 const cue=hint(player,heat,effect);
 if(effect==='overheat'){
  // 上火: queasy and smoking, no text.
  player.addEffect('nausea',200,{amplifier:0,showParticles:true});
  try{player.dimension.spawnParticle('minecraft:basic_smoke_particle',{...player.location,y:player.location.y+1.8});}catch{}
  try{player.dimension.playSound('random.fizz',player.location,{volume:.4,pitch:.8});}catch{}
 }else if(effect==='chill'){
  // 受寒: sluggish limbs.
  player.addEffect('slowness',200,{amplifier:0,showParticles:true});
  try{player.dimension.spawnParticle('minecraft:snowflake_particle',{...player.location,y:player.location.y+1.8});}catch{}
 }
 if(effect)emitEvt('constitution',player,{state:effect});
 return {heat,effect,cue};
}
// v1.2.0 寒熱與環境: what a player's surroundings do to the body (see envStep). It looks at a handful of blocks
// around the feet; the fire scan (7 x 3 x 7) runs only when the place is cold or hot.
const COLD_BLOCKS=new Set(['minecraft:snow','minecraft:snow_layer','minecraft:powder_snow','minecraft:ice','minecraft:packed_ice','minecraft:blue_ice','minecraft:frosted_ice']);
const WATER=new Set(['minecraft:water','minecraft:flowing_water']);
const COLD_BIOME=/frozen|snowy|ice|cold|grove|peaks/,HOT_BIOME=/desert|badlands|mesa/;
function nearFire(dim,feet){
 for(let dx=-3;dx<=3;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-3;dz<=3;dz++)
  if(heatOf(blockAt(dim,{x:feet.x+dx,y:feet.y+dy,z:feet.z+dz})))return true;
 return false;
}
export function senseEnv(player){
 const dim=player.dimension;
 if(dim.id==='minecraft:nether')return {nether:true};
 if(dim.id!=='minecraft:overworld')return {};
 const loc=player.location,feet={x:Math.floor(loc.x),y:Math.floor(loc.y),z:Math.floor(loc.z)};
 const here=blockAt(dim,feet)?.typeId,under=blockAt(dim,{...feet,y:feet.y-1})?.typeId;
 let time=6000;try{time=world.getTimeOfDay();}catch{}
 const night=time>=13000&&time<23000;
 // The biome lookup is not in every Script API version; without it only the ground and water count.
 let biome='';try{biome=String(dim.getBiome?.(loc)?.id??'');}catch{}
 let open=false;try{const top=dim.getTopmostBlock({x:feet.x,z:feet.z});open=!top||top.y<feet.y;}catch{}
 const cold=COLD_BLOCKS.has(here)||COLD_BLOCKS.has(under)||(WATER.has(here)&&(night||COLD_BIOME.test(biome)))||(open&&COLD_BIOME.test(biome));
 const hot=!cold&&open&&!night&&HOT_BIOME.test(biome);
 return cold||hot?{cold,hot,nearFire:nearFire(dim,feet)}:{};
}
const SENSING=new Set([GameMode.Survival,GameMode.Adventure]);
function senses(player){try{return SENSING.has(player.getGameMode());}catch{return false;}}
// One light loop for everybody (v1.2.0; it used to sleep at balance, but the surroundings can now move the body).
function tickBodies(){
 for(const player of world.getAllPlayers()){
  const heat=getHeat(player),env=senses(player)?senseEnv(player):{};
  if(!heat&&!env.nether&&!(env.cold||env.hot)||env.nearFire&&!heat)continue;
  const step=envStep(heat,env);
  if(step.push){
   const {cue}=shiftHeat(player,step.push);
   if(cue)emitEvt('constitution_env',player,{state:cue});
  }else if(step.next!==heat){
   setHeat(player,step.next);
   if(Math.abs(step.next)<HINT_CLEAR&&player.getDynamicProperty(HINT)!==undefined)player.setDynamicProperty(HINT,undefined); // re-arm the early warning
  }
 }
}
let loop;
export function wakeDecay(){if(loop===undefined)loop=system.runInterval(tickBodies,HEAT_DECAY_TICKS);}
export function startConstitution(){wakeDecay();}
