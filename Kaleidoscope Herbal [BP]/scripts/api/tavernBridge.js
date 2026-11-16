import {system} from '@minecraft/server';
import {TAVERN_PAYLOAD} from '../data/tavernRecipes.js';
import {registerTavernExtension} from './tavernSdk/tavern-extension-client.js';
import {startTavernPresence} from '../utils/tavernPresence.js';
export function startTavernBridge(){
 startTavernPresence();
 return registerTavernExtension(system,TAVERN_PAYLOAD,{log:text=>console.info('[Herbal] '+text)});
}
