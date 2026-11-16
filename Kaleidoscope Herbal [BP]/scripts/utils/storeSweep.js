import {system} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {allRecords,loadedBlock} from './blockStore.js';
import {spillPot} from '../custom_components/clayPot.js';
import {spillBurner} from '../custom_components/incenseBurner.js';
import {spillCabinet} from '../custom_components/herbCabinet.js';
import {spillMortar} from '../custom_components/mortar.js';
// Blocks removed without a break event (/fill, /setblock, structure loads) leave their saved record behind.
// A slow background job finds loaded positions whose block no longer matches and spills the contents there,
// so world data stops growing and nothing a player stored disappears silently.
export const RECORD_BLOCKS={
  clay_pot:[id('clay_pot'),spillPot],incense_burner:[id('incense_burner'),spillBurner],
 herb_cabinet:[id('herb_cabinet'),spillCabinet],mortar:[id('mortar'),spillMortar],
};
export const SWEEP_TICKS=6000;
export function staleRecord(record,block){
 const entry=RECORD_BLOCKS[record.type];
 return !!entry&&!!block&&block.typeId!==entry[0];
}
export function sweepOnce(){
 return (function*(){
  for(const record of [...allRecords()]){
   const block=loadedBlock(record);
   if(staleRecord(record,block)){try{RECORD_BLOCKS[record.type][1](block);}catch(error){console.warn('[Herbal] sweep: '+error);}}
   yield;
  }
 })();
}
export function startStoreSweep(){
 let running=false;
 system.runInterval(()=>{
  if(running)return;running=true;
  system.runJob((function*(){try{yield* sweepOnce();}finally{running=false;}})());
 },SWEEP_TICKS);
}
