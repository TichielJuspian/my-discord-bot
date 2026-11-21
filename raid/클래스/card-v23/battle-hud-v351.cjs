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
const digitCache=new WeakMap();
function digit(g){
 if(!digitCache.has(g)){
  const w=Math.round(g.w*1.2),h=Math.round(g.h*1.3),rgba=scale(g.rgba,g.w,g.h,w,h);
  // One extra pixel at the right gives the numerals weight without touching the next glyph.
  for(let y=0;y<h;y++)for(let x=w-1;x>0;x--){
   const k=(y*w+x)*4+3;rgba[k]=Math.max(rgba[k],rgba[k-4]);
  }
  digitCache.set(g,{rgba,w,h,advance:Math.round(g.advance*1.2),top:Math.round(g.top*1.3)});
 }
 return digitCache.get(g);
}
function paintLevel(level,glyphs,blend,rgb){
 const digits=[...String(level)].map(c=>glyphs['29:'+c]).filter(Boolean).map(digit);
 const len=digits.reduce((n,x)=>n+x.advance,0),right=rgb?1030:973,room=rgb?62:63,y=rgb?52:47;
 const ratio=Math.min(1,room/Math.max(1,len));
 let x=rgb?right-len*ratio:910;
 for(const d of digits){
  const w=Math.max(1,Math.round(d.w*ratio));
  blend(w===d.w?d.rgba:scale(d.rgba,d.w,d.h,w,d.h),w,d.h,Math.round(x),y+d.top,GOLD);
  x+=d.advance*ratio;
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

