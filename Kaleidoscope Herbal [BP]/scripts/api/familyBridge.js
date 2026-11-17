import {system} from '@minecraft/server';
import {onSky} from '../utils/awwWorld.js';
import {createFamilyBridge,RANCHING,FISHING} from './familyBridgeCore.js';
// Family handshake (after 1.1.0): wires the sister-pack handshakes (familyBridgeCore.js) to the world.
export function startFamilyBridge(){
 const bridge=createFamilyBridge({send:(id,message)=>system.sendScriptEvent(id,message),onSky,log:text=>console.warn('[Herbal] '+text)});
 system.afterEvents.scriptEventReceive.subscribe(event=>{try{bridge.handle(event.id,event.message,event.sourceType);}catch{}},{namespaces:[RANCHING,FISHING]});
 system.runTimeout(()=>bridge.ping(),20);
 return bridge;
}
