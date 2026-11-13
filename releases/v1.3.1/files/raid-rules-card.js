'use strict';
const {raster}=require('./raid-entry-image-cache'),R=require('./raid-engine/progression-combat.cjs'),build=require('./raid-test-build'),guide=require('./raid-skill-guide'),registry=require('./raid-boss-registry');
const cache=new Map(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function asset({job='warrior',boss='earth',hp=require('./raid-boss-health').maximum(boss),neutral=false}={}){
 const key=JSON.stringify([job,boss,neutral]);if(cache.has(key))return cache.get(key);
 const accent=job==='paladin'?'#e8c78f':job==='berserker'?'#f2909b':'#8bd8ed',text=(x,y,s,size=16,color='#d3e0f1',anchor='start')=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-weight="bold" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
 let sprite=null;if(!neutral){const state=R.create(build.config(job,1),1);sprite=/href="(data:image\/png;base64,[^"]+)"/.exec(guide.svg(state,'passives'))?.[1];if(!sprite)throw Error('Class artwork unavailable');}
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="500"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#21334b"/><stop offset="1" stop-color="#0c1626"/></linearGradient><linearGradient id="tile" x2="1" y2="1"><stop stop-color="#21334b"/><stop offset="1" stop-color="#16243a"/></linearGradient></defs><rect x="1" y="1" width="1038" height="498" rx="22" fill="url(#bg)" stroke="#435871"/><path d="M26 78V26H168M872 474H1014V422" fill="none" stroke="'+accent+'" stroke-width="2" opacity=".6"/>';
 svg+=text(38,83,'RAID RULES',32,'#f0f5ff')+text(38,107,registry.requireEnabled(boss).title,11,'#adbed5');
 if(neutral)svg+=text(790,53,'NEXT STEP',12,'#8199b6')+text(790,81,'CHOOSE CLASS',19,accent);else svg+='<rect x="760" y="26" width="244" height="78" rx="12" fill="#101c2e" stroke="#3b4e67"/><image href="'+sprite+'" x="765" y="23" width="84" height="84"/>'+text(856,53,'YOUR CLASS',10,'#8199b6')+text(856,81,require('./raid-class-name').upper(job),17,accent);
 const rules=[['BEST RUN COUNTS','Only improvement over your best','reduces shared boss HP.'],['RETRY REQUIREMENT','Remaining HP must exceed','your personal best.'],['YOUR HP TARGET','Locks on entry. Started battles','can finish after entry closes.'],['ENTRY & RANKING','Entry closes at 0 shared HP.','Equal damage shares a rank.']];
 for(let i=0;i<4;i++){
  const x=24+(i%2)*504,y=128+Math.floor(i/2)*176;
  svg+='<rect x="'+x+'" y="'+y+'" width="488" height="160" rx="13" fill="url(#tile)" stroke="#3a4e68"/><rect x="'+(x+16)+'" y="'+(y+17)+'" width="38" height="38" rx="10" fill="#0d1b2c"/>';
  let icon=i===0?'<path d="M-8-11H8V0Q8 10 0 10Q-8 10-8 0ZM-8-6H-14V0Q-14 5-7 5M8-6H14V0Q14 5 7 5M0 10V17M-7 17H7"/>':i===1?'<path d="M10-5A12 12 0 1 0 8 10M10-13V-5H2"/>':i===2?'<rect x="-10" y="-1" width="20" height="17" rx="3"/><path d="M-6-1V-8A6 6 0 0 1 6-8V-1M0 5V10"/>':'<path d="M-11 16V-15M-11-13Q-2-18 7-12V2Q-2-4-11 2M-6-14V0M1-14V0M-11-6H7"/>';
  svg+='<g transform="translate('+(x+35)+' '+(y+35)+')" fill="none" stroke="'+accent+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icon+'</g>';
  svg+=text(x+68,y+42,rules[i][0],21,'#edf4ff')+text(x+68,y+86,rules[i][1],20,'#b7c9e1')+text(x+68,y+122,rules[i][2],20,'#b7c9e1');
 }
 svg+='</svg>';
 const result={name:'raid-rules.png',attachment:raster(svg),description:'RAID RULES / '+require('./raid-class-name').name(job)+' / Best run, retry threshold, fixed HP target, tied ranks'};cache.set(key,result);while(cache.size>8)cache.delete(cache.keys().next().value);return result;
}
function payload(token,options){const card=asset(options);return {flags:32768,attachments:[],files:[card],allowedMentions:{parse:[]},components:[{type:12,items:[{media:{url:'attachment://'+card.name},description:card.description}]},{type:1,components:[{type:2,style:3,label:'Start Battle',custom_id:'raidtest:rules:'+token+':start'},{type:2,style:2,label:'Class settings',custom_id:'raidtest:rules:'+token+':class'},{type:2,style:2,label:'Cancel',custom_id:'raidtest:rules:'+token+':cancel'}]}]};}
module.exports={asset,payload};

module.exports.clearCache=()=>cache.clear();
