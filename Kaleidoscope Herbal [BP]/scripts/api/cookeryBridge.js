import {system,world} from '@minecraft/server';
import {COOKERY_RECIPES} from '../data/cookeryRecipes.js';
import {publishGuidebook} from './guidebookPublish.js';
const SOURCE='kaleidoscope_herbal',HOST='kaleidoscope_cookery:';
let ready=false,timedOut=false,sequence=0,guidePending=undefined;
const GUIDE_DEBOUNCE=40;
const warned=new Set();
function warn(player){
 if(warned.has(player.id))return;warned.add(player.id);
 console.warn('[Herbal] Cookery was not detected; host recipes are disabled.');
 // Planning rule 3: one actionbar notice per player, nothing persistent on screen.
 try{player.onScreenDisplay.setActionBar({translate:'kh.message.no_cookery'});}catch{}
}
export function recipesFor(info){const capabilities=new Set(info.capabilities??[]);return COOKERY_RECIPES.filter(recipe=>capabilities.has(recipe.kind));}
export function startCookeryBridge(){
 system.afterEvents.scriptEventReceive.subscribe(event=>{ // v1.2.6: only Cookery's events reach it (was every script event of every pack)
  if(event.id!==HOST+'api_ready'&&event.id!==HOST+'guidebook_ready')return;
  let info;try{info=JSON.parse(event.message);}catch{return;}
  if(info.api!==1)return;
  if(event.id===HOST+'guidebook_ready'){
   // The guide is ~200 KB of chunks; a burst of ready signals sends it once, after the burst settles.
   if(guidePending!==undefined)system.clearRun(guidePending);
   guidePending=system.runTimeout(()=>{guidePending=undefined;publishGuidebook();},GUIDE_DEBOUNCE);
   return;
  }
  ready=true;const generation=++sequence;
  const list=recipesFor(info);
  // Each ready replays the same deterministic registrations; stale queued bursts stop.
  list.forEach((recipe,index)=>system.runTimeout(()=>{if(generation===sequence)system.sendScriptEvent(HOST+'register_recipe',JSON.stringify(recipe));},Math.floor(index/4)+1));
  if(info.capabilities?.includes('guidebook_extensions'))system.sendScriptEvent(HOST+'guidebook_ping',SOURCE);
 },{namespaces:['kaleidoscope_cookery']});
 system.run(()=>{
  system.sendScriptEvent(HOST+'api_ping',SOURCE);
  system.sendScriptEvent(HOST+'guidebook_ping',SOURCE);
 });
 // Host broadcasts ready too. Retry ping covers a host which subscribes on a later tick.
 system.runTimeout(()=>{if(!ready)system.sendScriptEvent(HOST+'api_ping',SOURCE);},40);
 system.runTimeout(()=>{timedOut=!ready;if(timedOut)for(const player of world.getAllPlayers())warn(player);},200);
 world.afterEvents.playerSpawn.subscribe(({player,initialSpawn})=>{if(initialSpawn&&timedOut&&!ready)system.run(()=>warn(player));});
}
