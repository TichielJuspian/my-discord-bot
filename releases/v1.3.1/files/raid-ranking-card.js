'use strict';
const path=require('node:path'),{Resvg}=require('@resvg/resvg-js');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const num=v=>Math.floor(v).toLocaleString('en-US');
const cache=new Map();
const boostIcon=(x,y)=>`<g transform="translate(${x} ${y})"><circle r="13" fill="#a865ed" opacity=".18"/><path d="M0-11L8-5V5L0 11L-8 5V-5Z" fill="#b873f4" stroke="#e7c5ff" stroke-width="1.5"/><path d="M1-7L-4 1H0L-1 7L5-2H1Z" fill="#fff0ff"/></g>`;
function render(rows,{start=0,total=0,me=null,personal=false,segment=null,bossName='Colossus'}={}){
 const key=JSON.stringify([rows,start,total,me,personal,segment,bossName]);if(cache.has(key))return cache.get(key);
 const h=personal?1284:1150;
 const text=(x,y,t,size=18,color='#e9edf7',anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${h}"><defs><clipPath id="names"><rect x="100" y="170" width="270" height="910"/></clipPath><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#23324b"/><stop offset="1" stop-color="#0b1426"/></linearGradient><linearGradient id="gold"><stop stop-color="#9f7338"/><stop offset=".5" stop-color="#f4d694"/><stop offset="1" stop-color="#9f7338"/></linearGradient></defs><rect width="800" height="${h}" rx="20" fill="#0c1423"/><rect x="10" y="10" width="780" height="${h-20}" rx="16" fill="url(#bg)" stroke="#b59153" stroke-width="2"/><path d="M28 62V28H96M704 28H772V62M28 ${h-62}V${h-28}H96M704 ${h-28}H772V${h-62}" fill="none" stroke="#e5c37f" stroke-width="3"/><g font-family="Raid Font" font-weight="bold">`;
 s+=text(400,49,'GOSU / CO-OP RAID',13,'#c8ad7b','middle');
 s+=text(400,85,'HALL OF CHALLENGERS',28,'#ffe4aa','middle');
 s+=text(400,114,'DAMAGE RANKING',13,'#9dabc2','middle');
 s+=`<path d="M38 132H762" stroke="url(#gold)"/>`;
 s+=text(38,157,'RANK',12,'#b0bed0')+text(106,157,'BOOST / CHALLENGER',12,'#b0bed0')+text(402,157,'LEVEL',12,'#b0bed0','middle')+text(490,157,'CLASS',12,'#b0bed0','middle')+text(605,157,'FINAL ROUND',12,'#b0bed0','middle')+text(762,157,'DAMAGE',12,'#b0bed0','end');
 for(let i=0;i<25;i++){
  const y=172+i*36,r=rows[i],place=r?.rank??start+i+1,c=place===1?'#ffdb80':place===2?'#cbd9ed':place===3?'#d8aa83':'#8295b2';
  s+=`<rect x="29" y="${y}" width="742" height="33" rx="5" fill="${i<3?'#314057':i%2?'#18243a':'#1e2b42'}"/>`;
  s+=text(76,y+23,String(place).padStart(2,'0'),18,c,'middle');
  if(r){
   if((segment===null||Math.floor(i/5)===segment)&&!(r.boostKnown&&r.boosterCount===0))s+=(r.booster?boostIcon(112,y+16):'')+text(126,y+21,r.boostKnown?'x'+r.boosterCount:'?',11,r.boostKnown?'#d9a7ff':'#aebed2').replace('<text ', String(r.boosterCount).length>5?'<text textLength="42" lengthAdjust="spacingAndGlyphs" ':'<text ');
   s+=(segment===null||Math.floor(i/5)===segment?'<g clip-path="url(#names)">'+text(174,y+23,require('./raid-name-fonts').clip(r.name,16),16,r.booster?'#d9a7ff':'#e9edf7')+'</g>':'')+text(402,y+23,r.level,16,'#aebed2','middle')+text(490,y+23,require('./raid-class-name').name(r.job||'Unknown'),16,'#aebed2','middle')+text(605,y+23,(r.finalRound??Math.max(0,(r.turn||1)-1))+(r.finalStrike?' / LAST':r.cleared?' / CLEAR':''),r.finalStrike||r.cleared?12:16,r.finalStrike?'#ffdb80':r.cleared?'#84ddd3':'#aebed2','middle')+text(756,y+23,num(r.damage),19,i<3?'#ffe4aa':'#e9edf7','end');}
  else s+=text(106,y+22,'Awaiting challenger',14,'#536781')+text(756,y+22,'—',17,'#536781','end');
 }
 s+=text(38,1101,`${num(total)} PARTICIPANTS`,13,'#d2b67f')+text(762,1101,`RANK ${start+1}–${start+25}`,13,'#d2b67f','end');
 s+=text(400,1125,'BOOST = current count | ? = unavailable | Damage history unchanged',11,'#879ab5','middle');
 if(personal){s+=`<rect x="29" y="1150" width="742" height="103" rx="10" fill="#172d3b" stroke="#5daaaa"/>`+text(49,1177,'YOUR CONTRIBUTION',14,'#84ddd3');
  if(me&&(segment===null||segment===4)&&!(me.boostKnown&&me.boosterCount===0))s+=(me.booster?boostIcon(57,1204):'')+text(70,1209,me.boostKnown?'x'+me.boosterCount:'?',11,'#d9a7ff').replace('<text ', String(me.boosterCount).length>5?'<text textLength="48" lengthAdjust="spacingAndGlyphs" ':'<text ');
  s+=text(me?126:49,1211,me?`#${me.rank}  ${Array.from(me.name).slice(0,14).join('')}`:'Your story starts here',20,me?.booster?'#d9a7ff':'#fff0cf');
  s+=text(750,1211,me?num(me.damage)+' DMG':'NOT JOINED',22,'#84ddd3','end');
  s+=text(49,1237,me?`Level ${me.level} · ${require('./raid-class-name').name(me.job)}`:'Join the raid to claim your place.',13,'#aabbd0');}
 s+='</g></svg>';
 if(segment!==null){const top=segment===0?0:172+segment*180,bottom=segment===4?h:172+(segment+1)*180;s=s.replace(`width="800" height="${h}"`,`width="800" height="${bottom-top}" viewBox="0 ${top} 800 ${bottom-top}"`);}
 const png=new Resvg(s,require('./raid-name-fonts').options(s)).render().asPng();
 if(cache.size>=15)cache.delete(cache.keys().next().value);cache.set(key,png);return png;
}
module.exports={render};

module.exports.clearCache=()=>cache.clear();
