import {world,BlockPermutation,BlockVolume,WeatherType} from '@minecraft/server';
import {id,isLog,LOGS} from '../data/herbs.js';
// face = the log side the mushroom grows on; matches worldgen features and player placement.
export const LOG_FACES=[{x:1,z:0,face:'east'},{x:-1,z:0,face:'west'},{x:0,z:1,face:'south'},{x:0,z:-1,face:'north'}];
export function isRaining(dimension){
 try{const w=dimension.getWeather();return w===WeatherType.Rain||w===WeatherType.Thunder;}
 catch{return !!world.getDynamicProperty(id('rain/'+dimension.id));}
}
function* blocksIn(dimension,base,filter){
 const volume=new BlockVolume({x:base.x-4,y:base.y-4,z:base.z-4},{x:base.x+4,y:base.y+4,z:base.z+4});
 try{for(const p of dimension.getBlocks(volume,filter,false).getBlockLocationIterator())yield p;return;}catch{}
 // Fallback for engines without filtered getBlocks.
 for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++)for(let z=-4;z<=4;z++){
  let b;try{b=dimension.getBlock({x:base.x+x,y:base.y+y,z:base.z+z});}catch{continue;}
  if(b&&(filter.includeTypes.includes(b.typeId)||(filter.includeTypes===LOGS&&isLog(b))))yield b.location;
 }
}
export function trySpread(block,source=id('wild_reishi')){
 const base=block.location,dimension=block.dimension,near=p=>(p.x-base.x)**2+(p.y-base.y)**2+(p.z-base.z)**2<=16;
 let count=0;
 for(const p of blocksIn(dimension,base,{includeTypes:[id('wild_reishi')]}))if(near(p)&&++count>=4)return false;
 const candidates=[];
 for(const p of blocksIn(dimension,base,{includeTypes:LOGS})){
  if(!near(p))continue;
  for(const side of LOG_FACES){
   const q={x:p.x+side.x,y:p.y,z:p.z+side.z};
   if(!near(q))continue;
   try{if(dimension.getBlock(q)?.isAir)candidates.push({q,face:side.face});}catch{}
  }
  if(candidates.length>=12)break;
 }
 if(!candidates.length)return false;
 const selected=candidates[Math.floor(Math.random()*candidates.length)];
 dimension.getBlock(selected.q)?.setPermutation(BlockPermutation.resolve(id('wild_reishi'),{'minecraft:block_face':selected.face}));
 return true;
}
export const reishiSpread={
 onRandomTick({block}){
  if(Math.random()>=.05||!isRaining(block.dimension))return;
  trySpread(block);
 },
};
