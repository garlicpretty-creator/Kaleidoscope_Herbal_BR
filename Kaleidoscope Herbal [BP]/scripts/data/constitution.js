import {id} from './herbs.js';
// 寒熱: positive warms (溫補), negative cools (清涼); 0 is 平和 and leaves the body alone.
export const HEAT_LIMIT=100,HEAT_RESET=60,HEAT_DECAY=5,HEAT_DECAY_TICKS=100;
const table={
 ginseng_decoction:40,four_herb_decoction:20,reishi_decoction:0,
 ginseng_chicken_soup:30,angelica_mutton_soup:35,four_herb_chicken:25,goji_chicken_soup:15,goji_jujube_soup:5,jujube_sweet_soup:0,
 ginseng_wine:30,angelica_wine:30,reishi_wine:15,goji_wine:20,jujube_wine:15,
 honeysuckle_tea:-35,honeysuckle_tea_dew:-50,chrysanthemum_tea:-40,goji_tea:5,jujube_tea:0,
 bitter_dregs:-15,
};
export const HEAT_VALUES=new Map();
for(const [key,value] of Object.entries(table)){
 HEAT_VALUES.set(id(key),value);
 // Decoction grades share their formula's nature.
 if(key.endsWith('_decoction'))for(const tier of ['_low','_high'])HEAT_VALUES.set(id(key+tier),value);
}
// The Nether doubles warming tonics; cooling drinks keep their strength.
// v1.1.0: 寒熱 values other packs registered through the Herbal API (api/herbalHost.js): typeId -> {heat, source}.
// Our own table always wins; nothing here is saved, clients register again after every api_ready.
export const EXTERNAL_HEAT=new Map();
export const hasExternalHeat=typeId=>EXTERNAL_HEAT.has(typeId);
export function heatDelta(typeId,inNether=false){
 const value=HEAT_VALUES.get(typeId)??EXTERNAL_HEAT.get(typeId)?.heat??0;
 return inNether&&value>0?value*2:value;
}
export function stepHeat(current,delta){
 const heat=Math.max(-HEAT_LIMIT,Math.min(HEAT_LIMIT,current+delta));
 if(heat>=HEAT_LIMIT)return {heat:HEAT_RESET,effect:'overheat'};
 if(heat<=-HEAT_LIMIT)return {heat:-HEAT_RESET,effect:'chill'};
 return {heat,effect:undefined};
}
export const decayHeat=heat=>heat>0?Math.max(0,heat-HEAT_DECAY):Math.min(0,heat+HEAT_DECAY);
// Early warning, still without text: crossing ±60 shows one bodily cue (flushed / shivering); it re-arms
// once the body is back within ±40. A full overheat/chill already gave its own cue, so it only arms.
export const HINT_AT=60,HINT_CLEAR=40;
export function heatHint(flag,heat,effect){
 if(effect)return {flag:heat>0?1:-1,cue:undefined};
 if(heat>=HINT_AT&&flag!==1)return {flag:1,cue:'warm'};
 if(heat<=-HINT_AT&&flag!==-1)return {flag:-1,cue:'cold'};
 if(flag&&Math.abs(heat)<HINT_CLEAR)return {flag:0,cue:undefined};
 return {flag,cue:undefined};
}
