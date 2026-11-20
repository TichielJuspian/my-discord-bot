'use strict';
// Battle-only treatment. The original label is baked into supplied art, so a
// small shaded level field replaces just that label, keeping the frame intact.
const GOLD=[255,220,65];
const geometry={
  warrior:{x:866,y:16,w:174,h:43,fill:[5,13,23],label:877,number:1029},
  berserker:{x:866,y:16,w:174,h:43,fill:[25,6,11],label:877,number:1029},
  paladin:{x:790,y:11,w:186,h:44,fill:[32,19,14],label:803,number:963},
};
const labels=[
 [[0,0],[5,0],[5,24],[16,24],[16,29],[0,29]],
 [[0,0],[17,0],[17,5],[5,5],[5,12],[15,12],[15,17],[5,17],[5,24],[17,24],[17,29],[0,29]],
 [[0,0],[6,0],[11,22],[17,0],[23,0],[14,29],[8,29]],
];
function inside(x,y,points){
 let found=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)found=!found;
 }return found;
}
const labelW=108,labelH=31,label=Buffer.alloc(labelW*labelH*4);
for(const [i,g] of [0,1,2,1,0].entries()){
 const offset=[0,20,41,67,88][i];
 for(let y=0;y<29;y++)for(let x=0;x<23;x++){
  let hits=0;for(const dy of [.125,.375,.625,.875])for(const dx of [.125,.375,.625,.875])if(inside(x+dx,y+dy,labels[g]))hits++;
  if(hits)label[((y+1)*labelW+x+offset+1)*4+3]=Math.round(hits*255/16);
 }
}
function plate(g){
 const b=Buffer.alloc(g.w*g.h*4);
 for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){
  const i=(y*g.w+x)*4;
  for(let c=0;c<3;c++)b[i+c]=g.fill[c];
  b[i+3]=Math.round(255*Math.min(1,Math.min(x,g.w-1-x)/7,Math.min(y,g.h-1-y)/5));
 }
 return b;
}
for(const g of Object.values(geometry))g.plate=plate(g);
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
function paintLevel(job,level,glyphs,blend,rgb){
 const g=geometry[rgb?job:"paladin"];if(!g)return;
 blend(g.plate,g.w,g.h,g.x,g.y);
 blend(label,labelW,labelH,g.label,g.y+6,GOLD);
 const digits=[...String(level)].map(c=>glyphs['29:'+c]).filter(Boolean).map(digit);
 const len=digits.reduce((n,x)=>n+x.advance,0),width=g.number-(g.label+labelW+4),ratio=Math.min(1,width/Math.max(1,len));
 let x=g.number-len*ratio;
 for(const d of digits){
  const w=Math.max(1,Math.round(d.w*ratio));
  blend(w===d.w?d.rgba:scale(d.rgba,d.w,d.h,w,d.h),w,d.h,Math.round(x),g.y+36+d.top,GOLD);
  x+=d.advance*ratio;
 }
}
function badgeLayout(rgb){
 return rgb?{x:748,y:287,step:39,large:true,overflowX:1045,overflowY:310}:
  {x:734,y:253,step:42,large:true,overflowX:1045,overflowY:277};
}
module.exports={paintLevel,badgeLayout,icon};

