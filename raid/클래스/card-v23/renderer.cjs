'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'assets'),manifest=require('./assets/manifest.json'),pose=require('./pose.cjs'),v35=require('./raster-v35.cjs');
const hud=require('./battle-hud-v351.cjs');
const visible=require('../../보스/전투/raid-visible-effects.js');
const profile=require('../../보스/서큐버스/succubus-presentation.cjs');
const {renderPanel}=require('../../보스/전투/raid-panel-delta.cjs');
const bases=new Map(),cards=new Map();let bytes=0,baseBytes=0,hits=0,misses=0;
const W=1055,H=346,rawSize=W*H*4;
const gems=Object.fromEntries(['empty','full'].map(k=>[k,fs.readFileSync(path.join(root,'energy-'+k+'.rgba'))]));
const battleEnergyGem=fs.readFileSync(path.join(root,'energy-full-glow.rgba'));
const prepared=JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(root,'overlay.json.deflate'))));
for(const g of Object.values(prepared.glyphs))g.rgba=Buffer.from(g.rgba,'base64');
for(const key of Object.keys(prepared.icons))prepared.icons[key]=Buffer.from(prepared.icons[key],'base64');
// The two Contract labels use the same authored vulnerability icon.
prepared.icons['succubus.devils_contract']=prepared.icons['succubus.contract_vulnerability'];
const num=n=>Number.isFinite(Number(n))?Number(n):0,fmt=n=>num(n).toLocaleString('en-US',{maximumFractionDigits:1});
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function chunk(type,data){const h=Buffer.alloc(8),end=Buffer.alloc(4);h.writeUInt32BE(data.length);h.write(type,4);let c=0xffffffff;for(const b of h.subarray(4))c=crcTable[(c^b)&255]^(c>>>8);for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);end.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([h,data,end]);}
function locate(job,pose){const key=job+':'+pose,file=manifest.cards[key];return v35.resolve(key)||(file?{key,pose,file}:null);}
function idle(job){return locate(job,'idle');}
function workshopIdle(job){const key=job+':idle',file=manifest.cards[key];return job==='paladin'&&file?{key:key+':workshop',pose:'idle',file}:idle(job);}
function resolve(a){
 const s=a.state,job=s.config.job;let selected=pose.select(a);
 if(job==='paladin')selected=require('./paladin-pose.cjs').select(a,selected);
 if(job==='berserker')selected=require('./berserker-pose.cjs').select(a,selected);
 const alt=({thrust:'thrust_a',deep_thrust:'thrust_b'})[selected];
 const newRageHit=job==='berserker'&&['hit','heavy_hit'].includes(selected)&&require('../광전사/berserker-rules.cjs').enraged(s)?v35.resolve(job+':enrage_hit'):null;
 const unifiedHit=selected==='heavy_hit'&&(job==='warrior'||job==='berserker')?v35.resolve(job+':hit'):null;
 return newRageHit||unifiedHit||(job==='warrior'&&alt?v35.resolve(job+':'+alt):null)||locate(job,selected)||idle(job);
}
function base(image){
 const {key,file,rgb}=image;if(bases.has(key)){const v=bases.get(key);bases.delete(key);bases.set(key,v);return v;}
 const v=rgb?{rgb:v35.decode(file)}:require('./template-base.cjs').decode(file,key.split(':')[0]);
 const size=x=>x.rgb?.length||(W*H+33536);baseBytes+=size(v);bases.set(key,v);
 while(bases.size>24||baseBytes>10*1024*1024){const oldest=bases.keys().next().value;baseBytes-=size(bases.get(oldest));bases.delete(oldest);}return v;
}
function status(s,battle){const plans=require('../../보스/전투/흐름/status-panels.cjs').planStatusPanels({state:s,visible,wrap:t=>[t]});const effects=plans.flatMap(p=>p.effects).map(e=>{const iconKey=profile.activeEffect(e,s)?.iconKey;
 if(battle&&s.config.job==='berserker'&&/^berserker\.charge\.[123]$/.test(iconKey||'')&&Number.isInteger(e.count)&&e.count>=1&&e.count<=3)return {...e,iconKey,count:null,turns:null};
 return {...e,iconKey};});
 if(battle&&effects.length>7){
  // Keep normal order; reserve the last visible slot if the current class icon would be hidden.
  const special=effects.findIndex(e=>!!profile.resolveEffectIcon(e.iconKey)?.card);
  if(special>=7)effects.splice(6,0,effects.splice(special,1)[0]);
 }
 return effects;
}
function blend(raw,source,w,h,left,top,palette,lookup,tint){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,alpha=source[i+3];if(!alpha)continue;const j=(y+top)*W+x+left,k=raw[j]*3;const r=alpha===255?(tint?.[0]??source[i]):Math.round(((tint?.[0]??source[i])*alpha+palette[k]*(255-alpha))/255),g=alpha===255?(tint?.[1]??source[i+1]):Math.round(((tint?.[1]??source[i+1])*alpha+palette[k+1]*(255-alpha))/255),b=alpha===255?(tint?.[2]??source[i+2]):Math.round(((tint?.[2]??source[i+2])*alpha+palette[k+2]*(255-alpha))/255);raw[j]=lookup[((r>>3)<<10)|((g>>3)<<5)|(b>>3)];}}
function indexedPNG(indices,palette,alpha){const rows=Buffer.allocUnsafe((W+1)*H);for(let y=0;y<H;y++){rows[y*(W+1)]=0;indices.copy(rows,y*(W+1)+1,y*W,(y+1)*W);}const head=Buffer.alloc(13);head.writeUInt32BE(W);head.writeUInt32BE(H,4);head[8]=8;head[9]=3;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('PLTE',palette),...(alpha?[chunk('tRNS',alpha)]:[]),chunk('IDAT',zlib.deflateSync(rows,{level:3})),chunk('IEND',Buffer.alloc(0))]);}
function blendOn(raw,b,source,w,h,x,y,tint){
 if(b.rgb){v35.blend(raw,source,w,h,x,y,tint);return;}
 blend(raw,source,w,h,x,y,b.palette,b.lookup,tint);
 if(!b.counterPixels||(tint!==hud.BUFF&&tint!==hud.DEBUFF))return;
 if(!b.counterPixels.has(tint))b.counterPixels.set(tint,[]);
 const pixels=b.counterPixels.get(tint);
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(source[(yy*w+xx)*4+3]>=170)pixels.push((y+yy)*W+x+xx);
}
function indexedCounterPalette(raw,b){
 if(!b.counterPixels?.size)return {palette:b.palette,alpha:b.alpha};
 // Preserve each existing base pixel and reuse spare indexed slots only.
 const used=new Uint8Array(256);for(let i=0;i<raw.length;i++)used[raw[i]]=1;
 const palette=Buffer.from(b.palette),alpha=Buffer.from(b.alpha);
 for(const [rgb,pixels] of b.counterPixels){
  const free=used.indexOf(0);if(free<0)break;
  used[free]=1;alpha[free]=255;
  for(let j=0;j<3;j++)palette[free*3+j]=rgb[j];
  for(const index of pixels)raw[index]=free;
 }
 return {palette,alpha};
}
function paintText(raw,b,x,y,value,size,width,align='right',tint){const glyphs=[...String(value)].map(c=>c===' '?{advance:Math.round(size*.32)}:prepared.glyphs[size+':'+c]).filter(Boolean),length=glyphs.reduce((n,g)=>n+g.advance,0),scale=Math.min(1,width/Math.max(1,length));let left=align==='left'?x:x-length*scale;for(const g of glyphs){if(g.rgba){if(scale===1)blendOn(raw,b,g.rgba,g.w,g.h,Math.round(left),y+g.top,tint);else{const w=Math.max(1,Math.round(g.w*scale)),rgba=Buffer.alloc(w*g.h*4);for(let yy=0;yy<g.h;yy++)for(let xx=0;xx<w;xx++)g.rgba.copy(rgba,(yy*w+xx)*4,(yy*g.w+Math.min(g.w-1,Math.floor(xx/scale)))*4,(yy*g.w+Math.min(g.w-1,Math.floor(xx/scale)))*4+4);blendOn(raw,b,rgba,w,g.h,Math.round(left),y+g.top,tint);}}left+=g.advance*scale;}}
// Only the Workshop top card requests this larger number; its label is baked art.
const workshopLevelGlyphs=Object.create(null);
function workshopLevel(raw,b,value,t){
 const GOLD=[255,220,65],scale=37/29;
 const glyphs=[...String(value)].map(c=>workshopLevelGlyphs[c]??=(()=>{
  const g=prepared.glyphs['29:'+c];if(!g)return null;
  const w=Math.ceil(g.w*scale)+1,h=Math.round(g.h*scale),rgba=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const row=Math.min(g.h-1,Math.max(0,(y+.5)/scale-.5)),col=(x+.5)/scale-.5;
   const sample=(dx)=>{const c=col+dx,u=Math.floor(c),v=Math.floor(row),cx=c-u,cy=row-v;
    const at=(x,y)=>x>=0&&x<g.w?g.rgba[(y*g.w+x)*4+3]:0;
    return (at(u,v)*(1-cx)+at(u+1,v)*cx)*(1-cy)+(at(u,Math.min(g.h-1,v+1))*(1-cx)+at(u+1,Math.min(g.h-1,v+1))*cx)*cy;
   };
   rgba[(y*w+x)*4+3]=Math.round(Math.max(sample(0),sample(-.65)));
  }
  return {w,h,rgba,advance:Math.round(g.advance*scale),top:-h};
 })()).filter(Boolean);
 const width=glyphs.reduce((n,g)=>n+g.advance,0);
 if(!glyphs.length||width>t.width){paintText(raw,b,t.x,t.y,value,29,t.width,t.align,GOLD);return;}
 const center=37; let x=t.align==='left'?t.x:t.x-width;
 for(const g of glyphs){blendOn(raw,b,g.rgba,g.w,g.h,x,Math.round(center-(g.h-1)/2),GOLD);x+=g.advance;}
}
function paintDynamic(raw,b,a,effects,layout,battle,workshop){const s=a.state,st=s.stats,crit=Math.round((1.2+(s.config.ruinPercentPerPoint??0)*(s.config.ruin||0)/100+((st.critDamagePercent??0)+Math.max(0,st.crit-100))/100)*100),hp=Math.max(0,Math.min(1,num(s.hp)/Math.max(1,num(st.hp))));
 if(layout){
  const values=[s.config.level,fmt(s.hp)+' / '+fmt(st.hp),num(s.energy)+' / '+num(s.maxEnergy),fmt(st.attack),fmt(st.defense),Math.min(100,num(st.crit))+'%',num(st.evasion)+'%',crit+'%'];
  const level=()=>hud.paintLevel(s.config.level,prepared.glyphs,(...args)=>blendOn(raw,b,...args),!!b.rgb);
  v35.fields.forEach((k,i)=>{if(workshop&&k==='level'){workshopLevel(raw,b,values[i],layout.text.level);return;}if(battle&&k==='level'&&!layout.nativeBattle)return;const t=layout.text[k], y=t.y+(battle&&k==='energy'?2:0);if(battle&&layout.nativeBattle){for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]])paintText(raw,b,t.x+dx,y+dy,values[i],t.size,t.width,t.align,[20,12,14]);}paintText(raw,b,t.x,y,values[i],t.size,t.width,t.align,t.color);});
  v35.hpFill(raw,layout.hp,hp);
  if(battle&&!layout.nativeBattle)level();
  paintBadges(raw,b,effects,battle?(layout.nativeBattle?{...layout.badges,large:true}:hud.badgeLayout(true)):layout.badges);return;
 }
 for(const args of [[910,44,s.config.level,29,100,'left'],[656,98,fmt(s.hp)+' / '+fmt(st.hp),26,159],[657,139+(battle?2:0),num(s.energy)+' / '+num(s.maxEnergy),22,95],[707,195,fmt(st.attack),26,137],[1010,195,fmt(st.defense),26,133],[707,239,Math.min(100,num(st.crit))+'%',26,137],[1010,239,num(st.evasion)+'%',26,110],[707,282,crit+'%',24,94]])if(workshop&&args[0]===910)workshopLevel(raw,b,s.config.level,{x:910,y:44,width:100,align:'left'});else if(!battle||args[0]!==910)paintText(raw,b,...args);
 if(battle)hud.paintLevel(s.config.level,prepared.glyphs,(...args)=>blendOn(raw,b,...args),!!b.rgb);
 const length=Math.round(342*hp);for(let y=0;y<15;y++)for(let x=0;x<length;x++){const edgeX=Math.min(x,length-1-x),edgeY=Math.min(y,14-y);if(edgeX<5&&edgeY<5&&(edgeX-5)**2+(edgeY-5)**2>25)continue;const t=y/14,c=hp>.25?[Math.round(197-143*t),Math.round(255-115*t),Math.round(138-106*t)]:[255-Math.round(75*t),82-Math.round(50*t),82-Math.round(32*t)];raw[(y+83)*W+x+676]=b.lookup[((c[0]>>3)<<10)|((c[1]>>3)<<5)|(c[2]>>3)];}
 paintBadges(raw,b,effects,battle?hud.badgeLayout(false):{x:752,y:260,step:37,overflowX:1009,overflowY:317});
}
function paintBadges(raw,b,effects,layout){effects.slice(0,7).forEach((e,i)=>{const x=layout.x+i*layout.step,y=layout.y,newIcon=layout.large&&profile.resolveEffectIcon(e.iconKey)?.card,icon=prepared.icons[e.iconKey];if(newIcon)blendOn(raw,b,newIcon,38,38,x,y);else if(icon){const n=layout.large?38:31;blendOn(raw,b,layout.large?hud.icon(icon):icon,n,n,x,y);}else paintText(raw,b,x+(layout.large?32:28),y+(layout.large?30:26),e.group==='debuff'?'↓':'↑',layout.large?29:24,29);if(e.turns!=null||e.count!=null){
 const value=e.turns??e.count;
 if(layout.large&&Number.isFinite(value)){
  blendOn(raw,b,hud.counterBack,28,19,x+10,y+22);
  paintText(raw,b,x+36,y+37,value,22,24,'right',hud.countColor(e.group));
 }else if(!layout.large)paintText(raw,b,x+32,y+38,e.turns!=null?e.turns+'t':e.count,10,36);
}});if(effects.length>7)paintText(raw,b,layout.overflowX??layout.x+6*layout.step+32,layout.overflowY??layout.y+57,'+'+(effects.length-7),12,layout.large?23:50);}
function asset(a){return render(a,resolve(a),true);}
// A retained legacy caller gets the exact current full-card pose, not retired portraits.
function frenzyReleasedStageOneAsset(a){return render(a,v35.resolve('berserker:enrage_charged_attack_1')||locate('berserker','enrage_idle')||idle('berserker'),true);}
function idleAsset(a){return render(a,workshopIdle(a.state.config.job));}
function workshopProfileAsset(a){return render(a,idle(a.state.config.job),false,true);}
function render(a,image,battle=false,workshop=false){
 if(!image)return null;
 const s=a.state,stats=s.stats,effects=status(s,battle);
 const badges=effects.slice(0,7).map(e=>[e.iconKey,e.group,e.turns,e.count]);
 const key=JSON.stringify([workshop?'workshop-profile':battle,image.revision||image.key,s.hp,s.energy,s.maxEnergy,s.config.level,s.config.ruin,
  s.config.ruinPercentPerPoint,stats.hp,stats.attack,stats.defense,stats.crit,stats.evasion,
  stats.critDamagePercent,effects.length,badges]);
 const description=s.config.job+' / '+image.pose+' / Level '+s.config.level+' / HP '+s.hp+' / '+stats.hp;
 return renderPanel(a.panelRefs,'character',key,()=>renderCard(a,image,key,effects,description,battle,workshop),description);
}
function renderCard(a,image,key,effects,description,battle,workshop){
 const s=a.state;
 if(cards.has(key)){hits++;return cards.get(key);}
 misses++;
 const cached=base(image),b=battle&&!cached.rgb&&effects.some(e=>e.turns!=null||e.count!=null)?{...cached,counterPixels:new Map()}:cached,raw=Buffer.from(b.rgb||b.indices);paintDynamic(raw,b,a,effects,image.layout,battle,workshop);
 const g=image.layout?.gems||{x:686,y:114,step:46};
 const filled=Math.max(0,Math.min(7,num(s.energy)));
 for(let i=0;i<7;i++)blendOn(raw,b,i<filled?(battle?battleEnergyGem:gems.full):gems.empty,36,36,g.x+i*g.step,g.y);
 const indexed=()=>{const {palette,alpha}=indexedCounterPalette(raw,b);return indexedPNG(raw,palette,alpha);};
 const attachment=image.rgb?v35.encode(raw,chunk):indexed();
 const result={name:'challenger-current.png',attachment,description,cardV23:true};cards.set(key,result);bytes+=result.attachment.length;while(cards.size>32||bytes>16*1024*1024){const k=cards.keys().next().value;bytes-=cards.get(k).attachment.length;cards.delete(k);}return result;
}
function warmAttack(state){
 const image=resolve({state,cardFrame:{kind:"reaction",log:{action:"attack"}}});
 if(image&&!bases.has(image.key))base(image);
}
function warmDefense(state){
 const job=state.config.job;
 const pose=job==='warrior'?'parry':job==='paladin'?'guard':require('../광전사/berserker-rules.cjs').enraged(state)?'enrage_tackle':'tackle';
 const image=locate(job,pose);
 if(image&&!bases.has(image.key))base(image);
}
module.exports={asset,idleAsset,workshopProfileAsset,frenzyReleasedStageOneAsset,resolve,warmAttack,warmDefense,stats:()=>({hits,misses,baseBytes,cardBytes:bytes}),clear:()=>{bases.clear();cards.clear();bytes=0;baseBytes=0;hits=0;misses=0;}};

