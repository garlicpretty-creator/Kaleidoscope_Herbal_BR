import {id} from './herbs.js';
// v1.1.0 散劑: single-herb powders (Cookery millstone) are mixed in the mortar into a medicinal powder with a
// potion-like effect. A mix that matches no formula gives 奇怪藥散, whose effect is fixed per mix and per world.
const effect=(name,seconds,amplifier=0)=>({name,ticks:Math.max(1,Math.round(seconds*20)),amplifier});
// The powder of each herb. Reishi powder and mugwort floss already existed and count as theirs.
export const HERB_POWDERS={ginseng:'ginseng_powder',angelica:'angelica_powder',licorice:'licorice_powder',reishi:'reishi_powder',
 honeysuckle:'honeysuckle_powder',goji:'goji_powder',jujube:'jujube_powder',mugwort:'mugwort_floss',chrysanthemum:'chrysanthemum_powder',
 poria:'poria_powder',cordyceps:'cordyceps_powder'};
export const POWDER_ITEMS=new Set(Object.values(HERB_POWDERS).map(id));
// The colour of each powder (red, green, blue in 0..1), for the puff the pestle raises.
export const POWDER_COLORS=new Map(Object.entries({ginseng_powder:[.78,.68,.47],angelica_powder:[.65,.5,.3],licorice_powder:[.73,.58,.25],
 reishi_powder:[.56,.3,.19],honeysuckle_powder:[.73,.72,.41],goji_powder:[.68,.3,.22],jujube_powder:[.51,.25,.19],mugwort_floss:[.8,.84,.75],
 chrysanthemum_powder:[.81,.67,.21],poria_powder:[.79,.75,.65],cordyceps_powder:[.55,.39,.2]}).map(([k,v])=>[id(k),v]));
export function mixColor(items){
 const known=items.map(i=>POWDER_COLORS.get(i)).filter(Boolean);if(!known.length)return [.8,.75,.6];
 return [0,1,2].map(i=>known.reduce((s,c)=>s+c[i],0)/known.length);
}
const formula=(result,ingredients,heat,effects,clear)=>({result:id(result),ingredients:ingredients.map(id).sort(),heat,effects,clear});
export const POWDER_FORMULAS=[
 formula('ming_mu_powder',['goji_powder','chrysanthemum_powder'],-10,[effect('night_vision',240)]),                              // 明目散
 formula('qing_re_powder',['honeysuckle_powder','chrysanthemum_powder','licorice_powder'],-40,[effect('fire_resistance',240)],['poison']), // 清熱散
 formula('an_shen_powder',['reishi_powder','jujube_powder','poria_powder'],0,[effect('slow_falling',120),effect('regeneration',10)]),   // 安神散
 formula('xing_qi_powder',['angelica_powder','mugwort_floss'],25,[effect('speed',180)]),                                         // 行氣散
 formula('shen_chong_powder',['ginseng_powder','cordyceps_powder','licorice_powder'],45,[effect('strength',90,1)]),              // 參蟲散
 formula('qing_shen_powder',['poria_powder','licorice_powder'],0,[effect('jump_boost',120,1)]),                                  // 輕身散
 formula('yin_xi_powder',['reishi_powder','mugwort_floss','chrysanthemum_powder'],-10,[effect('invisibility',90)]),              // 隱息散
 formula('hui_chun_powder',['ginseng_powder','jujube_powder'],30,[effect('instant_health',.05),effect('regeneration',10)]),      // 回春散
];
export const STRANGE=id('strange_powder');
// Half help, half harm; one of these per wrong mix.
export const STRANGE_EFFECTS=[effect('speed',60),effect('slowness',30),effect('jump_boost',60),effect('nausea',15),effect('night_vision',60),
 effect('blindness',10),effect('haste',60),effect('mining_fatigue',30),effect('regeneration',10),effect('poison',8),effect('levitation',4),
 effect('weakness',30),effect('absorption',60),effect('hunger',30)];
export const MIN_POWDERS=2,MAX_POWDERS=3,STROKES=3,DOSES=2;
export const mixKey=items=>[...items].sort().join('|');
const BY_KEY=new Map(POWDER_FORMULAS.map(f=>[mixKey(f.ingredients),f]));
export const matchPowder=items=>BY_KEY.get(mixKey(items));
// Which strange effect a wrong mix gives in a world with this salt.
export function strangeIndex(items,salt){
 let h=2166136261;const text=salt+'#'+mixKey(items);
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0)%STRANGE_EFFECTS.length;
}
// The packet carries its kind as a lore mark, so equal wrong mixes stack and players can tell kinds apart.
const MARK='§8✦ ';
export const strangeMark=index=>MARK+(index+1);
export function parseMark(lore){
 for(const line of lore??[]){
  if(typeof line!=='string'||!line.startsWith(MARK))continue;
  const n=Number(line.slice(MARK.length));if(Number.isInteger(n)&&n>=1&&n<=STRANGE_EFFECTS.length)return n-1;
 }
 return undefined;
}
// 封緘藥籤 from a chest: the formula written inside, picked by `roll` in [0,1).
export const SEALED=id('sealed_prescription');
export function sealedFormula(roll=Math.random()){
 const f=POWDER_FORMULAS[Math.min(POWDER_FORMULAS.length-1,Math.floor(roll*POWDER_FORMULAS.length))];
 return {result:f.result,ingredients:[...f.ingredients],via:'mortar'};
}
// What mixing the powders in a mortar gives: {item, formula?} for a formula, {item, mark} for a strange powder.
export function mixResult(items,salt){
 const found=matchPowder(items);
 return found?{item:found.result,formula:{result:found.result,ingredients:[...found.ingredients],via:'mortar'}}:{item:STRANGE,mark:strangeIndex(items,salt)};
}
// v1.4.0: sneak-using a full mortar with one of its makings in hand works the set in the mortar and every further
// full set the player carries, up to BATCH_MAX sets in all. `have`: typeId -> count on hand. Returns the sets in all.
export const BATCH_MAX=4;
export function batchSets(set,have,max=BATCH_MAX){
 const need=new Map();for(const item of set)need.set(item,(need.get(item)??0)+1);
 let extra=max-1;for(const [item,n] of need)extra=Math.min(extra,Math.floor((have.get(item)??0)/n));
 return 1+Math.max(0,extra);
}
