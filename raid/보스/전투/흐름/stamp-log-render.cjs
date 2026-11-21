'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{createHash}=require('crypto'),{Resvg}=require('@resvg/resvg-js');
const Shared=require('./battle-log-render.cjs'),Profile=require('../../서큐버스/succubus-presentation.cjs'),Outcomes=require('./log-outcomes.cjs'),paths=require('../../../runtime-paths.cjs');
const dir=path.join(__dirname,'log-assets'),sprites=JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(dir,'sprites.deflate')))),{width:W,height:H,scale:S}=sprites.meta;
for(const group of [sprites.stamps,sprites.glyphs])for(const v of Object.values(group))if(v.rgba)v.rgba=Buffer.from(v.rgba,'base64');
const defense=zlib.inflateSync(fs.readFileSync(path.join(dir,'defense.base.deflate'))),attack=Buffer.from(defense),badge=JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(dir,'attack.base.deflate')))),patch=Buffer.from(badge.data,'base64');
for(let y=0;y<badge.h;y++)patch.copy(attack,((badge.top+y)*W+badge.left)*4,y*badge.w*4,(y+1)*badge.w*4);
const fonts=['raid-latin-bold.otf','NotoSansKR-Bold.otf'].map(f=>paths.file(f)),cache=new Map(),detailsCache=new Map();
const num=n=>Math.max(0,Number(n)||0).toLocaleString('en-US'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function blend(target,source,w,h,left,top){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const tx=left+x,ty=top+y;if(tx<0||tx>=W||ty<0||ty>=H)continue;const i=(y*w+x)*4,a=source[i+3];if(!a)continue;const j=(ty*W+tx)*4;for(let c=0;c<3;c++)target[j+c]=Math.round((source[i+c]*a+target[j+c]*(255-a))/255);target[j+3]=a+Math.round(target[j+3]*(255-a)/255);}}
function width(value,size){return [...String(value)].reduce((n,c)=>n+(sprites.glyphs[size+':'+c]?.advance||size*S*.3),0)/S;}
function text(target,value,size,x,y,align='left'){const str=String(value);if(align==='right')x-=width(str,size);if(align==='center')x-=width(str,size)/2;let px=x*S;for(const c of str){const g=sprites.glyphs[size+':'+c];if(g?.rgba)blend(target,g.rgba,g.w,g.h,Math.round(px+(g.left||0)),Math.round(y*S)+g.top);px+=g?.advance||size*S*.3;}return px/S;}
function stamp(target,key,x,cy){const s=sprites.stamps[key];if(!s)throw Error('Missing log stamp '+key);blend(target,s.rgba,s.w,s.h,Math.round(x*S),Math.round(cy*S-s.h/2));return x+s.w/S;}
function inkBounds(sprite){
 let top=sprite.h,bottom=-1;
 for(let y=0;y<sprite.h;y++)for(let x=0;x<sprite.w;x++){
  const i=(y*sprite.w+x)*4;
  if(sprite.rgba[i+3]>128 && Math.max(...sprite.rgba.subarray(i,i+3))>160){top=Math.min(top,y);bottom=y;break;}
 }
 return bottom<0?{top:0,middle:sprite.h/2}:{top,middle:(top+bottom)/2};
}
const ink=new Map(Object.entries(sprites.stamps).map(([key,s])=>[key,inkBounds(s)]));
function numericCenter(baseline,size){
 const digit=sprites.glyphs[size+':2'];
 return baseline+(digit.top+inkBounds(digit).middle)/S;
}
function centeredStamp(out,key,x,cy){
 const s=sprites.stamps[key];
 blend(out,s.rgba,s.w,s.h,Math.round(x*S),Math.round(cy*S-ink.get(key).middle));
}
function pixels(content){
 if(detailsCache.has(content))return detailsCache.get(content);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 640 225">'+content+'</svg>',renderer=new Resvg(svg,{font:{fontFiles:fonts,defaultFontFamily:'Noto Sans KR',loadSystemFonts:false}}),box=renderer.innerBBox();
 if(!box)return null;
 const sx=W/640,sy=H/225,left=Math.max(0,Math.floor(box.x*sx)-2),top=Math.max(0,Math.floor(box.y*sy)-2),w=Math.min(W-left,Math.ceil((box.x+box.width)*sx)+2-left),h=Math.min(H-top,Math.ceil((box.y+box.height)*sy)+2-top);
 const full=renderer.render().pixels,raw=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)Buffer.from(full.buffer,full.byteOffset+(top+y)*W*4+left*4,w*4).copy(raw,y*w*4);
 for(let i=0;i<raw.length;i+=4){const a=raw[i+3];if(a&&a<255)for(let c=0;c<3;c++)raw[i+c]=Math.min(255,Math.round(raw[i+c]*255/a));}
 const result={raw,w,h,left,top};detailsCache.set(content,result);while(detailsCache.size>32)detailsCache.delete(detailsCache.keys().next().value);return result;
}
function layer(out,image){if(image)blend(out,image.raw,image.w,image.h,image.left,image.top);}
function label(out,value,x,y,size,color,anchor='start'){layer(out,pixels('<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-family="Noto Sans KR" font-size="'+size+'" font-weight="700" fill="'+color+'" stroke="#000" stroke-width="'+2/S+'" paint-order="stroke">'+esc(value)+'</text>'));}

