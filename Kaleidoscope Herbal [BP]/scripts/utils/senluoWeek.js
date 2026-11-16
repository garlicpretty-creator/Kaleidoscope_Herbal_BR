// v1.2.13: 森羅週曆 (weekly themes). 魔女手札 decides the week's theme and broadcasts it on
// senluo_link:evt {"v":1,"t":"week","theme":"<id>","week":"YYYY-Www","phase":"start"|"end","until":<Unix s>}.
// Herbal reacts to two themes; without the broadcast (no 魔女手札, or an older one) nothing changes.
//  - harvest: crops grow 1.5x and drying baskets dry 1.5x (combined with sky events, crops cap at 2x)
//  - incense: a burner loaded this week burns 9,000 ticks a portion instead of 6,000
export const WEEK_HARVEST=1.5,WEEK_INCENSE_TICKS=9000;
let theme,until=0;
const nowSeconds=()=>Date.now()/1000;
export function onWeek(m){
 if(typeof m.theme!=='string')return false;
 if(m.phase==='start'){
  const end=Number(m.until);if(!Number.isFinite(end))return false;
  theme=m.theme;until=end;return true;
 }
 if(m.phase==='end'){if(m.theme===theme){theme=undefined;until=0;}return true;}
 return false;
}
// The theme now in force (expires on its own at `until`, in case the end message never comes).
export function weekTheme(){
 if(theme!==undefined&&nowSeconds()>=until){theme=undefined;until=0;}
 return theme;
}
export const harvestFactor=()=>weekTheme()==='harvest'?WEEK_HARVEST:1;
export const incenseWeek=()=>weekTheme()==='incense';
export function onSenluoEvent(event){
 if(event.id!=='senluo_link:evt')return;
 try{const m=JSON.parse(event.message);if(m?.v===1&&m.t==='week')onWeek(m);}catch{} // malformed: ignore quietly
}
