import {id} from './herbs.js';
import {VERSION} from './version.js';
export const HERBAL_WINES=[
 {key:'ginseng_wine',ingredients:['minecraft:wheat',id('ginseng_slices'),id('licorice_slices')],title:{zh_TW:'人參調和酒',zh_CN:'人参调和酒',en_US:'Ginseng Herbal Wine'}},
 {key:'angelica_wine',ingredients:['minecraft:wheat',id('angelica_slices'),'minecraft:honeycomb'],title:{zh_TW:'當歸蜜釀',zh_CN:'当归蜜酿',en_US:'Angelica Honey Wine'}},
 {key:'reishi_wine',ingredients:['minecraft:wheat',id('reishi_powder'),id('licorice_slices')],title:{zh_TW:'靈芝養神酒',zh_CN:'灵芝养神酒',en_US:'Reishi Herbal Wine'}},
 {key:'goji_wine',ingredients:['minecraft:wheat',id('dried_goji'),id('licorice_slices')],title:{zh_TW:'枸杞調和酒',zh_CN:'枸杞调和酒',en_US:'Goji Herbal Wine'}},
 {key:'jujube_wine',ingredients:['minecraft:wheat',id('dried_jujube'),'minecraft:honeycomb'],title:{zh_TW:'紅棗蜜釀',zh_CN:'红枣蜜酿',en_US:'Jujube Honey Wine'}},
];
export const WINE_MATERIAL_NAMES={
 'minecraft:wheat':{zh_TW:'小麥',zh_CN:'小麦',en_US:'Wheat'},
 'minecraft:honeycomb':{zh_TW:'蜂蜜脾',zh_CN:'蜜脾',en_US:'Honeycomb'},
 [id('ginseng_slices')]:{zh_TW:'人參片',zh_CN:'人参片',en_US:'Ginseng Slices'},
 [id('licorice_slices')]:{zh_TW:'甘草片',zh_CN:'甘草片',en_US:'Licorice Slices'},
 [id('angelica_slices')]:{zh_TW:'當歸片',zh_CN:'当归片',en_US:'Angelica Slices'},
 [id('reishi_powder')]:{zh_TW:'靈芝粉',zh_CN:'灵芝粉',en_US:'Reishi Powder'},
 [id('dried_goji')]:{zh_TW:'乾枸杞',zh_CN:'干枸杞',en_US:'Dried Goji Berries'},
 [id('dried_jujube')]:{zh_TW:'乾紅棗',zh_CN:'干红枣',en_US:'Dried Jujube'},
};
export const WINE_BATCH={waterBuckets:4,fluidAmount:4000,maxBatch:16,carrier:'minecraft:glass_bottle'};
function body(w,locale){
 const items=w.ingredients.map(item=>WINE_MATERIAL_NAMES[item][locale]+' ×1').join(locale==='en_US'?', ':'、');
 if(locale==='zh_TW')return '單瓶配方：水桶 ×4（4000 mB）；'+items+'。先加滿水，再投材料。三種材料各 n 份可釀 n 瓶（1～16）；持整疊材料會批次投入，請先分好等量份數，多投入的材料不會返還。\n\n關上桶蓋，待酒桶下一次檢查完成釀製。在酒嘴下擺空玻璃瓶，再開酒嘴裝瓶。這五款藥酒不分熟成品級，延長存放不會改變藥酒種類。\n\n可放地上並疊至四瓶；空手飲用、蹲下空手取回；飲後返還玻璃瓶。不作調酒材料。';
 if(locale==='zh_CN')return '单瓶配方：水桶 ×4（4000 mB）；'+items+'。先加满水，再投材料。三种材料各 n 份可酿 n 瓶（1～16）；持整叠材料会批次投入，请先分好等量份数，多投入的材料不会返还。\n\n关上桶盖，待酒桶下一次检查完成酿制。在酒嘴下摆空玻璃瓶，再开酒嘴装瓶。这五款药酒不分熟成品质，延长存放不会改变药酒种类。\n\n可放地上并叠至四瓶；空手饮用、潜行空手取回；饮后返还玻璃瓶。不作调酒材料。';
 return 'One-bottle batch: 4 water buckets (4000 mB); '+items+'. Fill the barrel before adding ingredients. Equal amounts of all three ingredients make 1–16 bottles. Held stacks are inserted in batches; split equal amounts first. Excess ingredients are not returned.\n\nClose the lid and wait for the next barrel check. Place an empty glass bottle below the tap, then open the tap to bottle the wine. These five wines have no aging quality variants.\n\nPlace up to four bottles on the ground. Empty-hand use drinks; sneak to retrieve. Returns a glass bottle. Not a mixology input.';
}
const winePages=HERBAL_WINES.map(w=>({id:id('guide/'+w.key),item:id(w.key),category:'barrel',title:w.title,icon:'textures/kaleidoscope_herbal/items/'+w.key,recipeIds:[id('barrel/'+w.key)],body:Object.fromEntries(['zh_TW','zh_CN','en_US'].map(lc=>[lc,body(w,lc)]))}));
// Public product pages give the host localized names for external ingredients.
const ingredientPages=Object.entries(WINE_MATERIAL_NAMES).filter(([item])=>item.startsWith('kaleidoscope_herbal:')).map(([item,title])=>({id:id('guide/ingredient_'+item.split(':')[1]),item,category:'ingredients',title,icon:'textures/kaleidoscope_herbal/items/'+item.split(':')[1],body:{zh_TW:'藥酒用炮製藥材；採集與炮製方法請見廚房圖鑑的《本草》。',zh_CN:'药酒用炮制药材；采集与炮制方法请见厨房图鉴的《本草》。',en_US:'Prepared medicinal wine ingredient. See Materia Medica in the Cookery guide for gathering and processing.'}}));
export const TAVERN_PAYLOAD={
 api:1,source:'kaleidoscope_herbal',version:VERSION,
 title:{zh_TW:'森羅物語：草本',zh_CN:'森罗物语：草本',en_US:'Kaleidoscope Herbal'},
 requires:['barrel_recipes','guide_product_pages','chunk_transport','acknowledgements'],
 recipes:HERBAL_WINES.map(w=>({id:id('barrel/'+w.key),kind:'barrel',title:w.title,fluid:'minecraft:water',ingredients:w.ingredients.map(item=>[item]),carrier:WINE_BATCH.carrier,unitTime:4800,output:{item:id(w.key)}})),
 pages:[...winePages,...ingredientPages],
};
