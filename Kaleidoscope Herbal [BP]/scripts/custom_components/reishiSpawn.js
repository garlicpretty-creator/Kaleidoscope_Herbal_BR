import {system,world,BlockPermutation} from '@minecraft/server';
import {id,isLog} from '../data/herbs.js';
import {isRaining} from './reishiSpread.js';
import {hand,heldId,takeOne,feedback,refuse} from '../utils/items.js';
const FACE=/** @type {any} */('minecraft:block_face');
export const SPAWN_CHANCE=.15;
const SIDES={north:{x:0,z:-1},south:{x:0,z:1},east:{x:1,z:0},west:{x:-1,z:0}};
// face = the log side that was clicked, the same rule reishiSpread and worldgen use.
export function spawnTarget(logLocation,face){
 const side=SIDES[String(face).toLowerCase()];if(!side)return undefined;
 return {location:{x:logLocation.x+side.x,y:logLocation.y,z:logLocation.z+side.z},face:String(face).toLowerCase()};
}
export const reishiSpawn={
 onRandomTick({block}){
  if(Math.random()>=SPAWN_CHANCE||!isRaining(block.dimension))return;
  const face=block.permutation.getState(FACE)??'south';
  block.setPermutation(BlockPermutation.resolve(id('wild_reishi'),{'minecraft:block_face':face}));
 },
};
// Inoculate a log: reishi powder on a log side places a spawn patch on that side.
export function startReishiInoculation(){
 world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
  const {player,block,blockFace,itemStack,isFirstEvent}=event;
  if(!isFirstEvent||itemStack?.typeId!==id('reishi_powder')||!isLog(block))return;
  const target=spawnTarget(block.location,blockFace);if(!target)return;
  event.cancel=true;
  system.run(()=>{
   try{
    const spot=block.dimension.getBlock(target.location);if(!spot?.isAir){refuse(block,'full');return;} // v1.4.0: that side is taken
    spot.setPermutation(BlockPermutation.resolve(id('reishi_spawn'),{'minecraft:block_face':target.face}));
    const slot=hand(player);
    if(heldId(slot)===id('reishi_powder'))takeOne(player,slot);
    feedback(spot,'minecraft:crop_growth_emitter','dig.grass');
   }catch(error){console.warn('[Herbal] Reishi inoculation: '+error);}
  });
 });
}
