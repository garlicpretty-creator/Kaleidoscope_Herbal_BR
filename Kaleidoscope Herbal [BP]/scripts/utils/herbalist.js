import {system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
// v1.2.0 走方郎中: a wandering herbalist who trades near the wild herb huts by day and is gone at night.
// The huts tell us where they are: each hut's structure holds one invisible hut_marker block, which records its
// position the first time its chunk ticks. So he only ever appears at real huts, never in a player's house.
export const HERBALIST=id('wandering_herbalist'),HUTS=id('huts');
export const PASS_TICKS=600,PLAYER_RANGE=48,HUT_RANGE=24,APPEAR_CHANCE=.3,MAX_HUTS=256;
const huts=new Map();let loaded=false;
const hutKey=h=>`${h.d}|${h.x}|${h.y}|${h.z}`;
function load(){
 if(loaded)return;loaded=true;
 try{for(const h of JSON.parse(String(world.getDynamicProperty(HUTS)??'[]')))if(h&&typeof h.d==='string')huts.set(hutKey(h),h);}catch{}
}
// Pure: adds a hut to the list unless it is known or the list is full. Returns whether it was added.
export function addHut(map,hut,max=MAX_HUTS){
 const key=hutKey(hut);if(map.has(key)||map.size>=max)return false;
 map.set(key,hut);return true;
}
export const isDay=time=>time>=0&&time<12000;
export const hutMarker={
 onTick({block}){
  load();
  if(addHut(huts,{d:block.dimension.id,x:block.x,y:block.y,z:block.z}))world.setDynamicProperty(HUTS,JSON.stringify([...huts.values()]));
 },
};
function poof(entity){try{entity.dimension.spawnParticle('minecraft:basic_smoke_particle',{...entity.location,y:entity.location.y+1});}catch{}}
function pass(){
 load();
 let time=0;try{time=world.getTimeOfDay();}catch{return;}
 const day=isDay(time);
 if(!day){ // he leaves at dusk, wherever he has wandered to
  for(const d of new Set([...huts.values()].map(h=>h.d))){
   let all=[];try{all=world.getDimension(d).getEntities({type:HERBALIST});}catch{}
   for(const e of all){poof(e);try{e.remove();}catch{}}
  }
  return;
 }
 for(const hut of huts.values()){
  let dimension;try{dimension=world.getDimension(hut.d);}catch{continue;}
  const at={x:hut.x+.5,y:hut.y,z:hut.z+.5};
  let near=[];try{near=dimension.getEntities({type:HERBALIST,location:at,maxDistance:HUT_RANGE});}catch{continue;}
  if(near.length||Math.random()>=APPEAR_CHANCE)continue;
  let players=[];try{players=dimension.getPlayers({location:at,maxDistance:PLAYER_RANGE});}catch{}
  if(!players.length)continue;
  let spot;try{spot=dimension.getBlock(hut);}catch{}
  if(!spot||!(spot.isAir||spot.typeId===id('hut_marker')))continue; // unloaded, or the hut was built over
  try{const e=dimension.spawnEntity(HERBALIST,at);poof(e);}catch(error){console.warn('[Herbal] herbalist: '+error);}
 }
}
export function startHerbalist(){system.runInterval(pass,PASS_TICKS);}
