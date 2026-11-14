'use strict';
const fs=require('node:fs'),z=require('node:zlib'),{Resvg}=require('@resvg/resvg-js'),M=require('./raid-workshop-model'),skin=require('./raid-metal-ui'),fonts=require('./raid-name-fonts');
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const Boost=require('./raid-workshop-boost');
const labels={power:'Attack',focus:'Crit Chance',ruin:'Crit Damage',weapon:'Weapon',armor:'Armor',accessory:'Accessory'};
const cache={};
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function crc(b){let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,b){const t=Buffer.from(type),h=Buffer.alloc(4),c=Buffer.alloc(4);h.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([h,t,b,c]);}
function png(rgba,w,h){const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=6;const rows=Buffer.alloc((w*4+1)*h);const pixels=Buffer.isBuffer(rgba)?rgba:Buffer.from(rgba);for(let y=0;y<h;y++)pixels.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',z.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}

function portrait(job,equipped){
 if(job==='warrior'){const legendary=require('./raid-legendary-appearance').active(job,equipped);return require('./raid-warrior-ui-art').portrait(legendary)||'data:image/png;base64,'+require('./raid-warrior-art').frame('idle',legendary).png;}
 const legendary=require('./raid-legendary-appearance').portrait(job,equipped);if(legendary)return legendary;
 if(cache[job])return cache[job];
 if(job==='berserker')return cache[job]='data:image/png;base64,'+require('./raid-berserker-art').frame('idle').png;
 if(job==='warrior')return cache[job]='data:image/png;base64,'+fs.readFileSync(require('node:path').join(__dirname,'warrior-idle.png')).toString('base64');
 const frame=require('./'+job+'-live-frames.json').idle,size=frame.cardSize||80;
 const rgba=z.inflateSync(Buffer.from(frame.cardRgba||frame.rgba,'base64'));
 const uri='data:image/png;base64,'+png(rgba,size,size).toString('base64');
 if(job==='paladin')require('./raid-paladin-ui-art').registerNormal(uri,rgba);
 return cache[job]=uri;
}
function icon(k,x,y){
 const p={weapon:'M9 49L43 9L52 5L50 17L19 55Z M9 40L29 57L24 63L4 46Z M11 53L3 63L9 68L18 59',armor:'M32 5L57 15L54 44Q49 58 32 67Q15 58 10 44L7 15Z M32 13V56 M15 22L32 15L49 22',accessory:'M18 27L12 14L22 5H42L52 14L46 27Z M21 29A19 19 0 1 0 43 29L39 36A12 12 0 1 1 25 36Z',power:'M37 3L10 39H28L22 66L55 28H36Z',focus:'M4 33Q32 0 60 33Q32 66 4 33Z M42 33A10 10 0 1 1 22 33A10 10 0 1 1 42 33',ruin:'M32 3L40 23L62 18L48 36L58 58L36 49L20 66L20 43L2 31L24 23Z'};
 return '<g transform="translate('+x+' '+y+')"><path d="'+p[k]+'" fill="url(#wsIcon)" stroke="#ffe4a1" stroke-width="2" stroke-linejoin="round"/><path d="M8 9L12 5M53 57L58 52" stroke="#fff" stroke-width="2"/></g>';
}
function profileArt(a,uri){const svg=skin.profileSVG(a,uri);if(a.state.config.job!=='paladin'||!require('./raid-paladin-ui-art').isPortrait(uri))return svg;return svg.replace('<image href="'+uri+'" x="30" y="26" width="128" height="128"/>',require('./raid-paladin-ui-art').box(30,26,128,128));}
function svg({account:a,level,name='Challenger',boostCount=0,boostUnavailable=false,draft=null,view='home',pending=null}){
 const boost={boostCount,boostUnavailable};
 const shown=draft?{...a,allocation:draft}:a,s=M.battle(shown,level);Boost.stats(s.stats,boost);
 const t=(x,y,v,size=18,color='#eaf0fa',extra='')=>'<text x="'+x+'" y="'+y+'" font-family="Noto Sans,Noto Sans KR" font-size="'+size+'" font-weight="700" fill="'+color+'" '+extra+'>'+esc(v)+'</text>';
 const plate=(x,y,w,h)=>'<path d="M'+(x+12)+' '+y+'H'+(x+w-12)+'L'+(x+w)+' '+(y+12)+'V'+(y+h-12)+'L'+(x+w-12)+' '+(y+h)+'H'+(x+12)+'L'+x+' '+(y+h-12)+'V'+(y+12)+'Z" fill="#101e30" stroke="#8b98a4" stroke-width="2"/>';
 let v='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="660"><defs><linearGradient id="wsIcon" x2="1" y2="1"><stop stop-color="#ecffff"/><stop offset=".45" stop-color="#66bbdb"/><stop offset=".5" stop-color="#327498"/><stop offset="1" stop-color="#dab36b"/></linearGradient></defs><rect width="1000" height="660" rx="14" fill="#0b1423"/>';
 const profile=profileArt({state:s,cardName:fonts.clip(name,18)},portrait(a.job,a.equipped)).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 v+='<g transform="translate(20 8) scale(1.5)">'+profile+'</g>';
 v+='<g transform="translate(0 -40)">';
 const center=(x,y,v,size=20,color='#f4ce84')=>t(x,y,v,size,color).replace('<text ','<text text-anchor="middle" ');
 const titles={home:'LOADOUT',equipment:'Equipment',enhance:'Enhancement',stats:'Attributes',class:'Class'};
 v+='<path d="M20 347H346L326 382H20Z" fill="#203248" stroke="#71818e"/>'+t(36,371,titles[view]||titles.home,19,'#f4ce84')+t(690,371,'UNSPENT POINTS  '+M.remaining(shown,level),18,'#7de2ef');
 if(pending){
 const next=structuredClone(shown);
 if(pending.action==='equip')next.equipped[M.ITEMS[pending.value].slot]=pending.value;
 if(pending.action==='unequip')next.equipped[pending.value]=null;
 if(pending.action==='job'){next.job=pending.value;for(const slot of M.SLOTS)if(M.ITEMS[next.equipped[slot]]?.job&&M.ITEMS[next.equipped[slot]].job!==next.job)next.equipped[slot]=null;}
 if(pending.action==='allocate')next.allocation=pending.value;
 if(pending.action==='reset')next.allocation={power:0,focus:0,ruin:0};
 if(pending.action==='enhance')next.slots[pending.value]++;
 const after=M.battle(next,level),before=M.battle(a,level);
 Boost.pair([before.stats,after.stats],boost);
 const item=M.ITEMS[pending.value];
 if(item)v+=icon(item.slot,32,370);v+=center(500,418,item?item.name:pending.action.toUpperCase(),26);
 const rows=[['ATK',before.stats.attack,after.stats.attack],['HP',before.stats.hp,after.stats.hp],['DEF',before.stats.defense,after.stats.defense],['CRIT',Math.min(100,before.stats.crit),Math.min(100,after.stats.crit)],['CRIT DMG',120+a.allocation.ruin+(before.stats.critDamagePercent||0)+Math.max(0,before.stats.crit-100),120+next.allocation.ruin+(after.stats.critDamagePercent||0)+Math.max(0,after.stats.crit-100)]].filter(r=>r[1]!==r[2]);
 if(!rows.length)v+=center(500,510,'No stat change',24,'#b8cddd');
 for(const [i,[label,from,to]]of rows.entries()){const width=940/rows.length,x=30+i*width;v+=plate(x,440,width-14,138)+center(x+(width-14)/2,470,label,17,'#b8cddd')+center(x+(width-14)/2,515,from+' → '+to,28)+center(x+(width-14)/2,553,to===from?'UNCHANGED':(to>from?'+':'')+(to-from),20,to>from?'#8feaab':to<from?'#ff9090':'#7b8a9d');}
 }else if(view==='stats'){
  for(const [i,k]of ['power','focus','ruin'].entries()){const y=398+i*72;v+=plate(20,y,960,62)+icon(k,33,y-3)+t(116,y+38,labels[k],20)+t(400,y+38,shown.allocation[k]+' PT',23,'#f4ce84')+t(584,y+37,k==='power'?'+1 ATK per point':k==='focus'?'+0.5% per point':'+1% per point',17,'#b8cddd');if(draft)v+=t(851,y+37,'+'+(draft[k]-a.allocation[k]),21,'#7de2ef');}
 }else if(view==='class'){
  for(const [i,j]of M.JOBS.entries()){const x=20+i*326,uri=portrait(j,j===a.job?a.equipped:undefined),art=j==='paladin'&&require('./raid-paladin-ui-art').isPortrait(uri)?require('./raid-paladin-ui-art').box(x+74,400,160,160):'<image href="'+uri+'" x="'+(x+74)+'" y="400" width="160" height="160"/>';v+=plate(x,399,308,232)+art+center(x+154,585,require('./raid-class-name').upper(j),21)+center(x+154,611,j===a.job?'Current class':'Select to change',15,'#b8cddd');}
 }else{
  for(const [i,k]of M.SLOTS.entries()){const x=20+i*326,id=a.equipped[k];v+=plate(x,399,308,213)+'<rect x="'+(x+19)+'" y="419" width="82" height="82" rx="9" fill="#182a41" stroke="#ad8b53"/>'+icon(k,x+26,426)+t(x+122,449,labels[k],20,'#f4ce84')+t(x+122,481,'SLOT +'+a.slots[k],19,'#8bdeec')+t(x+20,540,id?require('./raid-item-catalog').displayName(M.ITEMS[id],{compact:true}):'Empty slot',19,'#edf4ff',id&&require('./raid-item-catalog').displayName(M.ITEMS[id],{compact:true}).length>26?'textLength="268" lengthAdjust="spacingAndGlyphs"':'')+t(x+20,578,view==='enhance'?'Upgrade stays on swap':'Owned: '+Object.keys(a.inventory).filter(id=>M.ITEMS[id]?.slot===k&&a.inventory[id]>0).length+' - Select to manage',15,'#b8cddd');}
 }
 v+=t(26,650,pending?'Review the change below, then confirm or cancel.':draft?'PREVIEW - Save your investment to apply.':'DESIGN PREVIEW - Not applied to raid battles.',16,draft||pending?'#f4ce84':'#b8cddd');
 v+=t(26,674,Boost.label(boost),12,'#d9a3f2');
 return v+'</g></svg>';
}
const renders=require('./raid-workshop-cache').create('profile',4*1024*1024,24);
function render(input,section){const key=JSON.stringify(section==='profile'?[section,input.name,input.level,input.boostCount,input.boostUnavailable,input.account.job,input.account.allocation,input.account.potionStats,input.account.slots,input.account.equipped]:[input,section]);if(renders.has(key))return renders.get(key);const sourceSVG=section==='profile'?profile(input):section==='detail'&&input.view==='class'?require('./raid-workshop-class').svg(input,portrait):section==='detail'&&input.view!=='class'?require('./raid-workshop-detail').svg(input):section?svg(input).replace('width="1000" height="660"',section==='profile'?'width="1000" height="290" viewBox="0 0 1000 290"':'width="1000" height="360" viewBox="0 300 1000 360"'):svg(input);const out=new Resvg(sourceSVG,fonts.options(sourceSVG)).render().asPng();renders.set(key,require('./raid-entry-image-cache').optimizePNG(out));return renders.get(key)||out;}
function profile(input){const state=M.battle(input.account,input.level);Boost.stats(state.stats,input);const inner=profileArt({state,cardName:fonts.clip(input.name||'Challenger',18)},portrait(input.account.job,input.account.equipped)).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="290"><rect width="1000" height="290" rx="14" fill="#0b1423"/><g transform="translate(20 8) scale(1.5)">'+inner+'</g></svg>';}
module.exports={svg,render,icon,portrait,clearCache:()=>renders.clear()};

