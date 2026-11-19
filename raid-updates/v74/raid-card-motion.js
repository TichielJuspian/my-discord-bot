'use strict';
// Live cards use PNGs. Sequence/encode remain available for offline previews.
const {inflateSync}=require('node:zlib');
const {effect}=require('./raid-action-effects');
let attacks,poses;
const attackFrames=()=>attacks??=require('./raid-motion-frames.json').map(f=>({rgba:inflateSync(Buffer.from(f.rgba,'base64')),duration:100}));
const poseFrames=()=>poses??=Object.fromEntries(Object.entries(require('./raid-action-frames.json')).map(([k,v])=>[k,inflateSync(Buffer.from(v.rgba,'base64'))]));
function sequence(a){
 const s=a.state,l=s.log.at(-1);if(!l)return [];
 const p=(name,duration)=>({rgba:poseFrames()[name],duration});
 let out=[];
 if(l.action==='attack')out=attackFrames().slice(1).map((f,i)=>({...f,...(i>=3&&i<=7?{fx:effect('slash',i-3)}:{})}));
 else if(l.action==='thrust')out=[p('thrust_prepare',150),...Array.from({length:5},(_,i)=>({...p('thrust_hit',85),fx:effect('thrust',i),offsetX:[0,2,4,2,0][i]}))];
 else if(l.action==='guard')out=[p('guard_prepare',160),p('guard_hold',350),...(['normal','flurry','heavy'].includes(l.phase)?[p('guard_block',250)]:[])];
 else if(l.action==='parry')out=[p('parry_prepare',300),p(l.parryResult==='perfect'?'parry_perfect':l.parryResult==='success'?'parry_success':l.incoming>0?'hit':'parry_prepare',280)];
 if(!out.length)return [];
 if(l.action==='guard'&&['normal','flurry','heavy'].includes(l.phase))out.push(...Array.from({length:5},(_,i)=>({...p('guard_block',80),fx:effect('guard',i),offsetX:i%2?-2:1})));
 if(l.action==='parry'&&['success','perfect'].includes(l.parryResult))out.push(...Array.from({length:5},(_,i)=>({...p(l.parryResult==='perfect'?'parry_perfect':'parry_success',80),fx:effect(l.parryResult==='perfect'?'perfect':'parry',i)})));
 if(l.incoming>0&&l.action!=='guard')out.push(...Array.from({length:3},(_,i)=>({...p('hit',70),fx:effect('hit',i+1),offsetX:i%2?-2:2})));
 if(l.counterDamage>0)out.push(p('thrust_prepare',120),...Array.from({length:5},(_,i)=>({...p('thrust_hit',80),fx:effect('counter',i)})));
 if(l.guardEnergy>0&&s.hp>0){
  const art=require('./raid-ui-art');
  for(const bright of [true,false,true])out.push({...p('guard_hold',180),energyEffect:art.energyEffect(l.guardEnergy,bright)});
 }
 if(s.hp<=0)out.push(p('stagger',220),p('exhausted',600));
 else out.push({rgba:null,duration:600}); // Original resting portrait, held without a loop.
 return out;
}
function compositePortrait(rgba,fx,offsetX=0){
 const out=Buffer.alloc(80*80*4);
 for(let i=0;i<80*80;i++){const x=i%80-offsetX,j=Math.floor(i/80)*80+x,alpha=x>=0&&x<80?rgba[j*4+3]/255:0;for(let k=0;k<3;k++){out[i*4+k]=Math.round((alpha?rgba[j*4+k]:0)*alpha+[0,5,63][k]*(1-alpha));if(fx){const a=fx[i*4+3]/255;out[i*4+k]=Math.round(fx[i*4+k]*a+out[i*4+k]*(1-a));}}out[i*4+3]=255;}
 return out;
}
function encode(base,list){
 const {GIFEncoder,quantize,applyPalette}=require('./raid-gifenc.cjs');
 const portraits=list.map(f=>f.rgba?compositePortrait(f.rgba,f.fx,f.offsetX):null);
 const palette=quantize(Buffer.concat([base,...portraits.filter(Boolean),...list.map(f=>f.energyEffect).filter(Boolean)]),255,{format:'rgb565'});palette.push([0,0,0]);
 const indexed=applyPalette(base,palette.slice(0,255),'rgb565');
 for(let i=0;i<indexed.length;i++)if(base[i*4+3]<128)indexed[i]=255;
 const gif=GIFEncoder();
 list.forEach((f,i)=>{
  const frame=Uint8Array.from(indexed);
  if(portraits[i]){const sprite=applyPalette(portraits[i],palette.slice(0,255),'rgb565');for(let y=0;y<80;y++)frame.set(sprite.subarray(y*80,(y+1)*80),(y+35)*640+30);}
  if(f.energyEffect){const effect=applyPalette(f.energyEffect,palette.slice(0,255),'rgb565');for(let y=0;y<56;y++)for(let x=0;x<242;x++){const k=y*242+x;if(f.energyEffect[k*4+3]>128)frame[(y+78)*640+x+367]=effect[k];}}
  gif.writeFrame(frame,640,base.length/(640*4),{palette:i===0?palette:undefined,delay:f.duration,repeat:-1,dispose:1,transparent:true,transparentIndex:255});
 });gif.finish();return Buffer.from(gif.bytes());
}
// Keep the old sequence helpers for offline previews; live cards are persistent PNGs.
module.exports={asset:require('./raid-static-card').asset,sequence,encode};
