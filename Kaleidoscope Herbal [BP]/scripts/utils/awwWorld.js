import {system,world} from '@minecraft/server';
import {HERBS,id} from '../data/herbs.js';
import {harvestFactor} from './senluoWeek.js';
// v1.2.12 (森羅×AWW phase 3a, contract §10.3): A Witch Way's world events reach our crops.
//  - sky {kind, phase: start|end, dim}: while any sky event runs in a dimension, our crops there grow twice
//    as fast on random ticks.
//  - reaction {kind: catalyze, dim, x, y, z}: every one of our crops within 8 blocks grows one stage, each
//    block at most once per game day.
// AWW versions that do not send these events change nothing.
const SKY_MAX_TICKS=24000; // a sky event whose end never arrives stops counting after one game day
const active=new Map();    // 'dim|kind' -> tick it started
const norm=d=>typeof d==='string'&&d?(d.includes(':')?d:'minecraft:'+d):undefined;
export function onSky(m){
 const dim=norm(m.dim);if(!dim||typeof m.kind!=='string')return false;
 const key=dim+'|'+m.kind;
 if(m.phase==='start'){active.set(key,system.currentTick);return true;}
 if(m.phase==='end'){active.delete(key);return true;}
 return false;
}
// Growth multiplier for our crops: 2 while a sky event runs in this dimension, times 1.5 in 森羅週曆's harvest
// week (v1.2.13); together they never exceed 2.
export const GROWTH_CAP=2;
export function growthBoost(dimId){return Math.min(GROWTH_CAP,skyBoost(dimId)*harvestFactor());}
function skyBoost(dimId){
 const dim=norm(dimId);if(!dim||!active.size)return 1;
 const now=system.currentTick;let on=false;
 for(const [key,since] of active){
  if(now-since>SKY_MAX_TICKS){active.delete(key);continue;}
  if(key.startsWith(dim+'|'))on=true;
 }
 return on?2:1;
}
export const CATALYZE_RADIUS=8;
// Our crops and their last growth stage.
export const CROP_MAX=new Map([...HERBS.map(h=>[id(h.key+'_crop'),2]),[id('ginseng_crop'),3]]);
const GROWTH=/** @type {any} */(id('growth'));
const grown=new Map(); // block key -> game day it was last catalyzed
function gameDay(){try{return Math.floor(world.getAbsoluteTime()/24000);}catch{return Math.floor(system.currentTick/24000);}}
// Grows one block one stage if it is our crop, not mature, and not catalyzed today. Returns whether it grew.
export function catalyzeBlock(block,day){
 const max=CROP_MAX.get(block?.typeId);if(max===undefined)return false;
 const key=`${block.dimension.id}|${block.x}|${block.y}|${block.z}`;
 if(grown.get(key)===day)return false;
 const age=Number(block.permutation.getState(GROWTH)??0);if(age>=max)return false;
 block.setPermutation(block.permutation.withState(GROWTH,age+1));grown.set(key,day);
 return true;
}
function* scan(dimension,cx,cy,cz,day){
 const r=CATALYZE_RADIUS;let n=0;
 for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)for(let dz=-r;dz<=r;dz++){
  if(dx*dx+dy*dy+dz*dz>r*r)continue;
  let block;try{block=dimension.getBlock({x:cx+dx,y:cy+dy,z:cz+dz});}catch{block=undefined;} // unloaded or out of the world
  if(block&&catalyzeBlock(block,day))try{dimension.spawnParticle('minecraft:crop_growth_emitter',block.center());}catch{}
  if(++n%256===0)yield;
 }
}
export function onReaction(m){
 if(m.kind!=='catalyze')return false;
 const dim=norm(m.dim),[x,y,z]=[m.x,m.y,m.z].map(Number);
 if(!dim||![x,y,z].every(Number.isFinite))return false;
 let dimension;try{dimension=world.getDimension(dim);}catch{return false;}
 const day=gameDay();
 for(const [key,d] of grown)if(d!==day)grown.delete(key);
 system.runJob(scan(dimension,Math.floor(x),Math.floor(y),Math.floor(z),day)); // ~2,100 positions, spread over ticks
 return true;
}
