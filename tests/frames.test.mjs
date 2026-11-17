// The block animation stepper (scripts/utils/frames.js), with a stand-in game clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stub=`
const timers=[];let tick=0;
export const system={get currentTick(){return tick;},runTimeout(fn,t){timers.push({fn,at:tick+t});return timers.length;},run(fn){return this.runTimeout(fn,0);},clearRun(){}};
export const world={};
export function step(n){for(let i=0;i<n;i++){tick++;for(const t of timers.filter(t=>t.at===tick))t.fn();}}
`;
register('data:text/javascript,'+encodeURIComponent(`
export async function resolve(s,c,n){return s==='@minecraft/server'?{url:'frames-stub:server',shortCircuit:true}:n(s,c);}
export async function load(u,c,n){return u==='frames-stub:server'?{format:'module',source:${JSON.stringify(stub)},shortCircuit:true}:n(u,c);}`));
const {playFrames,isPlaying}=await import(pathToFileURL(resolve(root,'Kaleidoscope Herbal [BP]/scripts/utils/frames.js')).href);
const {step}=await import('@minecraft/server');
// A one-block world; frames here only run callbacks, so the block needs no states.
function makeBlock(type='kaleidoscope_herbal:mortar'){
 const cell={type};
 const block={get typeId(){return cell.type;},location:{x:1,y:2,z:3},dimension:{id:'minecraft:overworld',getBlock:()=>block}};
 return {block,cell};
}
test('frames play in order and the animation ends after its last frame',()=>{
 const {block,cell}=makeBlock(),seen=[];
 playFrames(block,[{at:0,then:()=>seen.push('rise')},{at:3,then:()=>seen.push('strike')},{at:7,then:()=>seen.push('rest')}]);
 assert.deepEqual(seen,['rise']);assert.ok(isPlaying(block));
 step(3);assert.deepEqual(seen,['rise','strike']);
 step(4);assert.deepEqual(seen,['rise','strike','rest']);assert.ok(!isPlaying(block));
});
test('breaking the block stops its animation',()=>{
 const {block,cell}=makeBlock(),seen=[];
 playFrames(block,[{at:0,then:()=>seen.push(0)},{at:5,then:()=>seen.push(5)},{at:9,then:()=>seen.push(9)}]);
 cell.type='minecraft:air';step(10);
 assert.deepEqual(seen,[0]);assert.ok(!isPlaying(block));
});
test('a newer animation on the same block replaces the older one',()=>{
 const {block}=makeBlock(),seen=[];
 playFrames(block,[{at:0,then:()=>seen.push('a0')},{at:4,then:()=>seen.push('a4')}]);
 step(1);playFrames(block,[{at:0,then:()=>seen.push('b0')},{at:4,then:()=>seen.push('b4')}]);
 step(6);assert.deepEqual(seen,['a0','b0','b4']);
});
