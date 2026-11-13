'use strict';
const fs=require('fs'),path=require('path'),M=require('./raid-workshop-model'),P=require('./raid-engine/slot-progression.cjs');
const names={weapon:'Weapon',armor:'Armor',accessory:'Accessory',power:'Attack',focus:'Crit Chance',ruin:'Crit Damage'};
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const art={};function image(id){id=M.ITEMS[id]?.artId||id;if(!art[id])art[id]='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'item-'+(M.ITEMS[id]?.artId||id)+'.png')).toString('base64');return art[id];}
const t=(x,y,v,size=20,color='#edf4ff',extra='')=>'<text x="'+x+'" y="'+y+'" fill="'+color+'" font-family="Noto Sans" font-size="'+size+'" font-weight="700" '+extra+'>'+esc(v)+'</text>';
const center=(x,y,v,size,color)=>t(x,y,v,size,color,'text-anchor="middle"');
const rarityColors={Epic:'#c17aff',Legendary:'#ffd365',Rare:'#65adff',Unique:'#ff5b70',Exclusive:'#ff5b70',Common:'#edf4ff'};
function rarity(id){return M.ITEMS[id]?.rarity||'Common';}
function itemColor(id){return rarityColors[rarity(id)]||'#edf4ff';}
function potionIcon(size=136){return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 136 136"><defs><linearGradient id="potionLiquid" x2="1" y2="1"><stop stop-color="#e8afff"/><stop offset=".5" stop-color="#a555ed"/><stop offset="1" stop-color="#51209b"/></linearGradient></defs><ellipse cx="68" cy="112" rx="36" ry="9" fill="#af66ff" opacity=".2"/><path d="M55 18H81V43L99 66Q114 91 95 110Q68 127 41 110Q22 91 37 66L55 43Z" fill="#253652" stroke="#eee0ff" stroke-width="3"/><path d="M40 73Q55 63 70 73T99 73Q110 94 92 107Q68 121 44 107Q30 94 40 73" fill="url(#potionLiquid)"/><rect x="52" y="12" width="32" height="15" rx="4" fill="#d6ae58" stroke="#fff0c4" stroke-width="2"/><path d="M47 63L43 78M44 85V92" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".65"/><path d="M68 72L72 85L85 89L72 93L68 106L64 93L51 89L64 85Z" fill="#ffe9ff"/><circle cx="84" cy="58" r="4" fill="#ddbdff"/></svg>';}
function potionResultCard(a,r){const labels={attack:'Attack',hp:'Max HP',critDamagePercent:'Crit Damage',evasion:'Evasion'},percent=['critDamagePercent','evasion'].includes(r.key),suffix=percent?'%':'',offset=r.key==='critDamagePercent'?120:0;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="330"><rect width="1000" height="330" rx="16" fill="#0b1423"/>'+t(28,42,'STAT POTION USED',27,'#e0b6ff')+t(970,42,'REMAINING: '+(a.potions||0),20,'#b6c9dd','text-anchor="end"')+'<path d="M28 62H972" stroke="#34465e"/><g transform="translate(40 82)">'+potionIcon(175)+'</g>'+t(250,123,'PERMANENT '+labels[r.key].toUpperCase(),20,'#b6c9dd')+t(250,182,'+'+r.amount+suffix,57,'#a7f3c4')+'<rect x="580" y="100" width="390" height="105" rx="12" fill="#1a2d43"/>'+t(603,131,'BEFORE',14,'#9bb0c7')+t(947,131,'AFTER',14,'#9bb0c7','text-anchor="end"')+t(603,178,(r.before+offset)+suffix,33,'#b1c6dd')+t(774,178,'→',28,'#7a9cbb')+t(947,178,(r.after+offset)+suffix,33,'#a7f3c4','text-anchor="end"')+t(250,247,'Applied immediately. Click the potion in inventory to use another.',18,'#a9bed5')+t(28,305,'Class changes return used potions and remove their permanent stat gains.',16,'#a9bed5')+'</svg>';}
function slot(x,y,id,level=0,size=136){
 if(id==='normal_enhance_scroll')return '<g transform="translate('+x+' '+y+')"><rect width="'+size+'" height="'+size+'" rx="12" fill="#18223b" stroke="#65adff" stroke-width="3"/><svg width="'+size+'" height="'+size+'" viewBox="0 0 136 136"><path d="M34 22H99V99Q99 114 84 114H29Q41 108 41 96V36Q41 22 34 22Z" fill="#eed49e" stroke="#ae8449" stroke-width="3"/><path d="M34 22Q18 22 23 39H41M59 45H84M59 58H84M59 71H78" fill="none" stroke="#9b794a" stroke-width="4"/><path d="M69 81L73 90L83 92L75 99L76 109L67 104L58 108L60 98L53 91L63 90Z" fill="#398add"/></svg></g>';
 if(id==='stat_potion')return '<g transform="translate('+x+' '+y+')"><rect width="'+size+'" height="'+size+'" rx="12" fill="#18223b" stroke="#b475ef" stroke-width="3"/>'+potionIcon(size)+'</g>';
 const color=itemColor(id),border=id&&rarity(id)!=='Common';
 const rect=(inset,stroke,width,opacity=1)=>'<rect x="'+inset+'" y="'+inset+'" width="'+(size-inset*2)+'" height="'+(size-inset*2)+'" rx="12" fill="none" stroke="'+stroke+'" stroke-width="'+width+'" opacity="'+opacity+'"/>';
 return '<g transform="translate('+x+' '+y+')"><rect width="'+size+'" height="'+size+'" rx="12" fill="url(#slot)"/>'+(border?rect(2,color,12,.08)+rect(2,color,7,.16)+rect(2,color,2.5,.95)+rect(7,color,1,.4):'')+(id?'<image href="'+image(id)+'" x="14" y="14" width="'+(size-28)+'" height="'+(size-28)+'" preserveAspectRatio="xMidYMid meet"/>':center(size/2,size/2+9,'+',35,'#445870'))+'<rect x="'+(size-46)+'" y="8" width="36" height="24" rx="5" fill="#0a1424" stroke="'+(border?color:'#526984')+'"/>'+center(size-28,26,'+'+level,15,color)+'</g>';
}

function svg({account:a,level,boostCount=0,boostUnavailable=false,draft,view,pending,potionResult}){
 if(potionResult)return potionResultCard(a,potionResult);
 const boost={boostCount,boostUnavailable};
 const shown={...a,allocation:draft||a.allocation};
 let v='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440">'+require('./raid-workshop-finish').defs+'<defs><linearGradient id="slot" x2="0.8" y2="1"><stop stop-color="#304766"/><stop offset=".5" stop-color="#152237"/><stop offset="1" stop-color="#080f1b"/></linearGradient><linearGradient id="panel"><stop stop-color="#162338"/><stop offset="1" stop-color="#0c1727"/></linearGradient></defs><rect width="1000" height="440" rx="16" fill="#0b1423"/>';
 const headings={home:'Your Equipment',equipment:'Equipment',enhance:'Slot Enhancement',stats:'Attributes'};
 const title=pending?({equip:'Equip Item',unequip:'Remove Item',enhance:'Enhance Slot',allocate:'Confirm Investment',reset:'Reset Attributes',testkit:'Starter Equipment',job:'Change Class',sell:'Sell Item'}[pending.action]):headings[view]||'Workshop';
 v+=t(28,42,title,27,'#ffe0a2')+t(972,40,view==='stats'?M.remaining(shown,level)+' points available':'WORKSHOP','15','#8ca6be','text-anchor="end"')+'<path d="M28 59H972" stroke="#34465e"/>';
 if(pending?.action==='sell'){const item=M.ITEMS[pending.value];return v+slot(48,92,pending.value,0,166)+t(260,140,item.name,29,itemColor(pending.value))+t(260,184,'Selling is not available yet.',22)+t(260,220,'Your item and points will not be changed.',17,'#90adc6')+t(260,276,'SELLING LOCKED',18,'#c7a2e9')+'</svg>';}
 if(pending){
  const next=structuredClone(a),action=pending.action;
  if(action==='equip')next.equipped[M.ITEMS[pending.value].slot]=pending.value;
  if(action==='unequip')next.equipped[pending.value]=null;
  if(action==='enhance')next.slots[pending.value]++;
  if(action==='allocate')next.allocation=pending.value;
  if(action==='reset')next.allocation={power:0,focus:0,ruin:0};
  if(action==='job'){next.job=pending.value;for(const slot of M.SLOTS)if(M.ITEMS[next.equipped[slot]]?.job&&M.ITEMS[next.equipped[slot]].job!==next.job)next.equipped[slot]=null;}
  const type=action==='equip'?M.ITEMS[pending.value].slot:['unequip','enhance'].includes(action)?pending.value:null;
  const id=action==='equip'?pending.value:type?a.equipped[type]:null;
  if(type){
   v+=slot(48,92,id,a.slots[type],166)+t(48,294,id?M.ITEMS[id].name:names[type]+' Slot',25,itemColor(id))+t(48,324,names[type]+' / '+(action==='enhance'?'SLOT ENHANCEMENT':'EQUIPMENT'),14,'#90adc6');
   if(action==='enhance'){const q=P.quote(next.slots[type],a.enhancementFailures?.[type]||0);v+=t(48,361,'+'+a.slots[type]+'  →  +'+next.slots[type],26,'#77dfef')+t(48,391,q.chance+'% success / '+q.cost+' P',17,'#a5d7bf');}
  }else{
   v+=require('./raid-workshop-finish').icon('build',48,92,166);
   v+=t(48,302,action==='reset'?'Rebuild your stats':'Your next build',22,'#fff0c9')+t(48,336,action==='reset'?M.used(a)+' points refunded':'Review your changes',17,'#90adc6');
  }
  const before=M.battle(a,level),after=M.battle(next,level);require('./raid-workshop-boost').pair([before.stats,after.stats],boost);
  const values=[['Damage Bonus',before.stats.damagePercent||0,after.stats.damagePercent||0,'%'],['Attack',before.stats.attack,after.stats.attack,''],['Max HP',before.stats.hp,after.stats.hp,''],['Defense',before.stats.defense,after.stats.defense,''],['Evasion',before.stats.evasion,after.stats.evasion,'%'],['Crit Chance',before.stats.crit,after.stats.crit,'%'],['Crit Damage',120+a.allocation.ruin+(before.stats.critDamagePercent||0),120+next.allocation.ruin+(after.stats.critDamagePercent||0),'%']].filter(r=>r[1]!==r[2]);
  if(view==='stats'&&['allocate','reset'].includes(action)){
   const F=require('./raid-workshop-finish');
   let large='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="640">'+F.defs+'<rect width="1100" height="640" rx="16" fill="#0b1423"/>'+F.icon('build',28,24,86)+t(134,65,title,36,'#ffe0a2')+t(134,101,action==='reset'?M.used(a)+' points refunded':'Your next build',23,'#a9bed5');
   large+=t(36,157,'STAT',22,'#92abc4')+t(652,157,'CURRENT',22,'#92abc4','text-anchor="end"')+t(873,157,'PREVIEW',22,'#92abc4','text-anchor="end"')+t(1058,157,'CHANGE',22,'#92abc4','text-anchor="end"');
   const rows=[['Attack',before.stats.attack,after.stats.attack,'','power'],['Crit Chance',before.stats.crit,after.stats.crit,'%','focus'],['Crit Damage',120+a.allocation.ruin+(before.stats.critDamagePercent||0),120+next.allocation.ruin+(after.stats.critDamagePercent||0),'%','ruin']];
   for(const [i,[label,from,to,unit,kind]]of rows.entries()){
    const y=177+i*137,color=to===from?'#c8d7e8':to>from?'#98edb3':'#ffa1a4';
    large+='<rect x="24" y="'+y+'" width="1052" height="123" rx="18" fill="url(#wPanel)" stroke="#38516c"/>'+F.icon(kind,40,y+20,82)+t(143,y+73,label,32)+t(652,y+75,from+unit,40,'#a9bed5','text-anchor="end"')+t(705,y+73,'→',34,'#7999b8')+t(873,y+76,to+unit,44,color,'text-anchor="end"')+t(1054,y+74,(to>from?'+':'')+(Math.round((to-from)*100)/100)+unit,30,color,'text-anchor="end"');
   }
   return large+(boost.boostUnavailable?t(36,635,'Boost count unavailable; showing attack without boost.',14,'#ffd08a'):'')+'</svg>';
  }
  v+=t(442,97,'STAT CHANGE',14,'#92abc4')+t(716,97,'CURRENT',13,'#92abc4','text-anchor="end"')+t(890,97,action==='enhance'?'ON SUCCESS':'PREVIEW',13,'#92abc4','text-anchor="end"');
  if(!values.length)v+=t(442,157,action==='testkit'?'3 starter items added to inventory':'No stat change',23);
  for(const [i,[label,from,to,unit]]of values.entries()){const y=118+i*54;v+='<rect x="424" y="'+y+'" width="548" height="49" rx="7" fill="'+(i%2?'#101d2f':'#17263b')+'"/>'+t(442,y+31,label,18)+t(716,y+31,from+unit,23,'#9bb0c7','text-anchor="end"')+t(750,y+31,'→',22,'#657f99')+t(890,y+31,to+unit,23,to>from?'#98edb3':'#ffa1a4','text-anchor="end"')+t(955,y+31,(to>from?'+':'')+(Math.round((to-from)*100)/100)+(unit?'%':''),14,to>from?'#98edb3':'#ffa1a4','text-anchor="end"');}
 }else if(view==='stats'){
  for(const [i,k]of ['power','focus','ruin'].entries()){const y=83+i*91;v+='<rect x="28" y="'+y+'" width="944" height="78" rx="10" fill="url(#wPanel)" stroke="#30445e"/>'+t(51,y+31,names[k],23)+t(51,y+57,k==='power'?'+1 attack per point':k==='focus'?'+0.5% per point':'+1% per point',15,'#8faac3')+t(928,y+44,shown.allocation[k]+' PT',28,'#ffe0a2','text-anchor="end"')+'<rect x="330" y="'+(y+32)+'" width="360" height="12" rx="6" fill="#07101d"/><rect x="330" y="'+(y+32)+'" width="'+Math.max(2,360*shown.allocation[k]/Math.max(1,M.budget(level)))+'" height="12" rx="6" fill="#65cadc"/>';}
 }else if(view==='enhance'){
  for(const [i,k]of M.SLOTS.entries()){
   const y=76+i*106,id=a.equipped[k],q=a.slots[k]<40?P.quote(a.slots[k]+1):null;
   v+='<rect x="28" y="'+y+'" width="944" height="96" rx="12" fill="url(#panel)" stroke="#344860"/>'+slot(40,y+8,id,a.slots[k],80)+t(143,y+35,names[k]+' / '+(id?M.ITEMS[id].name:'Empty Slot'),23,itemColor(id))+t(143,y+68,q?'Next +'+q.target+' / Success '+q.chance+'%':'Maximum enhancement',19,'#a6deca')+t(942,y+57,'+'+a.slots[k],32,'#ffe0a2','text-anchor="end"');
  }
 }else{
  for(const [i,k]of M.SLOTS.entries()){const x=28+i*320,id=a.equipped[k],owned=Object.keys(a.inventory).find(id=>M.ITEMS[id]?.slot===k&&a.inventory[id]>0);
   v+='<rect x="'+x+'" y="82" width="304" height="304" rx="12" fill="url(#panel)" stroke="#344860"/>'+center(x+152,113,names[k],17,'#91b0ca')+slot(x+84,128,id,a.slots[k])+center(x+152,297,id?M.ITEMS[id].name.replace(/^\[[^\]]+\]\s*/,''):'Empty Slot',22,id?itemColor(id):'#8b9caf');
   const item=id&&M.itemStats(id,a.job),bonus=item?[item.damagePercent?'DMG +'+item.damagePercent+'%':'',item.evasion?'EVASION +'+item.evasion+'%':'',item.attack?'ATK +'+item.attack:'',item.hp?'HP +'+item.hp:'',item.defense?'DEF +'+item.defense:'',item.crit?'CRIT +'+item.crit+'%':'',item.critDamagePercent?'CRIT DMG +'+item.critDamagePercent+'%':''].filter(Boolean).join('  /  '):owned?'Item available in inventory':'Find equipment to fill this slot';
   v+=center(x+152,326,bonus,16,'#a6deca')+center(x+152,361,view==='enhance'?'Enhance slot  +'+a.slots[k]+' → +'+Math.min(40,a.slots[k]+1):id?M.ITEMS[id].rarity.toUpperCase()+(M.ITEMS[id].job?' / '+require('./raid-class-name').upper(M.ITEMS[id].job):'')+' / EQUIPPED':'NOT EQUIPPED',13,id?itemColor(id):'#6d849c');}
 }
 const effects=view==='equipment'?require('./raid-item-effect-card').svg(a,pending,410,t):{body:'',y:410};
 if(effects.body){const height=effects.y+30;v=v.replace('height="440"','height="'+height+'"').replace('<rect width="1000" height="440"','<rect width="1000" height="'+height+'"');v+=effects.body+t(28,height-7,'EQUIPMENT DETAILS',12,'#6f8aa5');}
 else v+='<path d="M28 411H972" stroke="#25364c"/>'+t(28,432,'PREVIEW ONLY',12,'#6f8aa5')+t(972,432,'ENHANCEMENTS: FREE / 100 P / 200 P / 300 P',12,'#b9a3d8','text-anchor="end"');
 return v+(boost.boostUnavailable?t(28,405,'Boost count unavailable; showing attack without boost.',14,'#ffd08a'):'')+'</svg>';
}
module.exports={itemColor,rarity,svg,slot};
