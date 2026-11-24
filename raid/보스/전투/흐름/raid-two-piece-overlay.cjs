'use strict';
// Presentation-only renderer. Logical coordinates document the approved 580px proofs;
// output uses fixed native panel sizes (800x400; 1055x346). No engine or Discord I/O.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const sharp=require('sharp'),{Resvg}=require('@resvg/resvg-js');
const paths=require('../../../runtime-paths.cjs');
const Profile=require('../../서큐버스/succubus-presentation.cjs');
const ROOT=path.join(__dirname,'two-piece-assets'),LOG=path.join(__dirname,'log-assets');
const MAX_PIXELS=4_000_000, SHAPES={boss:[800,400],card:[1055,346]}, aCache=new Map();
const fontFiles=['raid-latin-bold.otf','NotoSansKR-Bold.otf'].map(k=>paths.file(k));
const FONT={fontFiles,defaultFontFamily:'Noto Sans KR',loadSystemFonts:false};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const FMT=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const count=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?Math.min(Math.floor(v),Number.MAX_SAFE_INTEGER):0;
const num=v=>FMT.format(count(v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const stroke=(x,y,value,{size=18,fill='#FFF',edge='#10121D',sw=2,font='Noto Sans KR',anchor='start',italic=false}={})=>
 '<text x="'+x+'" y="'+y+'" font-family="'+font+'" font-weight="700" '+(italic?'font-style="italic" ':'')+'font-size="'+size+'" text-anchor="'+anchor+'" fill="'+fill+'" stroke="'+edge+'" stroke-width="'+sw+'" stroke-linejoin="round" paint-order="stroke fill">'+esc(value)+'</text>';
const svg=(W,H,w,h,body)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+w+' '+h+'">'+body+'</svg>';
const img=(a,x,y,w=a.w,h=a.h)=>'<image x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" href="'+a.uri+'"/>';
const prependSize=(m,w,h)=>({uri:'data:image/png;base64,'+m.toString('base64'),w,h});
const fl='<defs><radialGradient id="spark"><stop stop-color="#ffc65b" stop-opacity=".72"/><stop offset=".47" stop-color="#e38730" stop-opacity=".29"/><stop offset="1" stop-color="#ad601f" stop-opacity="0"/></radialGradient></defs><ellipse cx="496" cy="197" rx="75" ry="30" fill="url(#spark)"/>';
function remember(key,get) {
 if(aCache.has(key))return aCache.get(key);
 const pending=Promise.resolve().then(get);aCache.set(key,pending);
 pending.catch(()=>{if(aCache.get(key)===pending)aCache.delete(key);});return pending;
}
function alpha(raw,w,h,limit=96,options={}) {
 const {x0=0,x1=w,y0=0,y1=h,bright=null}=options;let l=w,r=-1,t=h,b=-1;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const i=(y*w+x)*4;
  if(raw[i+3]<limit||(bright&&!bright(raw[i],raw[i+1],raw[i+2])))continue;
  l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
 }
 return r<l?null:{l,r,t,b};
}
async function toAsset(b,resize,{crop='none',extract,raw,ink}={}) {
 let a=sharp(b,raw?{raw}:{limitInputPixels:MAX_PIXELS});
 if(extract)a=a.extract(extract);
 if(crop!=='none'){
  const q=await a.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const e=alpha(q.data,q.info.width,q.info.height,crop==='visible'?25:1);
  if(!e)throw Error('Empty overlay artwork');
  a=sharp(q.data,{raw:{width:q.info.width,height:q.info.height,channels:4}}).extract({left:e.l,top:e.t,width:e.r-e.l+1,height:e.b-e.t+1});
 }
 if(resize!=null)a=a.resize(typeof resize==='number'?{width:resize,kernel:'lanczos3'}:resize);
 const buf=await a.png().toBuffer(),s=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=s.info;
 const extent=alpha(s.data,w,h), optical=ink?alpha(s.data,w,h,150,ink):null;
 if(!extent)throw Error('Overlay artwork has no visible area');
 return {...prependSize(buf,w,h),...extent,ink:optical};
}
const rawSpec=(width,height)=>({width,height,channels:4});
let sprites;
const atlas=()=>sprites??=JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(LOG,'sprites.deflate'))));
function stamp(id,w){
 return remember('stamp:'+id+':'+w,()=>{
  const z=atlas().stamps[id];if(!z)throw Error('Unknown presentation sprite: '+id);
  return toAsset(Buffer.from(z.rgba,'base64'),w,{raw:rawSpec(z.w,z.h)});
 });
}
function owner(id,w,ink){
 return remember('owner:'+id+':'+w,()=>toAsset(fs.readFileSync(path.join(ROOT,id+'.png')),w,{crop:'transparent',ink}));
}
const crit=(w)=>owner('critical',w,w===132?{x0:23,x1:129,y0:9,y1:25,bright:(r,g,b)=>r>=220&&g>=165&&b<=220}:{x0:44,x1:153,y0:9,y1:31,bright:(r,g,b)=>r>=220&&g>=165&&b<=220});
const badge=phase=>remember('badge:'+phase,()=>toAsset(fs.readFileSync(path.join(ROOT,(phase==='defense'?'defense':'attack')+'-turn.png')),undefined,{extract:{left:2,top:0,width:303,height:44}}));
const energyGem=()=>remember('energy',()=>{
 const p=path.join(__dirname,'../../../클래스/card-v23/assets/energy-full-glow.rgba');
 return toAsset(fs.readFileSync(p),{width:22,height:22,fit:'inside'},{crop:'visible',raw:rawSpec(36,36)});
});
function classIcon(key){
 if(typeof key!=='string'||key.length>80||!/^[a-z0-9_.]+$/.test(key))return Promise.resolve(null);
 // Repository registry has a finite set of genuine icon IDs; unknown keys never create cache entries.
 const info=Profile.resolveEffectIcon(key);
 if(!info?.art&&!info?.card)return Promise.resolve(null);
 return remember('icon:'+key,()=>info.art?toAsset(info.art,{width:29,height:29,fit:'inside'},{crop:'visible'}):toAsset(info.card,{width:29,height:29,fit:'inside'},{crop:'visible',raw:rawSpec(38,38)}));
}
function glyph(key){
 return remember('glyph:'+key,async()=>{
  const g=atlas().glyphs['20:'+key];
  if(!g)return {advance:8};
  if(!g.rgba||!g.w||!g.h)return {advance:g.advance};
  const png=await sharp(Buffer.from(g.rgba,'base64'),{raw:rawSpec(g.w,g.h)}).png().toBuffer();
  return {...g,rgba:undefined,...prependSize(png,g.w,g.h)};
 });
}
async function turnLabel(turn){
 const letters=await Promise.all([...('TURN '+num(turn))].map(glyph));let px=0,left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const a of letters){
  if(a.uri){left=Math.min(left,px+(a.left||0));right=Math.max(right,px+(a.left||0)+a.w);top=Math.min(top,a.top);bottom=Math.max(bottom,a.top+a.h);}
  px+=a.advance||8;
 }
 if(!Number.isFinite(left)||right<=left)return stroke(290,281,'TURN '+num(turn),{size:18,anchor:'middle'});
 const scale=Math.min(.65,145/(right-left),20/(bottom-top));
 const start=290-(left+right)*scale/2, y=275-(top+bottom)*scale/2;
 px=0;let out='';
 for(const a of letters){if(a.uri)out+=img(a,start+(px+(a.left||0))*scale,y+a.top*scale,a.w*scale,a.h*scale);px+=a.advance||8;}
 return out;
}
function criticalNumbers(x,y,value,{size=32,anchor='end'}={}) {
 const base={size,anchor,font:'Raid Latin, Noto Sans KR',italic:true,fill:'#FFF3C8'};
 return stroke(x,y,value,{...base,edge:'#0C0911',sw:3.4})+stroke(x,y,value,{...base,edge:'#ECAA42',sw:1.1});
}
function regularNumbers(x,y,value,{size=25,anchor='end',incoming=false}={}) {
 const base={size,anchor,font:'Raid Latin, Noto Sans KR',italic:true,fill:incoming?'#FFF1F0':'#E6F7FF'};
 return stroke(x,y,value,{...base,edge:incoming?'#511323':'#102943',sw:3})+
        stroke(x,y,value,{...base,edge:incoming?'#BD415B':'#4B8AD0',sw:1});
}
// Measure actual painted digits at logical resolution. Keep the visible edge (not font advance)
// fixed with thousands separators. Use the same transparent svg for measuring and composition.
const numberCache=new Map(),minusCache=new Map();
const numberInk={bright:(r,g,b)=>r>=190&&g>=155&&b>=105};
function measureNumber(value,{size,kind='normal'}){
 const key=kind+':'+size+':'+value;
 if(numberCache.has(key))return numberCache.get(key);
 const paint=kind==='critical'?criticalNumbers:regularNumbers, opts={size,anchor:'start',incoming:kind==='incoming'};
 const markup=paint(8,43,value,opts);
 const raster=new Resvg(svg(450,62,450,62,markup),{font:FONT}).render().pixels;
 const extent=alpha(raster,450,62,128,numberInk);
 if(!extent)throw Error('Failed shaping battle readout digits');
 // The comma descends below the numerals and must never move the line.
 const minusKey=kind+':'+size;
 if(!minusCache.has(minusKey)){
  const line=new Resvg(svg(64,62,64,62,paint(8,43,'−',opts)),{font:FONT}).render().pixels;
  const minus=alpha(line,64,62,128,numberInk);
  if(!minus)throw Error('Failed shaping minus sign');
  minusCache.set(minusKey,(minus.t+minus.b)/2);
 }
 const result={...extent,minus:minusCache.get(minusKey)};
 numberCache.set(key,result);while(numberCache.size>96)numberCache.delete(numberCache.keys().next().value);
 return result;
}
const move=(x,y,b)=>'<g transform="translate('+x+' '+y+')">'+b+'</g>';
// Discord mobile's ALT pill overlaps the bottom-left of the card. Keep the
// main stamped word, and even the outer critical art, above the reserved area.
const DAMAGE_MID=Object.freeze({boss:197.5,card:122.5});
const CARD_REACTION_TOP=107, CARD_DEBUFF_TOP=77;
function damage(v,{incoming=false,critical=false,end=554}={}) {
 const text='−'+num(v),kind=critical?'critical':incoming?'incoming':'normal',paint=critical?criticalNumbers:regularNumbers;
 const length=text.length;
 const size=length>12?(critical?21:19):length>8?(critical?27:22):critical&&!incoming?34:incoming?27:24;
 const box=measureNumber(text,{size,kind});
 const mid=incoming?DAMAGE_MID.card:DAMAGE_MID.boss;
 const dx=incoming?end-box.l:end-box.r,dy=mid-box.minus;
 return {markup:move(dx,dy,paint(8,43,text,{size,anchor:'start',incoming})),left:dx+box.l,right:dx+box.r,minusY:dy+box.minus,top:dy+box.t};
}
async function railArt(i) { return remember("gauge-rail:"+i,async()=>{
 const a=atlas().stamps["gauge"+i],raw=Buffer.from(a.rgba,"base64"),copy=Buffer.from(raw);
 for(let y=28;y<48;y++)for(let x=346;x<=397;x++){const k=(y*a.w+x)*4,j=(y*a.w+(x<371?344:399))*4;copy.copy(raw,k,j,j+4);}
 const wide=await sharp(raw,{raw:rawSpec(a.w,a.h)}).resize({width:403,kernel:"lanczos3"}).png().toBuffer();
 const {height}=await sharp(wide).metadata();
 let x=0;const parts=[];
 for(const [left,width] of [[0,85],[142,120],[318,85]]){
  const patch=await sharp(wide).extract({left,top:0,width,height}).png().toBuffer();
  parts.push({input:patch,left:x,top:0});x+=width;
 }
 const png=await sharp({create:{width:x,height,channels:4,background:"#00000000"}}).composite(parts).png().toBuffer();
 return prependSize(png,x,height);
});}
async function foil(v){
 const hits=count(v?.hits), required=count(v?.required);
 if(!required)return '';
 const pct=Math.max(0,Math.min(1,hits/required)),w=280*pct;
 const label=stroke(16,224,'BREAK',{size:16,fill:'#FFE8A1',edge:'#291A0C',sw:2.15,font:'Raid Latin, Noto Sans KR'});
 if(required===2)return label+img(await railArt(Math.min(hits,2)),13,220);
 return label
 +'<defs><linearGradient id="rail" x2="0" y2="1"><stop stop-color="#FFF4A5"/><stop offset=".37" stop-color="#FFC728"/><stop offset="1" stop-color="#B65D11"/></linearGradient></defs>'
 +'<path d="M19 230H297L303 238 297 246H19L13 238Z" fill="#1E100D" stroke="#DD9A34" stroke-width="1.5"/>'
 +(w?'<rect x="18" y="233" width="'+w+'" height="10" rx="3" fill="url(#rail)"/>':'')
 +'<path d="M22 232H294" stroke="#FCDA7C" stroke-opacity=".69"/>';
}
const OUT_RX=Object.freeze({miss:'player-miss',block:'player-block'}), IN_RX=Object.freeze({miss:'boss-miss',block:'boss-block',parry:'boss-block',perfect_parry:'boss-block'});
const keyOf=v=>typeof v==='string'?v:v?.iconKey||v?.effectId;
async function effectArt(effects,{end,first,top,isBuff,max,tileSize=34,badgeWidth,centerBadge=false}) {
 if(!Array.isArray(effects)||!effects.length)return '';
 const list=[];const seen=new Set();
 for(const effect of effects){
  const key=keyOf(effect);
  if(!key||seen.has(key))continue;seen.add(key);
  const art=await classIcon(key);
  if(art)list.push({art});
  else if(typeof effect?.name==='string'&&['boss','player'].includes(effect.target)){
   // Unknown new effect uses explicit name, never a fabricated icon/emoji binding.
   const name=effect.name.replace(/[^\p{L}\p{N} -]/gu,'').slice(0,23);
   if(name)list.push({named:name});
  }
  if(list.length>=max)break;
 }
 if(!list.length)return '';
 const badge=await stamp(isBuff?'buffed':'debuffed',badgeWidth??(isBuff?84:116));
 const tile=tileSize,gap=6;
 const sizes=list.map(({named})=>named?Math.min(104,Math.max(37,named.length*6+10)):tile);
 let x=first===undefined?end-sizes.reduce((n,m)=>n+m,0)-(sizes.length-1)*gap+1:first+(badge.r-badge.l)+1+gap;
 const tag=first===undefined?x-gap-badge.r:first-badge.l;
 let res=img(badge,tag,top+(centerBadge?(tile-(badge.b-badge.t+1))/2-badge.t:isBuff?-1:0));
 for(const [i,item]of list.entries()){
  const width=sizes[i],{art,named}=item;
  res+='<rect x="'+(x+.75)+'" y="'+(top+.75)+'" width="'+(width-1.5)+'" height="'+(tile-1.5)+'" rx="7" fill="#080C18" fill-opacity=".64" stroke="'+(isBuff?'#78BA81':'#AB87D1')+'" stroke-width="1.3"/>';
  if(art){const ratio=Math.min(1,(tile-4)/Math.max(art.w,art.h)),iw=art.w*ratio,ih=art.h*ratio;res+=img(art,x+(width-iw)/2,top+(tile-ih)/2,iw,ih);}
  else res+=stroke(x+width/2,top+(tile+8)/2,named,{size:10,anchor:'middle',edge:'#121924',fill:isBuff?'#D8FFE2':'#F5D8FF',sw:1});
  x+=width+gap;
 }
 return res;
}
async function gainArt(gain,{side='boss'}={}) {
 if(!count(gain))return '';
 const v='+'+num(gain), boss=side==='boss',size=23;
 const e=await energyGem(),w=Math.max(27,13*v.length);
 return img(e,boss?554-w-8-e.w:12,boss?151:18)+stroke(boss?554:37,boss?172:37,v,{size,anchor:boss?'end':'start',fill:'#DEF9FF',edge:'#0B2036'});
}
const contractFont='Raid Latin, Noto Sans KR', contractInk=new Map();
function contractStyle(size,fill,italic=false){return {size,fill,italic,sw:1,edge:'#120E16',font:contractFont};}
function visibleTextWidth(value,size,italic=false){
 const key=size+'|'+italic+'|'+value;if(contractInk.has(key))return contractInk.get(key);
 const W=960,H=46,margin=6,art=stroke(margin,31,value,contractStyle(size,'#F2E9F8',italic));
 const r=new Resvg(svg(W,H,W,H,art),{font:FONT}).render().pixels,b=alpha(r,W,H,96);
 const w=b?b.r-margin+1:0;contractInk.set(key,w);while(contractInk.size>192)contractInk.delete(contractInk.keys().next().value);return w;
}
function dialogueRows(words,limit,size,italic){
 const rows=[];let row='';for(const w of words.split(/ +/)){const fit=row?row+' '+w:w;if(row&&visibleTextWidth(fit,size,italic)>limit){rows.push(row);row=w;}else row=fit;}if(row)rows.push(row);return rows;
}
function contractFooter(c){
 const left=15, right=565, nameSize=21, bodySize=17.3, effectSize=15, speaker=c.speaker+':';
 const anchor=left+visibleTextWidth(speaker,nameSize)+9, width=right-anchor;
 const offer=c.refusals===undefined&&!c.effects.length;
 let fitted=bodySize, lines=dialogueRows(c.line,width,fitted,true);
 for(const size of [16.8,16.4,16,15.6,15.2,14.8]){if(lines.length<=2)break;fitted=size;lines=dialogueRows(c.line,width,fitted,true);}
 const rows=lines.map(value=>({text:value,size:fitted,step:21,italic:true}));
 const refusal=c.refusals!==undefined?'Refusal: '+c.refusals+'/3':null;
 const refusalEdge=refusal?right-visibleTextWidth(refusal,effectSize)-18:right;
 const effectRows=[];let row=[],x=anchor;
 for(const [i,e] of c.effects.entries()){
  const edge=i===c.effects.length-1?refusalEdge:right;
  const display=e.text.startsWith('Damage taken ')&&e.text.endsWith(' from next turn')&&visibleTextWidth(e.text,effectSize)>edge-anchor?e.text.replace('Damage taken ','DMG taken '):e.text;
  for(const l of dialogueRows(display,edge-anchor,effectSize,false)){
   const w=visibleTextWidth(l,effectSize);if(row.length&&x+w>edge){effectRows.push(row);row=[];x=anchor;}
   row.push({x,text:l,fill:e.kind==='benefit'?'#A6FFD2':'#EBC1FC'});x+=w+17;
  }
 }if(row.length)effectRows.push(row);
 if(refusal&&!effectRows.length&&anchor+visibleTextWidth(rows.at(-1)?.text||'',fitted,true)>refusalEdge){
  const last=rows.pop();rows.push(...dialogueRows(last.text,refusalEdge-anchor,fitted,true).map(value=>({...last,text:value})));
 }
 const height=7+rows.length*21+effectRows.length*19,top=(offer?282:290)-height;
 let y=top+21;const label=stroke(left,y,speaker,contractStyle(nameSize,'#F4CC8B'));
 const copy=rows.map(r=>{const line=stroke(anchor,y,r.text,contractStyle(r.size,'#F2E9F8',r.italic));y+=r.step;return line;}).join('');
 let effect='';for(const e of effectRows){effect+=e.map(x=>stroke(x.x,y,x.text,contractStyle(effectSize,x.fill))).join('');y+=19;}
 const badge=refusal?stroke(right,y-(effectRows.length?19:21),refusal,{...contractStyle(effectSize,'#FFC3DA'),anchor:'end'}):'';
 return '<rect y="'+top+'" width="580" height="'+height+'" fill="#000" fill-opacity="'+(offer?'.64':'.78')+'"/><path d="M0 '+(top+.5)+'H580" stroke="#8A698E" stroke-opacity=".6"/>'+label+copy+effect+badge;
}
async function castingCurse(){
 const art=await remember('owner:casting-curse:preserve-anchor',()=>toAsset(fs.readFileSync(path.join(ROOT,'casting-curse.png')),{width:176,height:30,fit:'inside'},{crop:'visible'}));
 return img(art,554-art.r,201-art.b);
}
async function bossMarkup(o) {
 if(o.contract)return contractFooter(o.contract);
 const b=await badge(o.phase),turn=await turnLabel(o.turn);
 // Keep the cropped native artwork until final projection. No intermediate downscale.
 const width=179,height=width*b.h/b.w;
 const phase=img(b,0,290-height,width,height);
 const totalGradient='<defs><linearGradient id="total-ink" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#FAFCFF"/><stop offset="1" stop-color="#CDD9EC"/></linearGradient></defs>';
 const total=totalGradient+stroke(570,281,'TOTAL DMG '+num(o.totalDamage),{size:14,anchor:'end',sw:1.3,edge:'#071324',fill:'url(#total-ink)'});
 const footer='<rect y="260" width="580" height="30" fill="#090E1B" fill-opacity=".95"/><path d="M0 260.5H580" stroke="#B58C66" stroke-width=".8"/>'+phase+turn+total;
 let body=await foil(o.break);
 const curse=o.curse||{},otherOutcome=curse.released||curse.interrupted||o.mechanicInterrupted===true||o.casting||curse.casting;
 const out=otherOutcome?{}:o.outgoing||{},amt=count(out.damage);
 if(amt){
  const gold=out.critical===true&&out.outcome!=='block';
  const d=damage(amt,{critical:gold});
  const tag=gold?await crit(165):await stamp(out.outcome==='block'?'player-block':'player-hit',91);
  if(gold)body+=fl;
  // Interior word-only ink, verified on approved 165×45 art. Keep the prior integer
  // origin if rounding ties (0.5px) rather than adding an unneeded second shift.
  const word=tag.ink,wordMid=word?(word.t+word.b)/2:20;
  body+=img(tag,d.left-11-tag.r,gold?Math.floor(d.minusY-wordMid):181)+d.markup;
 }else if(Object.hasOwn(OUT_RX,out.outcome)){
  const tag=await stamp(OUT_RX[out.outcome],105);
  body+=img(tag,554-tag.r,177);
 }
 if(curse.released){
  const tag=await owner('curse',112);
  body+=img(tag,554-tag.r,Math.round(198-tag.h/2));
 }
 else if(o.casting||curse.casting)body+=await castingCurse();
 if(count(o.gain)&&!count(o.heal))body+=await gainArt(o.gain);
 if(o.bossDebuffs?.length)body+=await effectArt(o.bossDebuffs,{end:554,top:219,isBuff:false,max:2});
 else body+=await effectArt(o.buffs,{end:554,top:219,isBuff:true,max:3});
 return body+footer;
}
async function cardMarkup(o) {
 if(o.cinematic||o.contract)return '';
 let body='';
 const heal=count(o.heal);
 if(heal) {
  body+=stroke(15,68,'HP +'+num(heal),{size:23,fill:'#A6FFDA',edge:'#06271D',sw:2.6});
  if(count(o.gain))body+=await gainArt(o.gain,{side:'card'});
 }
 const inc=o.incoming||{},amt=count(inc.damage),failure=inc.mechanicFailed===true&&amt>0;
 if(o.curse?.landed){
  const tag=await owner('cursed',119),charm=await classIcon('succubus.charm');
  body+=img(tag,10,Math.round(120.5-tag.h/2));
  if(charm)body+='<rect x="132.5" y="104.5" width="30" height="30" rx="6" fill="#080c18" fill-opacity=".64" stroke="#AB87D1" stroke-width="1.25"/>'+img(charm,132+(31-charm.w)/2,104+(31-charm.h)/2);
 }else{
  if(amt){
   const tag=failure?await crit(132):await stamp(Object.hasOwn(IN_RX,inc.outcome)?IN_RX[inc.outcome]:'boss-hit',103);
   const d=damage(amt,{incoming:true,critical:failure,end:11+(tag.r-tag.l)+(failure?12:15)});
   const top=failure?Math.round(d.minusY-((tag.ink?.t??9)+(tag.ink?.b??24))/2):CARD_REACTION_TOP;
   body+=img(tag,11-tag.l,top)+d.markup;
  }else if(Object.hasOwn(IN_RX,inc.outcome)){
   const tag=await stamp(IN_RX[inc.outcome],103);
   body+=img(tag,11-tag.l,CARD_REACTION_TOP);
  }
  body+=await effectArt(o.debuffs,{first:11,top:CARD_DEBUFF_TOP,isBuff:false,max:2,tileSize:29,badgeWidth:92,centerBadge:true});
 }
 return body;
}
function source(f){
 if(!f||!Buffer.isBuffer(f.attachment))throw Error('Missing two-piece input');
 const desc=f.bossRaw||f.cardRaw;
 if(!desc)return sharp(f.attachment,{limitInputPixels:MAX_PIXELS});
 const {width,height,channels}=desc;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX_PIXELS||channels!==4||f.attachment.length!==width*height*4)throw Error('Invalid raw two-piece input');
 return sharp(f.attachment,{raw:{width,height,channels},limitInputPixels:MAX_PIXELS});
}
// Scope is the render worker process. Cache only finished immutable output artifacts,
// never caller metadata, sessions, IDs, in-flight promises or unbounded source material.
const composed={
 boss:{maxEntries:44,maxBytes:6*1024*1024,bytes:0,items:new Map()},
 card:{maxEntries:32,maxBytes:4*1024*1024,bytes:0,items:new Map()},
};
function reuseComposed(bucket,key){
 const hit=bucket.items.get(key);
 if(!hit)return null;
 bucket.items.delete(key);bucket.items.set(key,hit);
 return hit;
}
function keepComposed(bucket,key,output){
 if(output.attachment.length>bucket.maxBytes)return;
 const old=bucket.items.get(key);
 if(old){bucket.bytes-=old.attachment.length;bucket.items.delete(key);}
 bucket.items.set(key,output);bucket.bytes+=output.attachment.length;
 while(bucket.items.size>bucket.maxEntries||bucket.bytes>bucket.maxBytes){
  const k=bucket.items.keys().next().value,entry=bucket.items.get(k);
  bucket.items.delete(k);bucket.bytes-=entry.attachment.length;
 }
}
function composeKey(f,markup){
 if(!Buffer.isBuffer(f?.attachment))throw Error('Missing two-piece input');
 const desc=f.bossRaw||f.cardRaw;
 // Fixed schema followed by fixed-size digest, then exact render markup. This includes the
 // emblem/owner sprite bytes embedded in the SVG and avoids mutable-buffer assumptions.
 const decodedAs=desc?JSON.stringify([desc.width,desc.height,desc.channels]):'encoded';
 return crypto.createHash('sha256').update(decodedAs+'\0').update(sha(f.attachment)).update(markup).digest('hex');
}
async function attach(f,markup,kind) {
 if(!markup)return f;
 const key=composeKey(f,markup),bucket=composed[kind];
 const {cardV23,bossRaw,cardRaw,logRaw,referenceOnly,...safe}=f;
 const cached=reuseComposed(bucket,key);
 if(cached)return {...safe,...cached};
 const [width,height]=SHAPES[kind],logicalHeight=kind==='boss'?290:190;
 const overlay=new Resvg(svg(width,height,580,logicalHeight,markup),{font:FONT}).render().asPng();
 const output=await source(f).resize(width,height,{fit:'fill'}).composite([{input:overlay}]).webp({quality:88,alphaQuality:100,effort:1,smartSubsample:true}).toBuffer();
 const prefix=kind==='boss'?'boss-art-':'challenger-current-';
 const artifact={name:prefix+sha(output).slice(0,24)+'.webp',attachment:output};
 keepComposed(bucket,key,artifact);
 return {...safe,...artifact};
}
async function decorate({boss,card,overlay:o={}}={}) {
 if(!boss||!card)throw Error('Both battle panels are required');
 const [bossSVG,cardSVG]=await Promise.all([bossMarkup(o),cardMarkup(o)]);
 // On untouched cards (including ultimates) preserve caller's immutable identity for wire caches.
 const [changedBoss,changedCard]=await Promise.all([attach(boss,bossSVG,'boss'),attach(card,cardSVG,'card')]);
 return {boss:changedBoss,card:changedCard};
}
module.exports={decorate};




