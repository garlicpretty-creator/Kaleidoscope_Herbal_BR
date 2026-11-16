import {HERBS,MILLING,id} from './herbs.js';
const envelope=(kind,recipe)=>({api:1,kind,source:'kaleidoscope_herbal',recipe:{id:id(`${kind}/${recipe.input?.split(':')[1]??recipe.result.split(':')[1]}`),...recipe}});
export const COOKERY_RECIPES = [
 ...HERBS.map(h=>envelope('bamboo_tray',{input:id(h.fresh),result:id(h.dry),process:'dry',duration:12000})),
 envelope('bamboo_tray',{input:id('broken_ginseng_root'),result:id('dried_broken_ginseng'),process:'dry',duration:12000}),
 envelope('bamboo_tray',{input:id('dewy_honeysuckle'),result:id('dried_honeysuckle'),process:'dry',duration:12000}),
 ...HERBS.filter(h=>h.processed?.endsWith('_slices')).map(h=>envelope('chopping_board',{input:id(h.dry),result:id(h.processed),count:3,cuts:3})),
 ...MILLING.map(recipe=>envelope('millstone',recipe)),
 envelope('teapot',{ingredient:id('dried_honeysuckle'),base:'minecraft:water',result:id('honeysuckle_tea'),count:4,time:240}),
 envelope('teapot',{ingredient:id('dewy_honeysuckle'),base:'minecraft:water',result:id('honeysuckle_tea_dew'),count:4,time:240}),
 envelope('teapot',{ingredient:id('dried_goji'),base:'minecraft:water',result:id('goji_tea'),count:4,time:240}),
 envelope('teapot',{ingredient:id('dried_jujube'),base:'minecraft:water',result:id('jujube_tea'),count:4,time:240}),
 envelope('teapot',{ingredient:id('dried_chrysanthemum'),base:'minecraft:water',result:id('chrysanthemum_tea'),count:4,time:240}),
 .../** @type {[string,string[]][]} */([
  ['ginseng_chicken_soup',['ginseng_slices','minecraft:chicken','minecraft:carrot']],
  ['angelica_mutton_soup',['angelica_slices','minecraft:mutton','licorice_slices']],
  ['four_herb_chicken',['angelica_slices','minecraft:chicken','licorice_slices','dried_honeysuckle']],
  ['goji_jujube_soup',['dried_goji','dried_jujube']],
  ['goji_chicken_soup',['dried_goji','dried_jujube','minecraft:chicken']],
  ['jujube_sweet_soup',['dried_jujube','minecraft:sugar']],
 ]).map(([result,ingredients])=>envelope('stockpot_exact',{ingredients:ingredients.map(x=>[x.includes(':')?x:id(x)]),result:id(result),count:1,time:400,base:'minecraft:water',carrier:'minecraft:bowl',finishedKind:'default'})),
];
