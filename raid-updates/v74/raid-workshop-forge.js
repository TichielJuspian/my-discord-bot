'use strict';
const fs=require('fs'),path=require('path'),P=require('./raid-engine/slot-progression.cjs');
const art={};
const t=(x,y,v,size=22,color='#e9f2ff')=>`<text x="${x}" y="${y}" font-family="Rajdhani" font-weight="600" font-size="${size}" fill="${color}">${v}</text>`;
function svg(s){
 const failed=s.enhancementResult?.success===false&&s.enhancementResult?.mode!=='gauge';const file=failed?'workshop-blacksmith-failure.png':'workshop-blacksmith.png';art[file]??=fs.readFileSync(path.join(__dirname,file)).toString('base64');
 const r=s.enhancementResult,p=s.pending,slot=p?.value||r?.slot;
 const target=p?s.account.slots[slot]+1:r?.target;
 const known=Number.isSafeInteger(s.pointsBalance)&&s.pointsBalance>=0,balance=known?s.pointsBalance.toLocaleString('en-US')+' P':'UNAVAILABLE';
 const q=slot&&s.account.slots[slot]<P.MAX?P.quote(s.account.slots[slot]+1,s.account.enhancementFailures?.[slot]||0,!!p?.useScroll):null;
 let v=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="900"><defs><clipPath id="portrait"><rect x="0" y="0" width="400" height="640" rx="16"/></clipPath></defs><rect width="1100" height="900" rx="16" fill="#0b1423"/><image href="data:image/png;base64,${art[file]}" width="400" height="640" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait)"/>`;
 v+=t(430,46,'YOUR POINTS',27,'#f4d18d')+t(430,103,balance,balance.length>18?40:52,known?'#ffffff':'#ffaaa7');
 v+='<path d="M452 124H1050Q1072 124 1072 146V284Q1072 306 1050 306H452Q432 306 432 286V234L412 216L432 198V146Q432 124 452 124Z" fill="#203149" stroke="#8c7753"/>';
 if(q){
  v+=t(458,169,'COST PER ATTEMPT: '+q.cost+' P',34,'#fff0cf');
  v+=t(458,211,q.mode==='gauge'?'Each action adds 1 progress.':q.cost?'Points are spent on every attempt.':'This attempt is free.',26,q.cost?'#ffcc9f':'#a6deca');
  const after=!known?'Points unavailable. Try again shortly.':s.pointsBalance<q.cost?'Not enough points for this attempt.':'BALANCE AFTER: '+(s.pointsBalance-q.cost).toLocaleString('en-US')+' P';
  v+=t(458,254,after,27,!known||s.pointsBalance<q.cost?'#ffaaa7':'#b4c8dd');
 }else{
  v+=t(458,169,slot?'MAX ENHANCEMENT REACHED':'SELECT AN EQUIPMENT SLOT',31,'#fff0cf');
  v+=t(458,211,'+1-3 FREE / +4-20: 100 P',27,'#ffcc9f');
  v+=t(458,254,'+21-30: 200 P / +31-40: 300 P',26,'#b4c8dd');
 }
 if(r)v+=t(458,289,'LAST ATTEMPT: '+(r.cost?'-'+r.cost+' P':'FREE (0 P)'),23,'#f4d18d');
 if(slot){
  const current=s.account.slots[slot];
  v+=t(432,350,slot.toUpperCase(),32,'#9eb7cf');
  if(r){
   v+=t(838,350,'ATTEMPT #'+(r.attempt||1),26,'#9eb7cf');
   v+=t(430,438,(r.success?'SUCCESS +':r.mode==='gauge'?'PROGRESS +':'FAILED +')+current,66,r.success?'#91e9b0':'#ffaaa7');
  }else v+=t(430,430,current>=P.MAX?'+40  MAX':'+'+current+'  &#8594;  +'+target,76,'#f4d18d');
  v+=t(432,477,{weapon:'Each upgrade: ATK +2',armor:'Each upgrade: DEF +1',accessory:'Each upgrade: EVASION +0.5%'}[slot],25,'#a6deca');
  v+='<path d="M432 501H1068" stroke="#35495f" stroke-width="2"/>';
  if(current>=P.MAX)v+=t(432,566,'MAX ENHANCEMENT  +40',40,'#f4d18d');
  else{
   v+=t(432,540,q.mode==='gauge'?'ENHANCEMENT PROGRESS':r?'NEXT ENHANCEMENT':'ENHANCEMENT CHANCE',24,'#9eb7cf');
   if(q.mode==='gauge'){const n=s.account.enhancementFailures?.[slot]||0;v+=t(432,589,n+' / '+q.required+'  (next: '+q.progress+')',37)+'<rect x="432" y="601" width="628" height="10" rx="5" fill="#28394e"/><rect x="432" y="601" width="'+(628*Math.min(n/q.required,1))+'" height="10" rx="5" fill="#a788ff"/>';} else {
   if(r)v+=t(432,594,'+'+current+'  &#8594;  +'+(current+1),48,'#f4d18d')+t(790,591,q.chance+'% chance',36);
   else v+=t(432,594,q.chance+'% Success chance',40);}
  }
 }else{
  v+=t(432,366,'Attack +'+s.account.slots.weapon,32,'#f4d18d')+t(432,416,'Armor +'+s.account.slots.armor,32,'#f4d18d')+t(432,466,'Accessory +'+s.account.slots.accessory,32,'#f4d18d');
 }
 if(!slot)v+=t(432,522,'PER UPGRADE: ATK +2 / DEF +1',24,'#a6deca')+t(432,555,'ACCESSORY: EVASION +0.5%',24,'#a6deca');
 v+=t(432,628,q?(q.mode==='gauge'?'NO RANDOM FAILURE / PROGRESS IS SAVED':q.scroll?'NORMAL SCROLL: +10%p / CONSUMED ON ATTEMPT':'BASE '+q.baseChance+'% + PITY '+q.pity+'%p'+(q.guarantee?' / GUARANTEED #'+q.guarantee:'')):'NO DOWNGRADE OR DESTRUCTION ON FAILURE',20,'#c7a2e9');
 v+=footer(slot);
 return v+'</svg>';
}
function footer(slot){let v='';
 const labels={attack:'ATK',hp:'MAX HP',defense:'DEF',crit:'CRIT',critDamagePercent:'CRIT DMG',evasion:'EVASION'};
 v+='<rect x="420" y="646" width="650" height="244" rx="12" fill="#192a40"/>';
 if(slot){v+=t(435,675,slot.toUpperCase()+' MILESTONE BONUSES - ALL STACK',23,'#e4c98b');Object.entries(P.MILESTONES[slot]).forEach(([level,stats],i)=>{const line='+'+level+'  '+Object.entries(stats).map(([k,n])=>labels[k]+' +'+n+(['crit','critDamagePercent','evasion'].includes(k)?'%':'')).join(' / ');v+=t(435,707+i*30,line,23);});}
 else v+=t(435,680,'MILESTONE BONUSES STACK',25,'#e4c98b')+t(435,722,'+19-30: low odds, pity and guaranteed attempts.',22)+t(435,760,'+31-35: 150 progress / +36-40: 300 progress.',22)+t(435,798,'Normal Scroll: +10%p, usable through +20.',22)+t(435,840,'No downgrade or destruction. Progress is saved.',22);
 return v;
}
function footerSVG(s){return '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="900"><rect width="1100" height="900" rx="16" fill="#0b1423"/>'+footer(s.pending?.value||s.enhancementResult?.slot)+'</svg>';}
module.exports={svg,footerSVG};
