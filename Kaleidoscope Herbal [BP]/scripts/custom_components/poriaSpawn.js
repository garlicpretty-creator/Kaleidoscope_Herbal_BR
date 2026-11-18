import {system,world,BlockPermutation} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {isRaining} from './reishiSpread.js';
import {spawnTarget} from './reishiSpawn.js';
import {hand,heldId,takeOne,feedback} from '../utils/items.js';
import {blockAt} from '../utils/blockStore.js';
// v1.2.0 茯苓段木: poria powder on the side of a spruce log that stands on soil starts a culture there. In dry
// weather the culture now and then puts up a wild poria on the soil around the log: within PORIA_RADIUS blocks,
// at most PORIA_MAX at a time. The culture stays until broken (it returns the powder).
export const PORIA_CHANCE=.12,PORIA_RADIUS=4,PORIA_MAX=3;
export const SPRUCE=new Set(['minecraft:spruce_log','minecraft:stripped_spruce_log','minecraft:spruce_wood','minecraft:stripped_spruce_wood']);
export const SOIL=new Set(['minecraft:podzol','minecraft:dirt','minecraft:grass_block','minecraft:coarse_dirt']); // what wild poria may stand on
const OPPOSITE={north:'south',south:'north',east:'west',west:'east'};
// A culture works only on a spruce log whose bottom rests on soil.
export function logReady(log){return !!log&&SPRUCE.has(log.typeId)&&SOIL.has(blockAt(log.dimension,{...log.location,y:log.location.y-1})?.typeId);}
// Where a new poria may go, given a lookup of block ids around the log: an air block on soil, near the log's foot.
export function poriaSpots(lookup,log,radius=PORIA_RADIUS){
 const spots=[];let grown=0;
 for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)for(let dy=-2;dy<=1;dy++){
  const p={x:log.x+dx,y:log.y+dy,z:log.z+dz},here=lookup(p);
  if(here===id('wild_poria')){grown++;continue;}
  if(here==='minecraft:air'&&SOIL.has(lookup({...p,y:p.y-1})))spots.push(p);
 }
 return {spots,grown};
}
export const poriaSpawn={
 onRandomTick({block}){
  if(Math.random()>=PORIA_CHANCE||isRaining(block.dimension))return;
  const face=String(block.permutation.getState(/** @type {any} */('minecraft:block_face'))??'south');
  const back=spawnTarget(block.location,OPPOSITE[face]);if(!back)return;
  const log=blockAt(block.dimension,back.location);if(!logReady(log))return;
  const {spots,grown}=poriaSpots(p=>blockAt(block.dimension,p)?.typeId,log.location);
  if(grown>=PORIA_MAX||!spots.length)return;
  const spot=blockAt(block.dimension,spots[Math.floor(Math.random()*spots.length)]);if(!spot)return;
  try{spot.setType(id('wild_poria'));feedback(spot,'minecraft:crop_growth_emitter','dig.grass');}catch{}
 },
};
export function startPoriaInoculation(){
 world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
  const {player,block,blockFace,itemStack,isFirstEvent}=event;
  if(!isFirstEvent||itemStack?.typeId!==id('poria_powder')||!SPRUCE.has(block.typeId))return;
  const target=spawnTarget(block.location,blockFace);if(!target)return;
  event.cancel=true;
  system.run(()=>{
   try{
    const spot=block.dimension.getBlock(target.location);if(!spot?.isAir)return;
    // A log not standing on soil cannot feed a culture; say so with the refusal fizz instead of wasting powder.
    if(!logReady(block)){feedback(spot,'minecraft:basic_smoke_particle','random.fizz');return;}
    spot.setPermutation(BlockPermutation.resolve(id('poria_spawn'),{'minecraft:block_face':target.face}));
    const slot=hand(player);
    if(heldId(slot)===id('poria_powder'))takeOne(player,slot);
    feedback(spot,'minecraft:crop_growth_emitter','dig.grass');
   }catch(error){console.warn('[Herbal] Poria inoculation: '+error);}
  });
 });
}
