import {ItemStack} from '@minecraft/server';
import {id} from '../data/herbs.js';

const teas=new Set(['goji_tea','honeysuckle_tea','honeysuckle_tea_dew','jujube_tea','chrysanthemum_tea'].map(id));
const count=(value,fallback,min,max)=>{
 const number=Number(value??fallback);
 return Math.max(min,Math.min(max,Number.isFinite(number)?Math.floor(number):fallback));
};

export function teaContentsOnExplosion(permutation){
 if(!teas.has(permutation.type.id))return [];
 const cups=count(permutation.getState('kaleidoscope_cookery:cup_count'),1,1,4);
 const filled=count(permutation.getState('kaleidoscope_cookery:tea_count'),1,0,cups);
 const items=[];
 if(filled)items.push({id:permutation.type.id,count:filled});
 if(cups>filled)items.push({id:'kaleidoscope_cookery:empty_cup',count:cups-filled});
 return items;
}

export function spillExplodedTea({block,explodedBlockPermutation}){
 // Cookery still owns normal player breaks; this path handles explosions only.
 const location={x:block.x+.5,y:block.y+.35,z:block.z+.5};
 for(const item of teaContentsOnExplosion(explodedBlockPermutation)){
  block.dimension.spawnItem(new ItemStack(item.id,item.count),location);
 }
}
