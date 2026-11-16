// ## Independent copy of the public Cookery 1.6.4 heat rules, extended with strength.
const unconditional=new Set(['minecraft:fire','minecraft:soul_fire','minecraft:lava','minecraft:flowing_lava','minecraft:magma','minecraft:magma_block']);
const legacy=new Set(['minecraft:lit_furnace','minecraft:lit_smoker','minecraft:lit_blast_furnace']);
const furnace=new Set(['minecraft:furnace','minecraft:smoker','minecraft:blast_furnace',...legacy]);
// v1.1.0: kaleidoscope_herbal:heat_sources is our own public tag; any pack's block carrying it heats a clay pot (mild).
const tags=['kaleidoscope_herbal:heat_sources','kaleidoscope_cookery:heat_sources','farmersdelight:heat_sources','c:heat_sources','c:heat_source'];
function litState(block){
 try{for(const [name,value] of Object.entries(block?.permutation?.getAllStates?.()??{})){
  const key=name.split(':').pop(); if(key==='lit'||key==='lit_bit')return value===true||value===1;
 }}catch{} return undefined;
}
export function isActiveHeatSource(block){
 if(!block)return false;
 const lit=litState(block); if(lit!==undefined)return lit;
 if(block.typeId==='kaleidoscope_cookery:stove'){try{return block.permutation.getState('kaleidoscope_cookery:lit')===true;}catch{return false;}}
 if(block.typeId==='minecraft:campfire'||block.typeId==='minecraft:soul_campfire'){try{return (block.permutation.getState('extinguished_bit')??block.permutation.getState('extinguished'))!==true;}catch{return true;}}
 if(unconditional.has(block.typeId)||legacy.has(block.typeId))return true;
 return tags.some(tag=>{try{return block.hasTag(tag);}catch{return false;}});
}
export function heatOf(block){if(!isActiveHeatSource(block))return null;return unconditional.has(block.typeId)||furnace.has(block.typeId)?'strong':'mild';}
export function heatBelow(block){try{return heatOf(block.below());}catch{return null;}}
