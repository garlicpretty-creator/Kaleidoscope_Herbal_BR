import {system,world} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {loadedBlock} from './blockStore.js';
import {redrawGrinder} from '../custom_components/herbGrinder.js';
import {redrawMortar} from '../custom_components/mortar.js';
import {redrawCutter} from '../custom_components/herbCutter.js';
// v1.2.8 (B017 plan C'): the grinder, mortar and cutter switched from the shared 42-item display index to their
// own short lists. A station placed before the upgrade still holds its old `shown` value, so the picture on it
// could be the wrong herb (the cutter has no block tick to correct it). Once after the upgrade, every one of
// these stations that has a saved record is redrawn from it as soon as its chunk is loaded. Stations without a
// record are empty and show nothing either way. The pass ends when all are done, or after RETRY_FOR ticks
// (whatever is left is redrawn on its next use, and the pass resumes after the next restart).
export const FLAG=id('display_v128');
export const RETRY_EVERY=40,RETRY_FOR=36000;
const REDRAW={herb_grinder:[id('herb_grinder_decor'),redrawGrinder],mortar:[id('mortar'),redrawMortar],herb_cutter:[id('herb_cutter'),redrawCutter]};
let timer;
/** Returns how many stations are queued (0: nothing to do). records: Map key -> record from readStore(). */
export function startDisplayMigration(records){
 if(world.getDynamicProperty(FLAG))return 0;
 const pending=new Map([...records].filter(([,r])=>REDRAW[r.type]));
 const pass=()=>{
  for(const [key,record] of pending){
   const block=loadedBlock(record);
   if(!block)continue;                                    // chunk not loaded yet: try again later
   const [type,redraw]=REDRAW[record.type];
   if(block.typeId===type){try{redraw(block);}catch(error){console.warn('[Herbal] display migration: '+error);}}
   pending.delete(key);                                   // redrawn, or the block is gone (storeSweep spills it)
  }
  if(!pending.size){world.setDynamicProperty(FLAG,1);stop();return true;}
  return false;
 };
 const queued=pending.size;
 if(pass())return queued;
 const started=system.currentTick;
 timer=system.runInterval(()=>{if(pass()||system.currentTick-started>=RETRY_FOR)stop();},RETRY_EVERY);
 return queued;
}
function stop(){if(timer!==undefined){system.clearRun(timer);timer=undefined;}}
