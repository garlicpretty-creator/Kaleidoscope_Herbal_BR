import {system} from '@minecraft/server';
import {startBurntTea} from './burntTea.js';
import {OTC_FOODS,SMOKER_RECIPES} from '../data/burntTeaCatalog.js';
// Handshakes with burnt-tea-dev's packs: our soups and teas on 下單了's restaurant menu (burntTea.js). Optional.
export function startBurntTeaHandshake(){return startBurntTea(system,{source:'kaleidoscope_herbal',foods:OTC_FOODS,smoking:SMOKER_RECIPES});}
