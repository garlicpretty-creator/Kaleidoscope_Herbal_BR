import {herbalSoup} from './herbalSoup.js';
import {system} from '@minecraft/server';
import {clayPot,spillPot} from './clayPot.js';
import {mortar,spillMortar,restoreMortarVisual} from './mortar.js';
import {incenseBurner,spillBurner} from './incenseBurner.js';
import {cropGrowth} from './cropGrowth.js';
import {ginsengCrop} from './ginsengCrop.js';
import {reishiSpread} from './reishiSpread.js';
import {reishiSpawn} from './reishiSpawn.js';
import {herbalWine} from './herbalWine.js';
import {herbCabinet} from './herbCabinet.js';
import {wildHoneysuckle} from './wildHoneysuckle.js';
import {herbGrinder} from './herbGrinder.js';
import {dryingBasket} from './dryingBasket.js';
import {herbCutter} from './herbCutter.js';
import {decorStack} from './decorStack.js';
import {settleStationVisual} from '../utils/stationAnimation.js';
const components={
 herbal_soup:herbalSoup,herbal_wine:herbalWine,herb_cabinet:herbCabinet,
 clay_pot:{...clayPot,onBreak:({block})=>spillPot(block)},
 mortar:{...mortar,onTick:({block})=>{restoreMortarVisual(block);settleStationVisual(block);},onBreak:({block})=>spillMortar(block)},
 incense_burner:{...incenseBurner,onBreak:({block})=>spillBurner(block)},
 crop_growth:cropGrowth,ginseng_crop:ginsengCrop,reishi_spread:reishiSpread,reishi_spawn:reishiSpawn,wild_honeysuckle_drops:wildHoneysuckle,
 herb_grinder:herbGrinder,drying_basket:dryingBasket,herb_cutter:herbCutter,decor_stack:decorStack,
};
export function registerComponents(){
 system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
  for(const [name,component] of Object.entries(components))blockComponentRegistry.registerCustomComponent(`kaleidoscope_herbal:${name}`,component);
 });
}
