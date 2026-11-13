'use strict';
const {Resvg}=require('@resvg/resvg-js'),fonts=require('./raid-name-fonts');
const cache=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const t=(x,y,v,size=24,color='#e8effb',anchor='start')=>`<text x="${x}" y="${y}" font-family="Noto Sans" font-weight="700" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(v)}</text>`;
function age(time,now){if(!time)return '';const minutes=Math.max(0,Math.floor((now-time)/60000));return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':Math.floor(minutes/1440)+'d ago';}
function svg(rows,now=Date.now()){
 let v='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="640"><defs><linearGradient id="recentBg" x2="1" y2="1"><stop stop-color="#081321"/><stop offset=".55" stop-color="#14283e"/><stop offset="1" stop-color="#080f1d"/></linearGradient><linearGradient id="recentGold" x2="0" y2="1"><stop stop-color="#fff4be"/><stop offset=".45" stop-color="#ffe397"/><stop offset="1" stop-color="#c18c39"/></linearGradient></defs><rect width="1100" height="640" rx="16" fill="url(#recentBg)"/><path d="M24 7H1076L1093 24V616L1076 633H24L7 616V24Z" fill="none" stroke="#cfa657" stroke-width="2"/>'+t(30,51,'RECENT RECORDS',36,'url(#recentGold)')+t(1068,49,'NEW PERSONAL BESTS',23,'#b6c5db','end')+'<path d="M24 72H1076" stroke="#a3a9ad"/>';
 for(let i=0;i<4;i++){
  const y=84+i*133,row=rows[i];
  v+=`<path d="M24 ${y+125}H1076" stroke="#5e748b" stroke-opacity=".6"/>`;
  if(!row){v+=t(550,y+71,'Awaiting a new record',23,'#60768f','middle');continue;}
  const job=String(row.job||'Warrior').toLowerCase(),color=job==='berserker'?'#b52345':job==='paladin'?'#b8852a':'#248ac3';
  const uri=require('./raid-workshop-card').portrait(['berserker','paladin','warrior'].includes(job)?job:'warrior');
  v+=`<defs><radialGradient id="portraitGlow${i}"><stop stop-color="${color}" stop-opacity=".75"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><clipPath id="recentClip${i}"><rect x="20" y="${y}" width="246" height="125" rx="4"/></clipPath></defs><g clip-path="url(#recentClip${i})"><rect x="20" y="${y}" width="246" height="125" fill="#111d30"/><ellipse cx="143" cy="${y+65}" rx="140" ry="95" fill="url(#portraitGlow${i})"/>`;
  // Portraits are rendered from the same source as Workshop, never fetched per record.
  v+=`<image href="${uri}" x="37" y="${y-8}" width="212" height="212" preserveAspectRatio="xMidYMin meet"/></g>`;
  const status={active:'IN BATTLE',defeated:'EXHAUSTED',retreated:'RETREATED',victory:'CLEAR'}[row.status]||'FINISHED';
  const statusColor=row.status==='victory'?'#75ddbc':row.status==='active'?'#75caff':'#f395a1';
  v+=t(288,y+38,fonts.clip(row.name||'Adventurer',19),32,'#f7f8fc')+t(288,y+69,'Lv.'+row.level+' · '+require('./raid-class-name').name(row.job||'Warrior'),22,'#bac8dc');
  v+=`<rect x="288" y="${y+84}" width="157" height="30" rx="13" fill="${row.status==='victory'?'#19453e':row.status==='active'?'#183b59':'#542c3c'}" stroke="${statusColor}" stroke-opacity=".6"/>`+t(366,y+105,status,17,statusColor,'middle');
  v+=t(461,y+105,'ROUND '+Math.max(0,row.finalRound??row.turn??0)+' · '+age(row.finished||row.joined,now),18,'#becbe0');
  v+=t(1061,y+61,Math.max(0,Math.floor(row.damage||0)).toLocaleString('en-US'),String(row.damage||0).length>7?43:54,'url(#recentGold)','end')+t(1060,y+96,'DAMAGE',20,'#bcc9dc','end');
 }
 return v+'</svg>';
}
function asset(rows,now=Date.now()){
 const selected=rows.slice(0,4),key=JSON.stringify([selected,Math.floor(now/60000)]);let attachment=cache.get(key);
 if(!attachment){attachment=new Resvg(svg(selected,now),fonts.options(selected.map(x=>x.name).join(' '))).render().asPng();cache.set(key,attachment);if(cache.size>4)cache.delete(cache.keys().next().value);}
 return {name:'raid-recent-battles.png',attachment,description:'Latest personal-best updates: '+selected.map(x=>`${x.name}, ${require('./raid-class-name').name(x.job)}, ${x.damage} damage, round ${x.finalRound??0}`).join('; ')};
}
module.exports={asset,svg,age};

