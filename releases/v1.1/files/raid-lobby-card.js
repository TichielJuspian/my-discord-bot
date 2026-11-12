'use strict';
const {raster}=require('./raid-metal-assets'),cache=new Map();
const registry=require('./raid-boss-registry');
function backdrop(boss){
 const {fog,rune}=registry.requireEnabled(boss).lobbyColors;
 let v='<defs><linearGradient id="edgefade" x2="1" y2="0"><stop stop-color="white" stop-opacity="0"/><stop offset=".16" stop-color="white"/><stop offset=".84" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><linearGradient id="verticalfade" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".28" stop-color="white"/><stop offset=".72" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="mistY"><rect width="1040" height="224" fill="url(#verticalfade)"/></mask><mask id="mistMask"><rect width="1040" height="224" fill="url(#edgefade)"/></mask><radialGradient id="mist"><stop stop-color="'+fog+'" stop-opacity=".68"/><stop offset=".55" stop-color="'+fog+'" stop-opacity=".25"/><stop offset="1" stop-color="'+fog+'" stop-opacity="0"/></radialGradient><linearGradient id="night" x2="1" y2="0"><stop stop-color="#190d1b" stop-opacity=".15"/><stop offset=".2" stop-color="#100b19" stop-opacity=".92"/><stop offset=".5" stop-color="#080c18"/><stop offset=".8" stop-color="#100b19" stop-opacity=".92"/><stop offset="1" stop-color="#190d1b" stop-opacity=".15"/></linearGradient><filter id="haze"><feGaussianBlur stdDeviation="8"/></filter></defs><g mask="url(#mistY)"><g mask="url(#mistMask)"><rect width="1040" height="224" fill="#100b19" opacity=".88"/><ellipse cx="120" cy="127" rx="300" ry="130" fill="url(#mist)"/><ellipse cx="925" cy="100" rx="310" ry="150" fill="url(#mist)"/>';
 v+='<path d="M-40 155C110 48 155 188 320 111S560 127 610 75M590 189C770 79 820 191 1090 43" fill="none" stroke="'+fog+'" stroke-width="30" opacity=".25" filter="url(#haze)"/>';
 for(const cx of [108,932]){
  v+='<g transform="translate('+cx+' 108)" fill="none" stroke="'+rune+'" stroke-width="1.1" opacity=".2"><circle r="94"/><circle r="84"/><circle r="65" stroke-dasharray="3 8"/><path d="M0-78L68 39H-68ZM0 78L-68-39H68Z"/>';
  for(let i=0;i<12;i++)v+='<g transform="rotate('+(i*30)+')"><path d="M-4-88L0-94L4-88M0-80V-73"/></g>';
  v+='</g>';
 }
 return v+'<rect x="190" width="660" height="224" fill="url(#night)" opacity=".82"/></g></g>';
}
function asset({boss='earth',hp=require('./raid-boss-health').maximum(boss)}={}){
 const max=require('./raid-boss-health').maximum(boss),ratio=Math.max(0,Math.min(1,hp/max)),key=JSON.stringify([boss,hp]);if(cache.has(key))return cache.get(key);
 const text=(y,s,size,color)=>'<text x="520" y="'+y+'" font-family="Noto Sans KR" font-size="'+size+'" font-weight="bold" fill="'+color+'" text-anchor="middle">'+s+'</text>';
 const name=registry.requireEnabled(boss).title,fill=874*ratio;
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="224"><defs><linearGradient id="hp" x2="0" y2="1"><stop stop-color="#ff87a5"/><stop offset=".2" stop-color="#ff365d"/><stop offset=".55" stop-color="#e91541"/><stop offset="1" stop-color="#9d0b2e"/></linearGradient><filter id="glow" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="4"/></filter><clipPath id="health"><rect x="83" y="187" width="'+fill+'" height="24" rx="3"/></clipPath></defs>';
 svg+=backdrop(boss);
 svg+=text(62,name,49,'#eaf3ff')+'<path d="M290 86H492M548 86H750" fill="none" stroke="#56677d" stroke-width="1.2" opacity=".65"/>';
 // Keep the value and its unit in one text flow so six-digit HP cannot collide.
 svg+='<text x="520" y="156" font-family="Noto Sans KR" font-size="67" font-weight="bold" fill="#fff0f4" text-anchor="middle">'+hp.toLocaleString('en-US')+' / '+max.toLocaleString('en-US')+'<tspan dx="14" dy="-3" font-size="38" fill="#c8d3e3">HP</tspan></text>';
 if(ratio>0)svg+='<rect x="83" y="187" width="'+fill+'" height="24" rx="3" fill="#f21f55" opacity=".5" filter="url(#glow)"/>';
 svg+='<rect x="80" y="184" width="880" height="30" rx="5" fill="#120c19" stroke="#ad3a59" stroke-width="1.5"/><rect x="83" y="187" width="874" height="24" rx="3" fill="#342034"/>';
 if(ratio>0){svg+='<g clip-path="url(#health)"><rect x="83" y="187" width="874" height="24" fill="url(#hp)"/><path d="M86 190H954" stroke="#ffd5df" stroke-width="2" opacity=".6"/>';for(let i=1;i<20;i++)svg+='<path d="M'+(83+874*i/20)+' 187V211" stroke="#560e2b" stroke-width="1.4" opacity=".42"/>';svg+='</g>';}
 svg+='</svg>';const value={name:'raid-lobby-status.png',attachment:raster(svg),description:name+' / '+hp+' of '+max+' HP'};cache.set(key,value);while(cache.size>8)cache.delete(cache.keys().next().value);return value;
}
module.exports={asset};

module.exports.clearCache=()=>cache.clear();
