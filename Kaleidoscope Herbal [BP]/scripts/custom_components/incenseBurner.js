import {system,world,EntityInitializationCause} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {getRecord,newRecord,saveRecord,removeRecord,loadedBlock,setStates,isRedraw} from '../utils/blockStore.js';
import {hand,heldId,takeOne,drop,feedback,damageTool,refuse} from '../utils/items.js';
import {startSetLoop,onBeat,CHECKPOINT_TICKS,StationSet} from '../utils/loops.js';
import {emitEvt} from '../utils/bus.js';
import {incenseWeek,WEEK_INCENSE_TICKS} from '../utils/senluoWeek.js';
export const activeBurners=new StationSet();
// Lit mugwort burners only; the spawn listener returns at once while this is empty.
export const mugwortBurners=new Map();
// v1.2.4: a portion burns 6000 ticks (5 min, was 2400). Records keep the length they were loaded with
// in `per`; records from before v1.2.4 have none and keep 2400, so nothing already loaded is lost.
export const PORTION_TICKS=6000;
const OLD_PORTION_TICKS=2400;
// v1.2.3: ranges widened (reishi 24 -> 32, mugwort 16 -> 24) at the owner's request.
export const MUGWORT_RADIUS=24;
export const REISHI_RADIUS=32;
// v1.2.4: mugwort smoke also stifles monsters already close by; dried chrysanthemum is a third incense.
export const MUGWORT_NEAR=8;
export const CHRYS_RADIUS=16;
export const FUELS={
 [id('reishi_powder')]:{remaining:PORTION_TICKS,radius:REISHI_RADIUS},
 [id('mugwort_floss')]:{remaining:PORTION_TICKS,radius:MUGWORT_RADIUS},
 [id('dried_chrysanthemum')]:{remaining:PORTION_TICKS,radius:CHRYS_RADIUS},
};
// Reishi incense calms the mind: these clear for players in range, and they mend 1 health every 10 s.
export const REISHI_CLEARS=['nausea','blindness','darkness','hunger'];
// Chrysanthemum incense clears the head: poison and wither go, night vision stays while in range.
export const CHRYS_CLEARS=['poison','wither'];
export const CHRYS_NIGHT_VISION=320; // re-given every 5 s; kept above 10 s so the screen never flickers
export const SPARED=new Set(['minecraft:wither','minecraft:ender_dragon','minecraft:elder_guardian','minecraft:warden']);
// v1.2.10: the mugwort ward and A Witch Way (owner: "藥爐可阻擋AWW小怪 其餘不行"). An AWW entity (id aww:...)
// is warded only when it carries the family aww_wild, which AWW 1.6.31+ gives exactly its ordinary hostile
// mobs (the 13 natural spawns and charged_skeleton). Bosses, minibosses, Veda, boss pylons and minions, egg
// bosses, summons and familiars (some carry the vanilla monster family), allies, NPCs and merchants never carry
// it, and AWW's release check enforces that. With AWW 1.6.30 or older nothing carries aww_wild, so every AWW
// entity is left alone. Vanilla mobs AWW tags for its own events (trial waves, a player's undead army, coven
// and friendly witches) are still spared by those tags; other vanilla mobs are warded as before.
export const AWW_WILD='aww_wild';
const AWW_TAGS=new Set(['aww:trial_mob','aww:ally','aww:mini_helper','aww:m151_script','aww:class_summon','aww:army_summon',
 'aww:spell153_summon','aww:tide_minion','aww:hex_decoy','aww:coven_witch','aww:friendly_witch','aww:physical_familiar']);
const AWW_TAG_PREFIXES=['aww:minion_of_','aww:familiar_of_','aww:trial_of_'];
export const isSpared=e=>{
 const t=e.typeId;
 if(SPARED.has(t))return true;
 if(t.startsWith('aww:')){try{return !e.matches({families:[AWW_WILD]});}catch{return true;}}
 try{for(const tag of e.getTags())if(AWW_TAGS.has(tag)||AWW_TAG_PREFIXES.some(p=>tag.startsWith(p)))return true;}catch{}
 return false;
};
// Bosses from other packs carry no common family; anything this sturdy is not slowed or weakened either.
const BOSS_HEALTH=100;
const isMugwort=r=>r?.fuel===id('mugwort_floss');
// v1.2.1: up to 16 portions of one kind of powder; each adds its full burn time to what is left.
// Kinds are not mixed: each is a different effect with one timer, so the other kind is refused until
// the burner has burnt out.
export const MAX_PORTIONS=16;
const portionTicks=r=>r?.per??OLD_PORTION_TICKS;
// Portions still in the burner, the one burning now included (what the cap counts).
export const portionsOf=r=>Math.ceil(Math.max(0,r.remaining??0)/portionTicks(r));
// Portions not yet started (handed back if the burner is broken).
export const unburntOf=r=>Math.floor(Math.max(0,r.remaining??0)/portionTicks(r));
// Adds one portion to an existing record in place: 'added', 'mixed' (other kind) or 'full'.
export function addPortion(r,fuel){
 if(r.fuel!==fuel)return 'mixed';
 if(portionsOf(r)>=MAX_PORTIONS)return 'full';
 r.remaining=Math.max(0,r.remaining??0)+portionTicks(r);
 return 'added';
}
// v1.4.0: sneaking with incense in hand keeps adding portions from the hand until the burner is full.
function topUp(player,slot,r,fuel){
 for(let i=0;i<64&&heldId(slot)===fuel&&addPortion(r,fuel)==='added';i++){saveRecord(r);takeOne(player,slot);}
}
export function trackBurner(r){
 activeBurners.add(r.key);
 if(isMugwort(r)){mugwortBurners.set(r.key,{dimension:r.dimension,center:{x:r.location.x+.5,y:r.location.y+.5,z:r.location.z+.5}});wardSpawns();}
}
function untrack(key){activeBurners.delete(key);if(mugwortBurners.delete(key))wardSpawns();stopRing(key);}

