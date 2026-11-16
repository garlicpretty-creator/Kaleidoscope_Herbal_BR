import {id} from './herbs.js';
export const NEGATIVE_EFFECTS = ['poison','wither','nausea','blindness','darkness','weakness','slowness','mining_fatigue'];
const effect=(name,seconds,amplifier=0)=>({name,ticks:seconds*20,amplifier});
// v1.1.0: a brew is either done (熟) or burnt (焦); the 下/中/上 grades are gone. Every herb leads or joins
// at least one formula or dish. A formula with more specific herbs is listed before the ones it overlaps.
export const DECOCTIONS = [
  {id:id('ginseng'),ingredients:[id('ginseng_slices'),id('ginseng_slices'),id('licorice_slices')],result:id('ginseng_decoction'),servings:2,time:600,
    effects:[effect('regeneration',30),effect('absorption',120)]},
  {id:id('four_herb'),ingredients:[id('angelica_slices'),id('angelica_slices'),id('licorice_slices'),id('dried_honeysuckle')],result:id('four_herb_decoction'),servings:3,time:500,
    effects:[effect('regeneration',45)]},
  {id:id('reishi'),ingredients:[id('reishi_powder'),id('reishi_powder'),id('licorice_slices')],result:id('reishi_decoction'),servings:3,time:700,clear:NEGATIVE_EFFECTS,
    effects:[effect('resistance',60)]},
  // 蟲草湯: 補肺 — breath under water.
  {id:id('cordyceps'),ingredients:[id('dried_cordyceps'),id('ginseng_slices'),id('licorice_slices')],result:id('cordyceps_decoction'),servings:2,time:800,
    effects:[effect('water_breathing',180),effect('regeneration',20)]},
  // 四君子湯: 補氣健脾 — a sturdier body.
  {id:id('four_gentlemen'),ingredients:[id('ginseng_slices'),id('poria_slices'),id('licorice_slices')],result:id('four_gentlemen_decoction'),servings:3,time:600,
    effects:[effect('health_boost',120),effect('regeneration',10)]},
  // 艾歸湯: 溫經驅寒 — warmth back in the limbs.
  {id:id('mugwort_angelica'),ingredients:[id('dried_mugwort'),id('dried_mugwort'),id('angelica_slices')],result:id('mugwort_angelica_decoction'),servings:3,time:500,clear:['slowness','weakness'],
    effects:[effect('strength',60)]},
  // 甘棗湯: 甘草解毒 — settles the stomach.
  {id:id('licorice_jujube'),ingredients:[id('licorice_slices'),id('licorice_slices'),id('dried_jujube')],result:id('licorice_jujube_decoction'),servings:3,time:400,clear:['poison','hunger','nausea'],
    effects:[effect('regeneration',20)]},
];
export const FOOD_EFFECTS = {
  [id('bitter_dregs')]: {effects:[effect('nausea',5)]},
  [id('ginseng_chicken_soup')]: {effects:[effect('haste',180,1)]},
  [id('angelica_mutton_soup')]: {effects:[effect('resistance',180),effect('regeneration',20)]},
  [id('four_herb_chicken')]: {effects:[effect('health_boost',180)]},
  [id('honeysuckle_tea')]: {effects:[effect('fire_resistance',60)],clear:['poison']},
  [id('honeysuckle_tea_dew')]: {effects:[effect('fire_resistance',120)],clear:['poison']},
  [id('chrysanthemum_tea')]: {effects:[effect('night_vision',90)],clear:['blindness','darkness']},
  [id('ginseng_wine')]: {effects:[effect('regeneration',20)]},
  [id('angelica_wine')]: {effects:[effect('haste',60)]},
  [id('reishi_wine')]: {effects:[effect('resistance',30)],clear:['poison']},
  [id('goji_jujube_soup')]: {effects:[effect('night_vision',90)]},
  [id('goji_chicken_soup')]: {effects:[effect('regeneration',20)]},
  [id('jujube_sweet_soup')]: {effects:[effect('absorption',60)]},
  [id('goji_tea')]: {effects:[effect('night_vision',120)]},
  [id('jujube_tea')]: {effects:[effect('regeneration',15)]},
  [id('goji_wine')]: {effects:[effect('night_vision',60)]},
  [id('jujube_wine')]: {effects:[effect('absorption',60)]},
};
for(const recipe of DECOCTIONS)FOOD_EFFECTS[recipe.result]={effects:recipe.effects,clear:recipe.clear};
// Unsliced forms count as their base herb (a slice is one third of a dried root, so slicing still pays).
const variants = {
 [id('ginseng_slices')]:['ginseng_slices','dried_ginseng','dried_broken_ginseng','broken_ginseng_root'].map(id),
 [id('angelica_slices')]:['angelica_slices','dried_angelica'].map(id),
 [id('licorice_slices')]:['licorice_slices','dried_licorice'].map(id),
 [id('poria_slices')]:['poria_slices','dried_poria'].map(id),
};
// 佐使: optional supporting herbs, each adding one serving. Each kind counts once; at most two may join a formula.
export const ADJUVANTS = {
 [id('dried_goji')]:{servings:1},
 [id('dried_cordyceps')]:{servings:1},
};
export const MAX_ADJUVANTS=2,MAX_SERVINGS=4;
function take(rest,options){const i=rest.findIndex(x=>options.includes(x));if(i<0)return false;rest.splice(i,1);return true;}
export function matchDecoction(items){
 for(const recipe of DECOCTIONS){
  const rest=[...items];
  if(!recipe.ingredients.every(slot=>take(rest,variants[slot]??[slot])))continue;
  if(rest.length>MAX_ADJUVANTS||!rest.every(x=>ADJUVANTS[x]))continue;
  let servings=recipe.servings;
  for(const kind of new Set(rest))servings+=ADJUVANTS[kind].servings??0;
  return {...recipe,servings:Math.min(MAX_SERVINGS,servings)};
 }
 return undefined;
}
export const burnLimit=heat=>heat==='strong'?400:1200;
export function advancePot(record,heat,elapsed=20){
 if(!heat||![2,3].includes(record.stage))return false;
 const speed=heat==='strong'?2:1;
 if(record.stage===2){
  record.progress=Math.min(record.time,record.progress+elapsed*speed);
  if(record.progress>=record.time){
   record.stage=3; record.warm=0; record.servings=record.recipeServings;
   record.output=record.result;
  }
 }else{
  record.warm+=elapsed;
  if(record.warm>=burnLimit(heat)){record.stage=4;record.output=id('burnt_dregs');record.servings=1;}
 }
 return true;
}
export function contentsOnBreak(record){
 if(!record)return [];
 if(record.stage===1||record.stage===2)return record.ingredients.map(item=>({id:item,count:1}));
 if(record.stage===3||record.stage===4)return record.servings>0?[{id:record.output,count:record.servings}]:[];
 return [];
}
