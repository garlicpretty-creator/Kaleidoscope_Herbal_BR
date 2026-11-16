import {system} from '@minecraft/server';
import {GUIDEBOOK} from '../data/guidebook.js';
import {VERSION} from '../data/version.js';
import {TAVERN_LINKED,isTavernPresent,onTavernPresent} from '../utils/tavernPresence.js';
const SOURCE='kaleidoscope_herbal',ID='kaleidoscope_herbal:guidebook';
let publication=0,requested=false;
// Chinese + Latin strings can exceed 2048 UTF-8 bytes before 2048 JS characters.
export function utf8Chunks(text,maxChars=1600,maxBytes=1750){
 const chunks=[];let chunk='',bytes=0,chars=0;
 for(const c of text){const point=c.codePointAt(0),size=point<128?1:point<2048?2:point<65536?3:4;
  if(chars+c.length>maxChars||bytes+size>maxBytes){chunks.push(chunk);chunk='';bytes=0;chars=0;}
  chunk+=c;bytes+=size;chars+=c.length;
 }if(chunk)chunks.push(chunk);return chunks;
}
// Without Tavern the book leaves out pages for things only Tavern can make.
export function guidebookFor(tavern){
 if(tavern)return GUIDEBOOK;
 return {...GUIDEBOOK,entries:GUIDEBOOK.entries.filter(e=>!TAVERN_LINKED.has(e.id))};
}
export function publishGuidebook(){
 requested=true;
 const number=++publication,revision=`${VERSION}-${number}`,chunks=utf8Chunks(JSON.stringify(guidebookFor(isTavernPresent())));
 const header={api:1,source:SOURCE,id:ID,revision};
 system.sendScriptEvent('kaleidoscope_cookery:guidebook_begin',JSON.stringify({...header,chunks:chunks.length}));
 chunks.forEach((chunk,index)=>system.runTimeout(()=>{
  if(publication===number)system.sendScriptEvent('kaleidoscope_cookery:guidebook_chunk',`${SOURCE}\n${ID}\n${revision}\n${index}\n${chunk}`);
 },1+Math.floor(index/4)));
 system.runTimeout(()=>{if(publication===number)system.sendScriptEvent('kaleidoscope_cookery:guidebook_end',JSON.stringify(header));},2+Math.floor(chunks.length/4));
}
// Tavern can come up after Cookery asked for the book; republish with its pages then.
onTavernPresent(()=>{if(requested)publishGuidebook();});
