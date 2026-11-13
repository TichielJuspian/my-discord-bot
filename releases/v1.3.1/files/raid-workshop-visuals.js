'use strict';
const {Resvg}=require('@resvg/resvg-js'),fonts=require('./raid-name-fonts'),M=require('./raid-workshop-model'),D=require('./raid-workshop-detail'),I=require('./raid-workshop-inventory');
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const text=(x,y,v,size=18,color='#dce9fa',extra='')=>'<text x="'+x+'" y="'+y+'" font-family="Noto Sans" font-weight="700" font-size="'+size+'" fill="'+color+'" '+extra+'>'+esc(v)+'</text>';
const start=h=>'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="'+h+'"><defs><linearGradient id="slot" x2="1" y2="1"><stop stop-color="#293f5e"/><stop offset="1" stop-color="#0a1322"/></linearGradient></defs><rect width="1000" height="'+h+'" rx="16" fill="#0b1423"/>';
const gem=(x,y,size,color)=>'<path d="M'+x+' '+(y-size)+'L'+(x+size*.75)+' '+y+'L'+x+' '+(y+size)+'L'+(x-size*.75)+' '+y+'Z" fill="'+color+'" stroke="#dec4ff" stroke-width="1.5"/><path d="M'+x+' '+(y-size)+'V'+(y+size)+'M'+(x-size*.75)+' '+y+'H'+(x+size*.75)+'" stroke="#eedfff" stroke-opacity=".6"/>';
function buffs(s){const B=require('./raid-workshop-boost'),active=B.count(s)>0;return start(158)+'<path d="M29 27L47 21L65 27V42Q62 55 47 62Q32 55 29 42Z" fill="#735b26" stroke="#f0ce77" stroke-width="2"/>'+text(82,49,'ACTIVE BUFFS',23,'#f3d078')+(active?gem(47,107,23,'#9c59db'):'')+text(82,103,B.label(s),18,s.boostUnavailable?'#ffd08a':'#c294ed')+text(82,132,s.boostUnavailable?'Try another Workshop action to refresh.':active?'Current registered boosts applied.':'No active workshop buffs.',16,'#90a9c2')+'</svg>';}
function inventory(s){
 const inv=I.page(s.account,s.inventoryFilter||'all',s.inventoryPage);
 let v=start(442)+text(28,40,'INVENTORY',24,'#f5d593')+text(972,38,'Page '+(inv.index+1)+' / '+inv.pages,15,'#90a9c2','text-anchor="end"');
 for(let i=0;i<8;i++){const x=36+(i%4)*244,y=65+Math.floor(i/4)*176,entry=inv.items[i],id=entry?.[0];v+=D.slot(x,y,id,0,132).replace(/<rect x="86" y="8"[\s\S]*?<\/text>/,'');if(id){const quantity=M.quantity(s.account,id)-(s.account.equipped[entry[1].slot]===id?1:0);v+=text(x+148,y+28,String(i+1).padStart(2,'0'),20,'#f6d293')+text(x+148,y+57,'x'+quantity,16,'#93aeca')+text(x,y+150,entry[1].quality?entry[1].quality.toUpperCase()+' ROLL':entry[1].job?'['+require('./raid-class-name').upper(entry[1].job)+']':'',11,D.itemColor(id))+text(x,y+170,entry[1].name.replace(/^\[[^\]]+\]\s*/,''),16,D.itemColor(id));} }
 return v+'</svg>';
}
const F=require('./raid-workshop-finish');

const cache=require('./raid-workshop-cache').create('inventory',4*1024*1024,24);
function render(kind,s){const visible=kind==='inventory'?{job:s.account.job,inventory:s.account.inventory,potions:s.account.potions,equipped:s.account.equipped,filter:s.inventoryFilter||'all',page:s.inventoryPage||0}:kind==='buffs'?{boostCount:s.boostCount,boostUnavailable:s.boostUnavailable}:s;const key=JSON.stringify([kind,visible]);if(cache.has(key))return cache.get(key);const svg=kind==='forge'?require('./raid-workshop-forge').svg(s):kind==='buffs'?buffs(s):inventory(s),out=new Resvg(svg,fonts.options(svg)).render().asPng();cache.set(key,require('./raid-entry-image-cache').optimizePNG(out));return cache.get(key)||out;}
module.exports={render,inventory,buffs,clearCache:()=>cache.clear()};

