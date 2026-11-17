import {id} from '../data/herbs.js';
// v1.1.0: steam drifts up from placed cups that still hold tea. Cookery's cup component does the drinking;
// this only adds the steam, on the block's own slow tick (every 3 to 5 seconds).
export const teaSteam={
 onTick({block}){
  let filled=0;try{filled=Number(block.permutation.getState('kaleidoscope_cookery:tea_count')??0);}catch{}
  if(filled>0)try{block.dimension.spawnParticle(id('tea_steam'),{x:block.x+.5,y:block.y+.3,z:block.z+.5});}catch{}
 },
};
