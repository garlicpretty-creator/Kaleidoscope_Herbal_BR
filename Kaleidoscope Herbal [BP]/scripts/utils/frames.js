import {system} from '@minecraft/server';
import {blockKey,setStates,blockAt} from './blockStore.js';
// v1.1.0: short block animations. Blocks cannot play model animations, so a moving part has a few poses in
// its model (tools/anim_models.py) and a block state picks one; this steps that state over a few ticks.
// frames: [{at: ticks from now, states?: {state: value}, then?: block => void}]. A newer animation on the same
// block replaces the older one; an animation stops by itself once its block is broken or replaced.
const runs=new Map();
export const isPlaying=block=>runs.has(blockKey(block));
export function playFrames(block,frames){
 const key=blockKey(block),type=block.typeId,dimension=block.dimension,location={...block.location},token={};
 runs.set(key,token);
 const last=Math.max(...frames.map(f=>f.at));
 for(const frame of frames){
  const step=()=>{
   if(runs.get(key)!==token)return;
   const current=blockAt(dimension,location);
   if(current?.typeId!==type){runs.delete(key);return;}
   if(frame.at===last)runs.delete(key);
   try{if(frame.states)setStates(current,frame.states);frame.then?.(current);}catch(error){console.warn('[Herbal] animation: '+error);}
  };
  if(frame.at<=0)step();else system.runTimeout(step,frame.at);
 }
}
