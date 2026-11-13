'use strict';
const R=require('./raid-engine/progression-combat.cjs'),build=require('./raid-test-build'),guide=require('./raid-skill-guide'),{raster}=require('./raid-entry-image-cache');
const cache=new Map(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function asset({level=1,job='warrior',current=null}={}){
 const jobs=require('./raid-characters').JOBS,key=JSON.stringify([level,job,current,jobs]);if(cache.has(key))return cache.get(key);
 const text=(x,y,s,size=26,color='#e7effc',anchor='start')=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-weight="bold" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="600"><defs><radialGradient id="aura"><stop stop-color="#99dcff" stop-opacity=".15"/><stop offset="1" stop-color="#99dcff" stop-opacity="0"/></radialGradient></defs>';
 svg+=text(16,44,'CLASS SELECT',34,'#f4f7ff')+text(1020,44,'LEVEL '+level,30,'#e6ce94','end');
 for(const [index,kind]of jobs.entries()){
  const x=16+index*344,c=kind==='berserker'?'#ff92a0':kind==='paladin'?'#efd18b':'#91dff4',s=R.create(build.config(kind,level),1);
  svg+=text(x+160,101,require('./raid-class-name').upper(kind),31,kind===job?c:'#edf3ff','middle');
  if(kind===job)svg+=`<path d="M${x+20} 118H${x+300}" stroke="${c}" stroke-width="3"/>`;
  svg+=`<circle cx="${x+160}" cy="258" r="145" fill="url(#aura)"/><image href="data:image/png;base64,${guide.sprite(kind,'idle')}" x="${x+28}" y="127" width="264" height="264"/>`;
  for(const [n,label,value]of [[0,'HP',s.stats.hp],[1,'ATK',s.stats.attack],[2,'DEF',s.stats.defense]]){
   const cx=x+50+n*108;svg+=text(cx,425,label,23,'#a9bed8','middle')+text(cx,475,value,43,'#f2f6ff','middle');
  }
  const critDamage=120+(s.config.ruinPercentPerPoint||0)*(s.config.ruin||0)+(s.stats.critDamagePercent||0);
  svg+=`<path d="M${x+10} 498H${x+310}" stroke="#35485f"/>`;
  svg+=text(x+80,534,'CRIT',22,'#a9bed8','middle')+text(x+80,578,s.stats.crit+'%',33,c,'middle');
  svg+=text(x+240,534,'CRIT DMG',22,'#a9bed8','middle')+text(x+240,578,critDamage+'%',33,c,'middle');
 }
 svg+='</svg>';const result={name:'raid-class-select.png',attachment:raster(svg),description:'Class base stats at level '+level+' / HP, attack, defense, critical chance and first-tier critical damage. Combat buffs excluded.'};cache.set(key,result);while(cache.size>8)cache.delete(cache.keys().next().value);return result;
}
module.exports={asset};

module.exports.clearCache=()=>cache.clear();
