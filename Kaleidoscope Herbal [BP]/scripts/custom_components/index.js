import {herbalSoup} from './herbalSoup.js';
import {system} from '@minecraft/server';
import {clayPot,spillPot} from './clayPot.js';
import {incenseBurner,spillBurner} from './incenseBurner.js';
import {mortar} from './mortar.js';
import {cropGrowth} from './cropGrowth.js';
import {ginsengCrop} from './ginsengCrop.js';
import {reishiSpread} from './reishiSpread.js';
import {reishiSpawn} from './reishiSpawn.js';
import {herbalWine} from './herbalWine.js';
import {herbCabinet} from './herbCabinet.js';
import {wildHoneysuckle} from './wildHoneysuckle.js';
import {decorStack} from './decorStack.js';
import {teaSteam} from './teaSteam.js';
import {poriaSpawn} from './poriaSpawn.js';
import {hutMarker} from '../utils/herbalist.js';
const components={
 herbal_soup:herbalSoup,herbal_wine:herbalWine,herb_cabinet:herbCabinet,
 clay_pot:{...clayPot,onBreak:({block})=>spillPot(block)},
 incense_burner:{...incenseBurner,onBreak:({block})=>spillBurner(block)},mortar,
 crop_growth:cropGrowth,ginseng_crop:ginsengCrop,reishi_spread:reishiSpread,reishi_spawn:reishiSpawn,wild_honeysuckle_drops:wildHoneysuckle,
 decor_stack:decorStack,tea_steam:teaSteam,poria_spawn:poriaSpawn,hut_marker:hutMarker,
};
export function registerComponents(){
 system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
  for(const [name,component] of Object.entries(components))blockComponentRegistry.registerCustomComponent(`kaleidoscope_herbal:${name}`,component);
 });
}
