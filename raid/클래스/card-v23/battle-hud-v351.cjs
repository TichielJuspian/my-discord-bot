'use strict';
// The title is baked into every authored background. Paint only the gold value.
const GOLD=[255,220,65];
function scale(src,w,h,dw,dh){
 const b=Buffer.alloc(dw*dh*4);
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const xx=Math.min(w-1,Math.floor((x+.5)*w/dw)),yy=Math.min(h-1,Math.floor((y+.5)*h/dh)),i=(yy*w+xx)*4,j=(y*dw+x)*4;
  b[j]=src[i];b[j+1]=src[i+1];b[j+2]=src[i+2];b[j+3]=src[i+3];
 }return b;
}
const scaledIcons=new Map();
function icon(source){
 if(!scaledIcons.has(source))scaledIcons.set(source,scale(source,31,31,38,38));
 return scaledIcons.get(source);
}
// These baselines follow the baked LEVEL label in each authored template.
// Reuse the pre-rasterized antialiased atlas at 1:1 resolution; no enlargement.
function paintLevel(level,glyphs,blend,rgb){
 const text=String(level),left=rgb?974:901,bottom=rgb?48:44,room=rgb?70:71;
 for(const size of [29,26,24,22,19,12,10]){
  const digits=[...text].map(c=>glyphs[size+':'+c]);
  if(!digits.every(Boolean)||digits.reduce((w,g)=>w+g.advance,0)>room)continue;
  let x=left;
  for(const g of digits){blend(g.rgba,g.w,g.h,x,bottom+g.top,GOLD);x+=g.advance;}
  break;
 }
}
function badgeLayout(rgb){
 return rgb?{x:748,y:289,step:39,large:true,overflowX:1045,overflowY:310}:
  {x:734,y:255,step:42,large:true,overflowX:1045,overflowY:277};
}
const counterBack=Buffer.alloc(28*19*4);
for(let y=0;y<19;y++)for(let x=0;x<28;x++){
 const k=(y*28+x)*4,dx=Math.max(0,4-Math.min(x,27-x)),dy=Math.max(0,4-Math.min(y,18-y));
 counterBack[k]=4;counterBack[k+1]=8;counterBack[k+2]=16;counterBack[k+3]=dx*dx+dy*dy<=16?221:0;
}
const BUFF=[152,255,99],DEBUFF=[225,144,255];
const countColor=group=>group==='debuff'?DEBUFF:BUFF;
module.exports={paintLevel,badgeLayout,icon,counterBack,countColor,BUFF,DEBUFF};

