import {ItemStack,system} from '@minecraft/server';
import {SOUPS} from '../data/placeableSoups.js';
import {FOOD_EFFECTS} from '../data/decoctions.js';
import {blockKey,setStates} from '../utils/blockStore.js';
import {hand,heldId,giveStack,creative} from '../utils/items.js';
import {applyHeat} from '../utils/constitution.js';
import {emitEvt} from '../utils/bus.js';
import {playFrames,isPlaying} from '../utils/frames.js';
import {id} from '../data/herbs.js';
// v1.1.0: a placed bowl is drunk in three sips over about a second: the broth goes down with each sip and a
// little steam rises, the empty bowl shows for a moment, then the meal takes effect and the bowl comes back.
const SIPS=id('sips');
function sip(block){
 const at={x:block.x+.5,y:block.y+.3,z:block.z+.5};
 try{block.dimension.spawnParticle(id('pot_simmer'),at);}catch{}
 try{block.dimension.playSound('random.drink',at,{volume:.4,pitch:.9+Math.random()*.2});}catch{}
}
const pending=new Map();
function queue(block,permutation,suppress=false,priority=0){
 const type=permutation?.type.id;if(!SOUPS[type])return;
 const key=blockKey(block),old=pending.get(key);
 if(old){if(priority>=old.priority)Object.assign(old,{type,suppress,priority});return;}
 const r={type,suppress,priority,dimension:block.dimension,location:block.center()};pending.set(key,r);
 system.runTimeout(()=>{if(pending.get(key)===r)pending.delete(key);if(!r.suppress)r.dimension.spawnItem(new ItemStack(r.type),r.location);},2);
}
export function spillExplodedSoup({block,explodedBlockPermutation}){queue(block,explodedBlockPermutation,false,1);}
export const herbalSoup={
 onPlace({block}){pending.delete(blockKey(block));},
 onBreak({block,brokenBlockPermutation}){queue(block,brokenBlockPermutation);},
 onPlayerBreak({block,brokenBlockPermutation,player=undefined}){queue(block,brokenBlockPermutation,player?creative(player):false,1);},
 onPlayerInteract({block,player=undefined}){
  if(!player||heldId(hand(player)))return;
  const food=SOUPS[block.typeId];if(!food||isPlaying(block))return;
  if(player.isSneaking){giveStack(player,new ItemStack(block.typeId));queue(block,block.permutation,true,2);block.setType('minecraft:air');return;}
  playFrames(block,[{at:0,states:{[SIPS]:1},then:sip},{at:7,states:{[SIPS]:2},then:sip},{at:14,states:{[SIPS]:3},then:sip},
   {at:22,then:b=>{if(player.isValid)finish(b,player,food);else setStates(b,{[SIPS]:0});}}]);
 },
};
// The meal itself, once the bowl is empty.
function finish(block,player,food){
  giveStack(player,new ItemStack('minecraft:bowl'));
  const hunger=player.getComponent('minecraft:player.hunger'),saturation=player.getComponent('minecraft:player.saturation');
  if(hunger)hunger.setCurrentValue(Math.min(hunger.effectiveMax,hunger.currentValue+food.nutrition));
  if(saturation)saturation.setCurrentValue(Math.min(saturation.effectiveMax,saturation.currentValue+food.nutrition*food.saturation*2));
  const data=FOOD_EFFECTS[block.typeId];
  for(const name of data?.clear??[])player.removeEffect(name);
  for(const effect of data?.effects??[])player.addEffect(effect.name,effect.ticks,{amplifier:effect.amplifier,showParticles:true});
  applyHeat(player,block.typeId);emitEvt('ate_placed',player,{id:block.typeId,kind:'soup'});
  try{block.dimension.playSound('random.burp',player.location,{volume:.3,pitch:1.1});}catch{}
  queue(block,block.permutation,true,2);block.setType('minecraft:air');
}
