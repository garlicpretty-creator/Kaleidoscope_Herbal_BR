import {id} from './herbs.js';
export const NEGATIVE_EFFECTS = ['poison','wither','nausea','blindness','darkness','weakness','slowness','mining_fatigue'];
const effect=(name,seconds,amplifier=0)=>({name,ticks:seconds*20,amplifier});
export const DECOCTIONS = [
  {id:id('ginseng'),ingredients:[id('ginseng_slices'),id('ginseng_slices'),id('licorice_slices')],result:id('ginseng_decoction'),servings:2,time:600,
    effects:{low:[effect('regeneration',15)],normal:[effect('regeneration',30),effect('absorption',120)],high:[effect('regeneration',30),effect('absorption',120,1)]}},
  {id:id('four_herb'),ingredients:[id('angelica_slices'),id('angelica_slices'),id('licorice_slices'),id('dried_honeysuckle')],result:id('four_herb_decoction'),servings:3,time:500,
    effects:{low:[effect('regeneration',15)],normal:[effect('regeneration',45)],high:[effect('regeneration',30,1)]}},
  {id:id('reishi'),ingredients:[id('reishi_powder'),id('reishi_powder'),id('licorice_slices')],result:id('reishi_decoction'),servings:3,time:700,clear:NEGATIVE_EFFECTS,
    effects:{low:[],normal:[effect('resistance',60)],high:[effect('resistance',120)]}},
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
for(const recipe of DECOCTIONS) for(const quality of ['low','normal','high']) {
  FOOD_EFFECTS[recipe.result+(quality==='normal'?'':'_'+quality)]={effects:recipe.effects[quality],clear:recipe.clear};
}
// Prepared (炮製) forms count as their base herb and lift the brew one grade.
export const PREPARED = new Set(['honey_licorice','wine_angelica'].map(id));
const variants = {
 [id('ginseng_slices')]:['ginseng_slices','dried_ginseng','dried_broken_ginseng','broken_ginseng_root'].map(id),
 [id('angelica_slices')]:['angelica_slices','dried_angelica','wine_angelica'].map(id),
 [id('licorice_slices')]:['licorice_slices','dried_licorice','honey_licorice'].map(id),
};
// 佐使: optional supporting herbs. Each kind counts once; at most two may join a formula.
export const ADJUVANTS = {
 [id('dried_jujube')]:{quality:1},
 [id('dried_goji')]:{servings:1},
 [id('poria_slices')]:{quality:1},
 [id('dried_poria')]:{quality:1},
 [id('dried_cordyceps')]:{quality:1,servings:1},
};
export const MAX_ADJUVANTS=2,MAX_SERVINGS=4;
export const multisetKey=items=>[...items].sort().join('|');
function take(rest,options){const i=rest.findIndex(x=>options.includes(x));if(i<0)return false;rest.splice(i,1);return true;}
export function matchDecoction(items){
 for(const recipe of DECOCTIONS){
  const rest=[...items];
  if(!recipe.ingredients.every(slot=>take(rest,variants[slot]??[slot])))continue;
  if(rest.length>MAX_ADJUVANTS||!rest.every(x=>ADJUVANTS[x]))continue;
  const kinds=new Set(rest),bonus={quality:0,servings:0};
  for(const kind of kinds){bonus.quality+=ADJUVANTS[kind].quality??0;bonus.servings+=ADJUVANTS[kind].servings??0;}
  return {...recipe,servings:Math.min(MAX_SERVINGS,recipe.servings+bonus.servings),bonus:bonus.quality};
 }
 return undefined;
}
export function qualityOf(ingredients,everStrong=false,everMild=true,bonus=0){
 let score=1;
 if(everMild&&!everStrong)score++;
 const roots=ingredients.filter(x=>/ginseng|angelica|licorice/.test(x));
 if(roots.length&&roots.every(x=>x.endsWith('_slices')||PREPARED.has(x)))score++;
 if(ingredients.some(x=>PREPARED.has(x)))score++;
 if(ingredients.some(x=>x===id('broken_ginseng_root')||x===id('dried_broken_ginseng')))score-=2;
 if(everStrong)score--;
 score+=bonus;
 return {score,tier:score<=1?'low':score>=4?'high':'normal'};
}
export const burnLimit=heat=>heat==='strong'?400:1200;
export function advancePot(record,heat,elapsed=20){
 if(!heat||![2,3].includes(record.stage))return false;
 const speed=heat==='strong'?2:1;
 if(record.stage===2){
  record.everStrong ||= heat==='strong'; record.everMild ||= heat==='mild';
  record.progress=Math.min(record.time,record.progress+elapsed*speed);
  if(record.progress>=record.time){
   record.stage=3; record.warm=0; record.servings=record.recipeServings;
   const tier=qualityOf(record.ingredients,record.everStrong,record.everMild,record.bonus??0).tier;
   record.output=record.result===id('bitter_dregs')?record.result:record.result+(tier==='normal'?'':'_'+tier);
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
