export const NS = 'kaleidoscope_herbal';
export const id = value => `${NS}:${value}`;
export const HERBS = [
  {key:'ginseng', fresh:'fresh_ginseng', dry:'dried_ginseng', processed:'ginseng_slices', wild:'wild_ginseng', biome:'taiga / old-growth taiga', cultivable:true},
  {key:'angelica', fresh:'fresh_angelica', dry:'dried_angelica', processed:'angelica_slices', wild:'wild_angelica', biome:'river / meadow', cultivable:true},
  {key:'licorice', fresh:'fresh_licorice', dry:'dried_licorice', processed:'licorice_slices', wild:'wild_licorice', biome:'savanna', cultivable:true},
  {key:'reishi', fresh:'reishi', dry:'dried_reishi', processed:'reishi_powder', wild:'wild_reishi', biome:'dark forest / old-growth log sides', cultivable:true},
  {key:'honeysuckle', fresh:'honeysuckle', dry:'dried_honeysuckle', wild:'wild_honeysuckle', biome:'jungle / flower forest', cultivable:true},
  {key:'goji', fresh:'fresh_goji', dry:'dried_goji', wild:'wild_goji', biome:'plains / savanna', cultivable:true},
  {key:'jujube', fresh:'fresh_jujube', dry:'dried_jujube', wild:'wild_jujube', biome:'forest / meadow', cultivable:true},
  {key:'mugwort', fresh:'fresh_mugwort', dry:'dried_mugwort', processed:'mugwort_floss', wild:'wild_mugwort', biome:'plains / forest', cultivable:true},
  {key:'chrysanthemum', fresh:'chrysanthemum', dry:'dried_chrysanthemum', wild:'wild_chrysanthemum', biome:'meadow / flower forest', cultivable:true},
  {key:'poria', fresh:'fresh_poria', dry:'dried_poria', processed:'poria_slices', wild:'wild_poria', biome:'taiga podzol', cultivable:false},
  {key:'cordyceps', fresh:'fresh_cordyceps', dry:'dried_cordyceps', wild:'wild_cordyceps', biome:'grove / snowy slopes', cultivable:false},
];
// Herbs grown from seeds on farmland through the shared crop_growth component.
export const FARM_CROPS = ['angelica','licorice','honeysuckle','goji','jujube','mugwort','chrysanthemum'];
export const PREPARED_ITEMS = ['honey_licorice','wine_angelica'];
export const HERB_ITEMS = new Set(HERBS.flatMap(h=>[h.fresh,h.dry,h.processed]).filter(Boolean).concat(['broken_ginseng_root','dried_broken_ginseng','dewy_honeysuckle',...PREPARED_ITEMS]).map(id));
export const MILLING = [
  {input:id('dried_reishi'), outputs:[{id:id('reishi_powder'),count:2,chance:1}]},
  {input:id('dried_mugwort'), outputs:[{id:id('mugwort_floss'),count:2,chance:1}]},
];
// Sun-drying on the 簸箕: fresh herb -> dried herb (same pairs Cookery's bamboo tray dries).
export const DRYING = Object.fromEntries(HERBS.map(h=>[id(h.fresh),id(h.dry)])
  .concat([[id('broken_ginseng_root'),id('dried_broken_ginseng')],[id('dewy_honeysuckle'),id('dried_honeysuckle')]]));
export const LOGS =['oak','spruce','birch','jungle','acacia','dark_oak','mangrove','cherry','pale_oak'].flatMap(x=>[`minecraft:${x}_log`,`minecraft:stripped_${x}_log`]).concat(['minecraft:log','minecraft:log2']);
export const isLog = block => !!block && (LOGS.includes(block.typeId) || block.hasTag?.('log') || block.hasTag?.('minecraft:logs'));
