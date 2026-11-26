const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const {Resvg}=require('@resvg/resvg-js'),fonts=require('../보스/전투/raid-name-fonts.js'),M=require('./raid-workshop-model.js'),D=require('./raid-workshop-detail.js'),I=require('./raid-workshop-inventory.js');
const { escapeSvgAttribute: esc } = require('../svg-escape.cjs');
const text=(x,y,v,size=18,color='#dce9fa',extra='')=>'<text x="'+x+'" y="'+y+'" font-family="Noto Sans" font-weight="700" font-size="'+size+'" fill="'+color+'" '+extra+'>'+esc(v)+'</text>';
const start=h=>'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="'+h+'"><defs><linearGradient id="slot" x2="1" y2="1"><stop stop-color="#293f5e"/><stop offset="1" stop-color="#0a1322"/></linearGradient></defs><rect width="1000" height="'+h+'" rx="16" fill="#0b1423"/>';
let boosterIcon;
function buffs(s){
 const {BOOSTER_ICON_FILE}=require('../보스/전투/흐름/status-panels.cjs');
 boosterIcon??=require('node:fs').readFileSync(runtimePaths.join(runtimePaths.directory('raid15'),'assets',BOOSTER_ICON_FILE)).toString('base64');
 const label=s.boostUnavailable?'Boost count unavailable':require('./raid-workshop-boost.js').label(s);
 return start(70)+'<image x="19" y="8" width="54" height="54" href="data:image/png;base64,'+boosterIcon+'"/>'+text(88,46,label,30,'#e1c4ff')+'</svg>';
}
function inventory(s){
 const inv=I.page(s.account,s.inventoryFilter||'all',s.inventoryPage);
 let v=start(442)+text(28,40,'INVENTORY',24,'#f5d593')+text(972,38,'Page '+(inv.index+1)+' / '+inv.pages,15,'#90a9c2','text-anchor="end"');
 for(let i=0;i<8;i++){const x=36+(i%4)*244,y=65+Math.floor(i/4)*176,entry=inv.items[i],id=entry?.[0];v+=D.slot(x,y,id,0,132).replace(/<rect x="86" y="8"[\s\S]*?<\/text>/,'');if(id){const itemName=require('./raid-item-catalog.js').displayName(entry[1],{compact:true}),quantity=M.quantity(s.account,id)-(s.account.equipped[entry[1].slot]===id?1:0);v+=text(x+148,y+28,String(i+1).padStart(2,'0'),20,'#f6d293')+text(x+148,y+57,'x'+quantity,16,'#93aeca')+text(x,y+148,entry[1].job?'['+require('../클래스/raid-class-name.js').upper(entry[1].job)+']':'',15,D.itemColor(id))+text(x+110,y+170,itemName,20,D.itemColor(id),'text-anchor="middle" '+(itemName.length>19?'textLength="220" lengthAdjust="spacingAndGlyphs"':''));} }
 return v+'</svg>';
}
const F=require('./raid-workshop-finish.js');

const cache=require('./raid-workshop-cache.js').create('inventory',4*1024*1024,24);
function render(kind,s){const visible=kind==='inventory'?{job:s.account.job,inventory:s.account.inventory,potions:s.account.potions,equipped:s.account.equipped,filter:s.inventoryFilter||'all',page:s.inventoryPage||0}:kind==='buffs'?{boostCount:s.boostCount,boostUnavailable:s.boostUnavailable}:s;const key=JSON.stringify([kind,visible]);if(cache.has(key))return cache.get(key);const svg=kind==='forge'?require('./raid-workshop-forge.js').svg(s):kind==='buffs'?buffs(s):inventory(s),out=new Resvg(svg,fonts.options(svg)).render().asPng();cache.set(key,require('../보스/전투/raid-entry-image-cache.js').optimizePNG(out));return cache.get(key)||out;}
module.exports={render,inventory,buffs,clearCache:()=>cache.clear()};

