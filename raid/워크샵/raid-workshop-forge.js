'use strict';
const fs=require('node:fs'),path=require('node:path');
const P=require('../보스/전투/엔진/slot-progression.cjs'),{fmt,guideSVG,GUIDE_HEIGHT}=require('./raid-workshop-odds-display.js');
const ASSET=path.join(__dirname,'이미지');
const names={normal:'forge-v440-normal.png',failure:'forge-v440-failure.png',bubble:'forge-v440-bronze.png',coin:'forge-v440-coin.png'};
const art=new Map();
function ref(key){if(!art.has(key)){const b=fs.readFileSync(path.join(ASSET,names[key]));const mime=b[0]===0xff&&b[1]===0xd8?'image/jpeg':'image/png';art.set(key,'data:'+mime+';base64,'+b.toString('base64'));}return art.get(key);}
const { escapeSvgText: escape } = require('../svg-escape.cjs');
const nfmt=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
const displaySlot={weapon:'Weapon',armor:'Armor',accessory:'Accessory'};
const increase={weapon:'Each upgrade: ATK +2',armor:'Each upgrade: DEF +1',accessory:'Each upgrade: EVASION +0.5%'};
const effectNames={attack:'ATK',hp:'MAX HP',defense:'DEF',crit:'CRIT',critDamagePercent:'CRIT DMG',evasion:'EVASION'};
const percent=new Set(['crit','critDamagePercent','evasion']);
const tx=(x,y,value,size,color,{weight=600,align='start',stroke,width=1,family='Rajdhani'}={})=>'<text x="'+x+'" y="'+y+'" font-family="'+family+'" font-weight="'+weight+'" font-size="'+size+'" text-anchor="'+align+'" fill="'+color+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'" paint-order="stroke fill" stroke-linejoin="round"':'')+'>'+escape(value)+'</text>';
const icon=(key,x,y,w,h)=>'<image x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" preserveAspectRatio="xMidYMid meet" href="'+ref(key)+'"/>';
const line=(a,b,y,alpha=.52)=>'<path d="M'+a+' '+y+'H'+b+'" stroke="#aa8958" stroke-opacity="'+alpha+'" stroke-width="1"/>';
const gradient=(id,colors)=>'<linearGradient id="'+id+'" x2="0%" y2="100%">'+colors.map(([offset,color])=>'<stop offset="'+offset+'" stop-color="'+color+'"/>').join('')+'</linearGradient>';
const fade='<linearGradient id="forge-fade" gradientUnits="userSpaceOnUse" x1="390" y1="0" x2="435" y2="0">'+Array.from({length:17},(_,i)=>{const p=i/16;return '<stop offset="'+p+'" stop-color="#0e1624" stop-opacity="'+(.85*p*p*(3-2*p)).toFixed(6)+'"/>';}).join('')+'</linearGradient>';
const defs='<defs>'+fade+
 gradient('points',[[0,'#fff'],[.58,'#f4f6ff'],[1,'#c8d0e1']])+
 gradient('attempt',[[0,'#fbfbff'],[.45,'#dce5f5'],[1,'#8997b3']])+
 gradient('mint',[[0,'#d5ffdf'],[.50,'#8ef3b8'],[1,'#3fb477']])+
 gradient('fail',[[0,'#ffd0c6'],[.50,'#ff8b85'],[1,'#e54c57']])+
 gradient('gold',[[0,'#fff1a9'],[.53,'#ffd565'],[1,'#c2893b']])+
 gradient('navy',[[0,'#172237'],[1,'#111b2c']])+'</defs>';