// ---- v1.2.4: the range made visible. A ring of incense smoke on the edge of the range for 10 s,
// when the burner is lit and when it is used with an empty hand. No text (the pack shows no HUD).
export const RING_SECONDS=10;
const RING_STEP=2; // blocks between smoke points
const rings=new Map(); // burner key -> interval id
export function ringPoints(center,radius){
 const n=Math.max(12,Math.round(2*Math.PI*radius/RING_STEP)),out=[];
 for(let i=0;i<n;i++){const a=2*Math.PI*i/n;out.push({x:center.x+radius*Math.cos(a),z:center.z+radius*Math.sin(a)});}
 return out;
}
const solid=b=>!!b&&!b.isAir&&!b.isLiquid;
// The smoke sits on the ground near the burner's height: a step down into a dip or up onto a rise.
function groundY(dimension,x,z,y0){
 try{
  let y=y0;
  if(solid(dimension.getBlock({x,y,z}))){for(let i=0;i<8&&solid(dimension.getBlock({x,y:y+1,z}));i++)y++;return y+1;}
  for(let i=0;i<8&&!solid(dimension.getBlock({x,y:y-1,z}));i++)y--;
  return y;
 }catch{return undefined;} // not loaded
}
function stopRing(key){const run=rings.get(key);if(run!==undefined){try{system.clearRun(run);}catch{}rings.delete(key);}}
export function showRing(block,r){
 const radius=FUELS[r.fuel]?.radius;if(!radius)return;
 stopRing(r.key);
 const dim=block.dimension,y0=block.location.y;
 const points=[];
 for(const p of ringPoints({x:block.location.x+.5,z:block.location.z+.5},radius)){
  const x=Math.floor(p.x),z=Math.floor(p.z),y=groundY(dim,x,z,y0);
  if(y!==undefined)points.push({x:p.x,y:y+.1,z:p.z});
 }
 let left=RING_SECONDS;
 const puff=()=>{for(const p of points){try{dim.spawnParticle(id('incense_wisp'),p);}catch{}}};
 puff();
 rings.set(r.key,system.runInterval(()=>{if(--left<=0){stopRing(r.key);return;}puff();},20));
}

export function spillBurner(block){
 const r=getRecord(block);if(!r||r.type!=='incense_burner')return;
 // The portion already burning is spent; every portion not yet started comes back.
 const back=unburntOf(r);if(back>0)drop(block,r.fuel,back);
 untrack(r.key);removeRecord(r.key);
}
export const incenseBurner={
 onPlace({block}){if(isRedraw(block,'incense_burner'))return;spillBurner(block);},
 onPlayerInteract({block,player=undefined}){
  if(!player)return;const slot=hand(player),held=heldId(slot),r=getRecord(block);
  if(!r&&FUELS[held]){
   // v1.2.13: a burner first loaded in 森羅週曆's incense week keeps 9,000-tick portions until it burns out
   const per=incenseWeek()?WEEK_INCENSE_TICKS:FUELS[held].remaining;
   const fresh={...newRecord(block,'incense_burner'),fuel:held,lit:false,remaining:per,per,pulse:0,beats:0};
   saveRecord(fresh);takeOne(player,slot);if(player.isSneaking)topUp(player,slot,fresh,held);feedback(block);return;
  }
  if(r?.type==='incense_burner'&&FUELS[held]){
   // Topping up, lit or not: the record is saved before the powder leaves the hand.
   const added=addPortion(r,held);if(added!=='added'){refuse(block,added==='full'?'full':'wrong');return;}
   saveRecord(r);takeOne(player,slot);if(player.isSneaking)topUp(player,slot,r,held);feedback(block);return;
  }
  if(r&&!r.lit&&held==='minecraft:flint_and_steel'){
   r.lit=true;saveRecord(r);trackBurner(r);setStates(block,{[id('lit')]:true});damageTool(player,slot);feedback(block,'minecraft:basic_smoke_particle','fire.ignite');
   emitEvt('incense_lit',player,{fuel:r.fuel}); // v1.2.13: 森羅入門 step 6
   showRing(block,r);return;
  }
  if(r?.type==='incense_burner'&&r.lit&&!held){showRing(block,r);return;}
  // v1.4.0: flint and steel on an empty or already burning burner fizzes instead of doing nothing.
  if(held==='minecraft:flint_and_steel'&&(!r||r.type==='incense_burner')){refuse(block,'fizz');return;}
 },
 onPlayerBreak({block}){spillBurner(block);},
};

