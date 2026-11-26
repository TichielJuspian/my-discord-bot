const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Small, cached vector effects inside the existing portrait. No extra Discord edits.
const {Resvg}=require('@resvg/resvg-js');
const cache=new Map();
function effect(kind,frame){
 const key=kind+':'+frame;if(cache.has(key))return cache.get(key);
 const t=frame/4,opacity=['thrust','parry','perfect','counter'].includes(kind)?1-t*.12:1-t*.7,r=7+22*t;
 const color=kind==='hit'?'#ff655b':kind==='guard'?'#69cfff':kind==='perfect'?'#fff2a0':'#ffda64';
 let shape='';
 if(kind==='slash'||kind==='counter')shape=`<path d="M${10+frame*4} 68 Q${75-frame*3} ${15+frame*5} 66 8 Q${80-frame*2} 48 ${10+frame*4} 68" fill="${color}"/><path d="M18 62Q66 35 65 12" fill="none" stroke="white" stroke-width="2"/>`;
 else if(kind==='thrust')shape='<path d="M12 65L77 27L48 57Z" fill="#268bff" opacity=".8"/><path d="M20 62L78 28L52 51Z" fill="#63e7ff"/><path d="M27 59L78 28" stroke="white" stroke-width="3"/><path d="M66 26L71 14L72 25L80 22L75 31L80 38L70 34L64 43L66 32L58 29Z" fill="#fff0a0"/><path d="M7 57L24 48M15 72L37 60M45 70L57 61" stroke="#9af3ff" stroke-width="2"/>';
 else if(kind==='guard')shape='<path d="M48 12L72 21V43Q70 61 48 72Q26 61 24 43V21Z" fill="none" stroke="#69cfff" stroke-width="3"/>';
 else shape=`<circle cx="52" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="${3-t*2}"/>`;
 if(kind!=='guard')for(let i=0;i<8;i++){const a=i*Math.PI/4,x=52+Math.cos(a)*r,y=32+Math.sin(a)*r;shape+=`<path d="M${x} ${y}l${Math.cos(a)*(8-frame)} ${Math.sin(a)*(8-frame)}" stroke="${color}" stroke-width="2"/>`;}
 // Skill silhouettes stay distinct at the actual 80px portrait size.
 // Keep the upper-left face clear; place impact and blade trails on the right.
 if(kind==='thrust')shape='<path d="M10 67L77 26L57 56Z" fill="#2469dd" opacity=".65"/><path d="M17 66L77 27L52 53Z" fill="#51dfff"/><path d="M25 62L78 27L56 46Z" fill="#ecffff"/><path d="M69 27L73 13L75 25L80 22L77 31L80 38L72 35L65 44L68 33L59 29Z" fill="#fff5ac"/><path d="M6 57L25 47M12 74L38 59M40 73L58 59" stroke="#86edff" stroke-width="2"/>';
 if(kind==='parry'||kind==='perfect'){
  const c=kind==='perfect'?'#ffda5a':'#7cddff';
  shape=`<path d="M51 13Q79 31 56 67" fill="none" stroke="${c}" stroke-width="5"/><path d="M54 17Q73 33 57 61" fill="none" stroke="#efffff" stroke-width="2"/><path d="M62 24L65 13L68 26L79 29L68 33L64 46L61 34L50 30Z" fill="${c}"/><path d="M63 25L65 20L67 28L73 30L66 32L64 38L62 32L56 30Z" fill="white"/><path d="M73 18L77 12M74 42L79 46M49 21L45 17" stroke="${c}" stroke-width="2"/>`;
  if(kind==='perfect')shape+='<path d="M45 11Q80 25 66 66" fill="none" stroke="#fff5b1" stroke-width="1.5"/><path d="M43 58L45 52L47 58L53 60L47 62L45 68L43 62L37 60Z" fill="#fff8cc"/>';
 }
 if(kind==='counter')shape='<path d="M9 69Q78 65 69 9Q63 42 9 69Z" fill="#e96c27"/><path d="M13 66Q72 57 68 14Q61 44 13 66Z" fill="#ffcd50"/><path d="M17 65Q69 48 68 19" fill="none" stroke="#fffce0" stroke-width="2.5"/><path d="M58 43L63 30L65 42L78 39L70 49L78 57L65 54L59 68L58 55L46 58L53 49L46 43Z" fill="#ffec9b"/><path d="M60 44L63 38L64 46L70 46L65 50L65 57L61 52L55 53L58 48L54 45Z" fill="white"/><path d="M15 76L33 67M72 66L78 72M8 56L20 52" stroke="#ffc760" stroke-width="2"/>';
 const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><g opacity="${opacity}">${shape}</g></svg>`).render().pixels;
 cache.set(key,pixels);return pixels;
}
module.exports={effect};