function status(s){const r=s.enhancementResult;return !r?'idle':r.success?'success':r.mode==='gauge'?'progress':'failure';}
function milestoneTable(slot,s){
 let v='<rect x="418.75" y="383.75" width="667.25" height="242.25" rx="12" fill="url(#navy)" stroke="#ad8b57" stroke-width=".5"/>';
 v+=tx(434,409,slot?displaySlot[slot].toUpperCase()+' MILESTONE BONUSES':'CURRENT ENHANCEMENT LEVELS',29,'#ead29b',{stroke:'#172033',width:2});
 v+=line(434,1070,419.5);
 if(slot){Object.entries(P.MILESTONES[slot]).forEach(([level,stats],i)=>{
   const y=443+i*34, parts=Object.entries(stats).map(([key,value])=>effectNames[key]+' +'+fmt(value)+(percent.has(key)?'%':'')).join(' / ');
   v+=tx(434,y,'+'+level,25,'#f4d18d',{weight:700})+tx(508,y,parts,24,'#e9f2ff');
   if(i!==5)v+=line(434,1070,y+10.5);
 });}
 else {
  P.SLOTS.forEach((k,i)=>{const y=444+i*45;v+=tx(434,y,displaySlot[k]+' +'+s.account.slots[k],26,'#f4d18d',{weight:700})+tx(682,y,increase[k],24,'#a6deca');if(i<2)v+=line(434,1070,y+12.5);});
  v+=tx(434,592,'NO DOWNGRADE OR DESTRUCTION ON FAILURE',24,'#c7a2e9');
 }
 return v;
}
function svg(s){
 const r=s.enhancementResult,p=s.pending,k=p?.value||r?.slot,slot=P.SLOTS.includes(k)?k:null;
 const current=slot?s.account.slots[slot]:null,failures=slot?s.account.enhancementFailures?.[slot]||0:0;
 const q=slot&&current<P.MAX?P.quote(current+1,failures,!!p?.useScroll):null;
 const outcome=status(s),known=Number.isSafeInteger(s.pointsBalance)&&s.pointsBalance>=0,balance=known?nfmt(s.pointsBalance):'UNAVAILABLE';
 const ptsSize=Math.min(55,Math.floor(338/(Math.max(1,balance.length)*.58)));
 let v='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="640">'+defs+icon(outcome==='failure'?'failure':'normal',0,0,1100,640)+'<rect x="390" y="0" width="710" height="640" fill="url(#forge-fade)"/>';
 v+=icon('coin',430,11,88,58)+tx(516,54,balance,ptsSize,known?'url(#points)':'#ffaaa7',{weight:700,stroke:'#131a2c',width:2});
 if(r){const a='ATTEMPT #'+nfmt(r.attempt||1);v+=tx(1082,54,a,Math.min(42,Math.floor(295/(a.length*.56))),'url(#attempt)',{weight:700,align:'end',stroke:'#30374a',width:2.6});}
 v+=icon('bubble',407,67,680,159);
 if(r&&slot){
  const fail=outcome==='failure',progress=outcome==='progress',label=(fail?'FAILED +':progress?'PROGRESS +':'SUCCESS +')+current;
  v+=tx(765,154,label,81,fail?'url(#fail)':progress?'#ffaaa7':'url(#mint)',{weight:700,align:'middle',stroke:fail?'#351217':'#173c2a',width:3});
  v+=tx(765,192,increase[slot],32,fail?'#eca29e':'#a6deca',{align:'middle'});
 }else if(slot){
  v+=tx(765,151,displaySlot[slot].toUpperCase(),51,'#fff0cf',{weight:700,align:'middle',stroke:'#382c21',width:2});
  v+=tx(765,192,increase[slot],32,'#a6deca',{align:'middle'});
 }else {
  v+=tx(765,138,'SELECT AN EQUIPMENT SLOT',43,'#fff0cf',{weight:700,align:'middle'});
  v+=tx(765,173,'PER UPGRADE: WEAPON ATK +2 / ARMOR DEF +1',25,'#a6deca',{align:'middle'});
  v+=tx(765,201,'ACCESSORY: EVASION +0.5%',25,'#a6deca',{align:'middle'});
 }
 v+=line(419,1086,242.5,.72);
 if(!slot)v+=tx(430,291,'WEAPON  ·  ARMOR  ·  ACCESSORY',37,'#c9d7e8',{weight:700});
 else if(!q)v+=tx(430,324,'MAX ENHANCEMENT  +'+P.MAX,54,'url(#gold)',{weight:700,stroke:'#4a371d',width:2.8});
 else if(q.mode==='gauge'){
  v+=tx(431,285,'ENHANCEMENT PROGRESS',34,'#9eb7cf',{stroke:'#26364d',width:2.4});
  v+=tx(426,352,failures+' / '+q.required+'  (next: '+q.progress+')',50,'url(#gold)',{weight:700,stroke:'#4a371d',width:2.4});
  v+='<rect x="431" y="362" width="638" height="10" rx="5" fill="#28394e"/><rect x="431" y="362" width="'+638*Math.min(failures/q.required,1)+'" height="10" rx="5" fill="#a788ff"/>';
 }else {
  v+=tx(431,285,r?'NEXT ENHANCEMENT':'ENHANCEMENT CHANCE',34,'#9eb7cf',{stroke:'#26364d',width:2.4});
  const odds='BASE '+fmt(q.baseChance)+'% / PITY +'+fmt(q.pity)+' pp'+(q.scroll?' / SCROLL +'+fmt(q.scroll)+' pp':'');
  v+=tx(1082,285,odds,q.scroll?20:25,'#c7a2e9',{align:'end'});
  const start='+'+current,end='+'+q.target, size=77;
  const xArrow=current<10?510:546.55,xEnd=current<10?560:598;
  v+=tx(426,356,start,size,'url(#gold)',{weight:700,stroke:'#4a371d',width:2.8});
  v+=tx(xArrow,346.29,'→',48,'url(#gold)',{family:'Noto Sans',weight:700,stroke:'#4a371d',width:2});
  v+=tx(xEnd,356,end,size,'url(#gold)',{weight:700,stroke:'#4a371d',width:2.8});
  const chance=fmt(q.chance)+'% Chance';
  v+=tx(1082,356,chance,Math.min(56,Math.floor(306/(chance.length*.50))),'#e9f2ff',{align:'end'});
 }
 return v+milestoneTable(slot,s)+'</svg>';
}
function footerSVG(){return '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="'+(650+GUIDE_HEIGHT+10)+'">'+guideSVG(650)+'</svg>';}
module.exports={svg,footerSVG};
