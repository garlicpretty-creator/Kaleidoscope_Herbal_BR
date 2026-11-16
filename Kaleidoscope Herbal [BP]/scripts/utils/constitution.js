import {system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {emitEvt} from './bus.js';
import {HEAT_DECAY_TICKS,HINT_CLEAR,heatDelta,stepHeat,decayHeat,heatHint} from '../data/constitution.js';
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
}
// Called whenever a player eats or drinks; neutral foods return without touching storage.
export function applyHeat(player,typeId){
 const delta=heatDelta(typeId,player.dimension.id==='minecraft:nether');if(!delta)return;
 shiftHeat(player,delta);
}
// v1.1.0: the one way a player's 寒熱 moves, shared by eating and by the Herbal API's heat_add. Crossing a
// limit is also broadcast on kaleidoscope_herbal:evt as {t:'constitution', state:'overheat'|'chill'}.
export function shiftHeat(player,delta){
 const {heat,effect}=stepHeat(getHeat(player),delta);setHeat(player,heat);if(heat)wakeDecay();
 hint(player,heat,effect);
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
 return {heat,effect};
}
// v1.2.6: the decay timer runs only while some player's heat is not at balance (was every 5 s for good,
// polling every player). Eating or drinking starts it; a player who joins with stored heat starts it too.
let decayLoop;
export const decayActive=()=>decayLoop!==undefined;
export function wakeDecay(){if(decayLoop===undefined)decayLoop=system.runInterval(decayAll,HEAT_DECAY_TICKS);}
function decayAll(){
 let any=false;
 for(const player of world.getAllPlayers()){
  const heat=getHeat(player);if(!heat)continue;
  const next=decayHeat(heat);setHeat(player,next);any||=next!==0;
  if(Math.abs(next)<HINT_CLEAR&&player.getDynamicProperty(HINT)!==undefined)player.setDynamicProperty(HINT,undefined); // re-arm the early warning
 }
 if(!any&&decayLoop!==undefined){system.clearRun(decayLoop);decayLoop=undefined;}
}
export function startConstitution(){
 world.afterEvents.playerSpawn.subscribe(({player,initialSpawn})=>{if(initialSpawn&&getHeat(player))wakeDecay();});
 if(world.getAllPlayers().some(getHeat))wakeDecay();
}