function plan(frame,model){
 const outcome=Outcomes.from(frame,model);
 const key=JSON.stringify([model,outcome,frame.kind,frame.state?.phase,frame.state?.pattern?.kind,
  frame.lastTurn?.pattern?.kind,frame.lastTurn?.event||frame.kind]);
 return {outcome,key};
}
function asset(frame,model,options,planned=plan(frame,model)){
 const {outcome,key}=planned;
 if(cache.has(key))return cache.get(key);
 const hit=model.actors.player.receipt;
 const combo=outcome.boss.stamp==='attack' && hit?.index===2 && hit.count===2 && frame.lastTurn?.pattern?.kind==='N';
 const detail=structuredClone(model);for(const a of Object.values(detail.actors)){a.action={};a.receipt=null;a.extra=null;a.gauge=null;}
 const event=frame.lastTurn?.event||frame.kind,ultimateImpact=['gimmick_release','ultimate_hit'].includes(frame.kind)||event==='gimmick_release',gauge=ultimateImpact?null:model.actors.boss.gauge,casting=!ultimateImpact&&frame.state?.phase==='defense'&&frame.state?.pattern?.kind==='C'&&(['prep','reaction','support'].includes(frame.kind)),warning=!ultimateImpact&&(!!gauge||casting);
 const drawing=Shared.drawing(detail,{...options,effectIcon:Profile.readEffectIcon,effectVisual:Profile.resolveEffectIcon,detailLayout:{player:{prefixVisible:false,x:160,width:470,fontSize:20,baseline:104,centerY:98},boss:{prefixVisible:false,x:160,width:gauge?306:458,fontSize:14,baseline:warning?183:183+4/S,centerY:combo?213:warning?177:181}}});
 const extra=[];for(const [actor,y]of [['player',65],['boss',161.5]])if(outcome[actor].text){const value=outcome[actor].text;extra.push('<text x="160" y="'+y+'" font-family="Noto Sans KR" font-weight="700" font-size="'+(value.length>36?17:21)+'" fill="'+(actor==='player'?'#c9f1ff':'#ffd8de')+'" stroke="#000" stroke-width="'+2/S+'" paint-order="stroke">'+esc(value)+'</text>');}
 const out=Buffer.from(model.turnLabel==='Defense Turn'?defense:attack);layer(out,pixels(drawing.details.player.svg+drawing.details.boss.svg+extra.join('')));
 for(const [actor,baseline]of [['player',65],['boss',161.5]]){const row=outcome[actor];const x=352;
  const damage=combo&&actor==='boss'?hit.total-hit.amount:row.damage;
  let size=24;
  if(damage!=null){const v=num(damage)+' Damage';size=width(v,24)<=618-x?24:20;text(out,v,size,x,baseline+3/S);}
  if(row.receipt){const r=row.receipt,v=(r.amount?'−'+num(r.amount):'0')+' HP',total='Total '+(r.total?'−'+num(r.total):'0')+' HP',right=628,totalSize=width(total,18)<170?18:16,room=right-x-(r.index>1?width(total,totalSize)+16:0);
   size=width(v,24)<=room?24:width(v,20)<=room?20:16;text(out,v,size,x,baseline+3/S);
   if(r.index>1)text(out,total,totalSize,right,numericCenter(baseline,size)-numericCenter(0,totalSize)+3/S,'right');
  }
  if(row.stamp)centeredStamp(out,actor+'-'+(row.emphasis&&row.stamp==='attack'?'attack_large':row.stamp),160,numericCenter(baseline,size));
 }
 if(combo){
  const v=num(hit.amount)+' Damage',base=190,size=width(v,24)<=266?24:20;
  const total='Total '+num(hit.total), totalSize=width(total,24)<180?24:20;
  const amountSize=width(v,size)+width(total,totalSize)+12<=276?size:16;
  const cy=numericCenter(base,amountSize);
  centeredStamp(out,'boss-attack-second',160,cy);text(out,v,amountSize,352,base+2/S);
  text(out,total,totalSize,628,cy-numericCenter(0,totalSize)+2/S,'right');
 }
 const kinds=new Set(model.actors.player.effects.map(e=>e.kind));
 if(kinds.has('buff'))centeredStamp(out,'buffed',16,kinds.size===2?89:98);
 if(kinds.has('debuff'))centeredStamp(out,'debuffed',16,kinds.size===2?111:98);
 label(out,'YOUR ACTION',16,65,17,'#ffe29c');
 if(outcome.enrage>0){const key='enrage'+Math.min(3,outcome.enrage),s=sprites.stamps[key];blend(out,s.rgba,s.w,s.h,Math.round(4*S),Math.round(161.5*S+5-s.baseline));}
 else label(out,'BOSS ACTION',16,161.5,17,'#ffd2df');
 text(out,'TURN '+outcome.turn,20,320,21,'center');const totalLabel='Total Damage '+num(model.totalDamage);text(out,totalLabel,width(totalLabel,16)<=225?16:14,620,21,'right');
 if(warning){
  const edge=236, cy=338, left=Math.round(16*S);
  const face=size=>pixels('<text x="16" y="212" font-family="Noto Sans KR" font-weight="700" font-size="'+size+'" fill="#ff5158" stroke="#000" stroke-width="1.21" paint-order="stroke">WARNING!</text>');
  const sample=face(19), art=face(19*(edge-left)/(sample.w-4));
  blend(out,art.raw,art.w,art.h,edge-art.w+2-3,Math.round(cy-art.h/2));
 }
 if(gauge){
  if(gauge.required!==2)throw Error('Unsupported break gauge denominator');
  label(out,'BREAK GAUGE',610,181,16,'#ffe1a0','end');
  const gaugeKey='gauge'+Math.max(0,Math.min(2,gauge.hits));stamp(out,gaugeKey,160,(366-sprites.stamps[gaugeKey].h/2)/S);
 }
 if(casting){const art=pixels('<text x="160" y="210" font-family="Noto Sans KR" font-weight="700" font-size="24" fill="#d99dff" stroke="#000" stroke-width="1.21" paint-order="stroke">CASTING CURSE</text>');blend(out,art.raw,art.w,art.h,art.left,Math.round(338-art.h/2));}

 const rtext=r=>r?(r.amount?'−'+num(r.amount):'0')+' HP'+(r.index>1?' / Total −'+num(r.total)+' HP':''):'';
 const description=[model.turnLabel,'Turn '+outcome.turn,'Enrage '+outcome.enrage,...['player','boss'].map(a=>{const r=outcome[a];return a+': '+(r.text||r.stamp||'')+(r.damage!=null?' '+num(r.damage)+' Damage':'')+(r.receipt?' '+rtext(r.receipt):'');}),drawing.description,warning?'WARNING!':null,casting?'CASTING CURSE':null].filter(Boolean).join(' / ');
 const result={attachment:out,contentKey:createHash('sha256').update(out).digest('hex').slice(0,20),extension:'png',logRaw:{width:W,height:H,channels:4},description,details:drawing.details};cache.set(key,result);while(cache.size>32)cache.delete(cache.keys().next().value);return result;
}
function rememberEncoded(raw,packed){for(const value of cache.values())if(value.attachment===raw){value.attachment=packed;value.extension='jpg';delete value.logRaw;}}
module.exports={plan,asset,rememberEncoded};





