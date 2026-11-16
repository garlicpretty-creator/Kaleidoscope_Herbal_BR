import {system} from '@minecraft/server';
// v1.2.6: running stations save their progress at most every 30 s (was 5–10 s); transitions
// (lit, done, burnt out, picked up) still save at once. A crash can replay at most 30 s of progress.
export const CHECKPOINT_TICKS=600;
// Up to this many stations a pass runs in one go; v1.2.5 started an engine job every second for every
// loop, and the job set-up cost more than the stations themselves (BDS profile, 10 stations).
export const INLINE_MAX=32;
// A set of working stations that wakes its loop when the first one is added (v1.2.6).
export class StationSet extends Set{
 add(key){super.add(key);this.wake?.();return this;}
}
// Server-friendly loop over a live set of block keys: one pass per period. A large pass runs as a job so
// the engine spreads it over several ticks instead of spiking one. A pass never overlaps the next.
// v1.2.6: for a StationSet the timer exists only while the set has stations; it stops itself when the
// set runs empty and the next add starts it again, so an idle server runs no station timers at all.
export function startSetLoop(set,step,period=20){
 let running=false,timer;
 const each=key=>{if(set.has(key)){try{step(key);}catch(error){console.warn('[Herbal] loop step: '+error);}}};
 const dormant=set instanceof StationSet;
 const pass=()=>{
  if(running)return;
  if(!set.size){if(dormant&&timer!==undefined){system.clearRun(timer);timer=undefined;}return;}
  const keys=[...set];
  if(keys.length<=INLINE_MAX){for(const key of keys)each(key);return;}
  running=true;
  system.runJob((function*(){
   try{for(const key of keys){each(key);yield;}}
   finally{running=false;}
  })());
 };
 const wake=()=>{if(timer===undefined)timer=system.runInterval(pass,period);};
 if(dormant){set.wake=wake;if(set.size)wake();}
 else wake();
 return timer;
}
// Cosmetic effects on a slower beat than the logic, staggered per block so they do not all fire on one tick.
export function onBeat(key,seconds){
 let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))|0;
 return (Math.floor(system.currentTick/20)+Math.abs(h))%seconds===0;
}