const tryEffect=(entity,fn)=>{try{fn();}catch{}};
function reishiPulse(block,r){
 const options={location:block.center(),maxDistance:REISHI_RADIUS};
 for(const phantom of block.dimension.getEntities({...options,type:'minecraft:phantom'})){
  try{block.dimension.spawnParticle('minecraft:basic_smoke_particle',phantom.location);phantom.remove();}catch{}
 }
 const mend=r.beats%2===0; // every other 5-s pulse
 for(const player of block.dimension.getPlayers(options)){
  for(const effect of REISHI_CLEARS)tryEffect(player,()=>player.removeEffect(effect));
  if(!mend)continue;
  try{
   const health=player.getComponent('minecraft:health');
   if(health&&health.currentValue>0&&health.currentValue<health.effectiveMax){
    health.setCurrentValue(Math.min(health.effectiveMax,health.currentValue+1));
    block.dimension.spawnParticle('minecraft:heart_particle',{x:player.location.x,y:player.location.y+2.1,z:player.location.z});
   }
  }catch{}
 }
}
export const isBossLike=e=>{
 if(isSpared(e))return true;
 try{return (e.getComponent('minecraft:health')?.effectiveMax??0)>=BOSS_HEALTH;}catch{return false;}
};
function mugwortPulse(block){
 const monsters=block.dimension.getEntities({location:block.center(),maxDistance:MUGWORT_NEAR,families:['monster']});
 for(const m of monsters){
  if(isBossLike(m))continue;
  tryEffect(m,()=>m.addEffect('slowness',120,{amplifier:0,showParticles:true}));
  tryEffect(m,()=>m.addEffect('weakness',120,{amplifier:0,showParticles:true}));
 }
}
function chrysPulse(block){
 for(const player of block.dimension.getPlayers({location:block.center(),maxDistance:CHRYS_RADIUS})){
  for(const effect of CHRYS_CLEARS)tryEffect(player,()=>player.removeEffect(effect));
  tryEffect(player,()=>player.addEffect('night_vision',CHRYS_NIGHT_VISION,{amplifier:0,showParticles:false}));
 }
}
export function pulseBurner(block,r){
 r.beats=(r.beats??0)+1;
 if(r.fuel===id('reishi_powder'))reishiPulse(block,r);
 else if(isMugwort(r))mugwortPulse(block);
 else if(r.fuel===id('dried_chrysanthemum'))chrysPulse(block);
}
export function tickBurner(key){
 const r=getRecord(key);if(!r){untrack(key);return;}
 const block=loadedBlock(r);if(!block)return;
 if(block.typeId!==id('incense_burner')){spillBurner(block);return;}
 r.remaining-=20;r.pulse+=20;
 if(onBeat(key,2))try{block.dimension.spawnParticle(id('incense_wisp'),{x:block.x+.5,y:block.y+.51,z:block.z+.5});}catch{}
 if(r.pulse>=100){r.pulse=0;try{pulseBurner(block,r);}catch(error){console.warn('[Herbal] incense pulse: '+error);}}
 if(r.remaining<=0){untrack(key);removeRecord(key);setStates(block,{[id('lit')]:false});}
 else if(r.pulse===0&&r.beats%(CHECKPOINT_TICKS/100)===0)saveRecord(r); // checkpoint every 30 s (v1.2.6, was 5 s)
}
export function nearMugwort(dimensionId,location){
 for(const burner of mugwortBurners.values()){
  if(burner.dimension!==dimensionId)continue;
  const dx=location.x-burner.center.x,dy=location.y-burner.center.y,dz=location.z-burner.center.z;
  if(dx*dx+dy*dy+dz*dz<=MUGWORT_RADIUS*MUGWORT_RADIUS)return true;
 }
 return false;
}
// v1.2.6: the spawn listener exists only while a mugwort burner is lit. Every entity spawn on the server
// (items, arrows, XP orbs ...) used to call into the pack even when no burner was burning.
function onSpawn({entity,cause}){
 if(!mugwortBurners.size||cause!==EntityInitializationCause.Spawned)return;
 try{
  if(!entity.matches({families:['monster']})||isSpared(entity))return;
  if(!nearMugwort(entity.dimension.id,entity.location))return;
  entity.dimension.spawnParticle('minecraft:basic_smoke_particle',entity.location);
  entity.remove();
 }catch{}
}
let spawnWard;
function wardSpawns(){
 if(mugwortBurners.size&&spawnWard===undefined)spawnWard=world.afterEvents.entitySpawn.subscribe(onSpawn);
 else if(!mugwortBurners.size&&spawnWard!==undefined){try{world.afterEvents.entitySpawn.unsubscribe(spawnWard);}catch{}spawnWard=undefined;}
}
export function startIncenseLoop(){
 startSetLoop(activeBurners,tickBurner,20);
}
