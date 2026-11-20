const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
// Fixed shared display: one action/receipt row and one effect/detail row per
// recipient. Overflow is explicit and its full resolved facts remain accessible.
const buffArrow=require('fs').readFileSync(require('path').join(__dirname,'log-assets/buff-arrow.png')).toString('base64');
const Recipient=require('./recipient-presentation.cjs');
const glyphMeasures=new WeakMap(),fontBoundsFactories=new Map();
const finite=n=>Number.isFinite(n)?Math.max(0,n):0,number=n=>finite(n).toLocaleString('en-US');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const shapes={sword:'M5 20L19 4L20 9L9 21ZM4 15L12 22',eye:'M2 12Q12 0 22 12Q12 24 2 12ZM12 8A4 4 0 1 0 12 16A4 4 0 1 0 12 8',shield:'M12 3L20 6V12Q20 18 12 22Q4 18 4 12V6Z',bolt:'M14 2L5 14H11L9 23L21 9H14Z',star:'M12 2L15 9L23 10L17 15L19 23L12 19L5 23L7 15L1 10L9 9Z'};
// Matches the existing raster font selection; optional for headless adapters.
// Measure painted glyph bounds, rather than assuming equal ascenders/descenders.
function createTextBounds(root){
 if(fontBoundsFactories.has(root))return fontBoundsFactories.get(root);
 const fs=require('node:fs'),path=require('node:path'),{Resvg}=require('@resvg/resvg-js');
 const fontFiles=['raid-latin-bold.otf','NotoSansKR-Bold.otf'].map(f=>runtimePaths.join(root,f)).filter(fs.existsSync);
 const options={font:{fontFiles,defaultFontFamily:'Noto Sans KR',loadSystemFonts:fontFiles.length===0}},cache=new Map();
 let ui;try{ui=require(runtimePaths.join(root,'raid-ui-fonts'));}catch{}
 const measure=(value,size)=>{const key=size+':'+value;if(cache.has(key))return cache.get(key);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="100"><text x="0" y="50" font-family="Noto Sans KR" font-weight="700" font-size="'+size+'">'+esc(value)+'</text></svg>';
  const selected=ui?.supports(svg)?{font:{...options.font,fontFiles:fontFiles.map(f=>f.endsWith('NotoSansKR-Bold.otf')?ui.files.korean:f)}}:options;
  const box=new Resvg(svg,selected).innerBBox(),result=box?{top:box.y-50,bottom:box.y+box.height-50}:null;
  cache.set(key,result);if(cache.size>1024)cache.delete(cache.keys().next().value);return result;
 };
 fontBoundsFactories.set(root,measure);if(fontBoundsFactories.size>4)fontBoundsFactories.delete(fontBoundsFactories.keys().next().value);return measure;
}
function drawing(input,{wrap,textBounds,impactIcon=()=>'',symbol=()=>'',effectIcon=()=>null,effectVisual=null,detailLayout=null}={}){
 if(typeof wrap!=='function')throw new TypeError('Measured text wrapping is required');
 const model=Recipient.create(input),player=model.actors.player,boss=model.actors.boss;
 const txt=(x,y,value,size=16,color='#edf3fa',extra='')=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-size="${size}" font-weight="700" fill="${color}" ${extra}>${esc(value)}</text>`;
 function measured(value,size){if(!value)return 0;let cache=glyphMeasures.get(wrap);if(!cache){cache=new Map();glyphMeasures.set(wrap,cache);}const key=size+':'+value;if(cache.has(key))return cache.get(key);let low=0,high=2048;for(let i=0;i<13;i++){const mid=(low+high)/2,lines=wrap(value,size,mid,99);if(lines.length===1&&lines[0]===value)high=mid;else low=mid;}const result=Math.ceil(high);cache.set(key,result);if(cache.size>1024)cache.delete(cache.keys().next().value);return result;}
 const center=(value,size,baseline)=>{const b=textBounds?.(value,size);return baseline+(b?(b.top+b.bottom)/2:-size*.35);};
 const alignedBaseline=(value,size,y)=>y-(center(value,size,0));
 const image=(x,y,log)=>`<image x="${x}" y="${y}" width="24" height="24" href="data:image/png;base64,${impactIcon(log)}"/>`;
 const impact=(x,y,critical=false,color=null)=>`<g data-impact-icon="hit" transform="translate(${x} ${y})"><rect width="24" height="24" rx="5" fill="#17243b" stroke="${color||(critical?'#ffb640':'#7edfff')}"/><path d="M12 2L14 8L20 5L17 10L23 12L17 14L20 20L14 17L12 23L10 17L4 20L7 14L1 12L7 10L4 4L10 7Z" fill="${color||(critical?'#f89b36':'#7edfff')}"/><path d="M12 7L14 11L18 12L14 14L12 19L10 14L6 12L10 10Z" fill="#fff3d5"/></g>`;
 const evadeIcon=(x,y)=>`<g data-reaction="evade" transform="translate(${x} ${y})"><rect width="24" height="24" rx="5" fill="#132638" stroke="#ffd578"/><path d="M5 17C1 7 16 3 19 10M19 4V10H13M6 20L10 16" fill="none" stroke="#ffd578" stroke-width="1.8" stroke-linecap="round"/></g>`;
 const effectActionIcon=(icon,x,y,color)=>{const asset=effectIcon(icon.key);return asset?`<image data-action-effect-icon="${esc(icon.key)}" x="${x}" y="${y}" width="24" height="24" href="data:image/png;base64,${asset.toString('base64')}"/>`:symbol(icon.fallback||'pause',x,y,color);};
 const drawIcon=(icon,x,y,color,target)=>!icon?'':icon.kind==='impact'?impact(x,y,!!icon.critical,target==='boss'?color:null):icon.kind==='evade'?evadeIcon(x,y):icon.kind==='log'?image(x,y,icon.log):icon.kind==='symbol'?symbol(icon.key,x,y,color):icon.kind==='effect'?effectActionIcon(icon,x,y,color):'';
 const hpText=r=>(r.amount?'−'+number(r.amount):'0')+' HP',totalText=r=>'Total '+(r.total?'−'+number(r.total):'0')+' HP';
 function actionLayout(title,receipt,reserved=0){
  const totalWidth=receipt?.index>1?measured(totalText(receipt),15)+24:0,hpWidth=receipt?measured(hpText(receipt),17)+12:0,room=467-hpWidth-totalWidth-reserved;
  if(room<measured('…',20))throw new RangeError('Exact numeric receipt cannot fit the fixed action row');
  let label=wrap(title,20,room,1)[0]||'';
  const suffix=String(title).match(/( \/ (?:Cancelled|Interrupted|Hit)|! Critical!!)$/)?.[1];
  if(suffix&&label!==title){const suffixWidth=measured('M'+suffix,20)-measured('M',20),name=String(title).slice(0,-suffix.length);if(room>suffixWidth+measured('…',20))label=(wrap(name,20,room-suffixWidth,1)[0]||'')+suffix;else{const outcome=suffix.replace(/^\s*\/\s*|^!\s*/, '');if(measured(outcome,20)>room)throw new RangeError('Resolved outcome and exact receipt cannot fit the fixed action row');label=outcome;}}
  const hpX=151+measured(label,20)+12;return {label,hpX,endX:receipt?hpX+measured(hpText(receipt),17):151+measured(label,20),right:622-totalWidth,truncated:label!==title};
 }
 function effectArt(effect,x,baseline,label,size=11,sideStack=false,iconWidth=size>=20?30:18){
  const visual=effectVisual?.(effect.iconKey),icon=effectVisual?visual?.art:effectIcon(effect.iconKey),glyph=visual?.glyph,bad=effect.kind==='debuff',color=bad?'#ff9fae':'#82eaf3',arrow=Recipient.effectArrow(effect),stack=effect.stacks??null;
  const shape=effect.kind==='debuff'&&effect.statChanges?.some(c=>c.statId==='attack'&&c.delta<0)?'sword':effect.shape||'star';
  return `<g data-effect-id="${esc(effect.effectId)}" data-recipient="${effect.target}" data-gained-${effect.kind}="${esc(effect.name)}" transform="translate(${x} ${center(label,size,baseline)-iconWidth/2}) scale(${iconWidth/18})"><rect width="18" height="18" rx="4" fill="${bad?'#381a31':'#113244'}" stroke="${color}"/>`+
   (icon?`<image data-buff-art="${esc(effect.name)}" width="18" height="18" href="data:image/png;base64,${icon.toString('base64')}"/>`:glyph?txt(9,13,glyph,13,color,'text-anchor="middle" data-buff-glyph="true"'):`<path d="${shapes[shape]||shapes.star}" transform="translate(1 0) scale(.68)" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)+
   (stack!==null&&!sideStack?`<g data-gained-stack="${stack}"><rect x="-3" y="-3" width="14" height="9" rx="2" fill="#08111e"/>${txt(4,4,stack,8,'#e7cb91','text-anchor="middle"')}</g>`:'')+
   (arrow && !bad && effect.target==="player"?`<image x="12" y="-1" width="8" height="8" href="data:image/png;base64,${buffArrow}"/>`:arrow?`<g data-gained-arrow="upper-right"><rect x="14" y="-3" width="8" height="10" rx="2" fill="#08111e"/>${txt(18,5,arrow.text,10,arrow.color,'text-anchor="middle"')}</g>`:'')+'</g>';
 }
 function detailStrip(actor,target,baseline,{x:startX=115,width=503,includeEffects=true,includeNotes=true,includeHint=true,prefixVisible=true,row=2,centerY=null,fontSize=11}={}){
  const textOffset=centerY==null?0:2*640/1055; const effects=includeEffects?['buff','debuff'].flatMap(kind=>actor.effects.filter(e=>e.kind===kind)):[];
  const items=effects.map(effect=>({type:'effect',effect,text:effect.shortName||effect.name})).concat(includeNotes?actor.notes.map((note,index)=>({type:'note',note,index,text:note.text})):[]);
  if(includeHint&&actor.gauge?.hint)items.push({type:'hint',text:actor.gauge.shortHint||actor.gauge.hint,fullText:actor.gauge.hint});
  const compact=centerY!=null;
  const overflow=[],shown=[];
  let used=0,effectCount=0,effectMax=target==="player" && fontSize>=17 ? 200 : 135;
  // Inline mechanic effects use the same type/icon sizes. Shorten labels before
  // hiding an ordinary five-item set; every full name remains in details/status.
  if(row===1&&items.length<=5){
   const packedWidth=cap=>items.reduce((sum,item)=>sum+26+measured(wrap(item.text,fontSize,cap,1)[0]||'',fontSize)+8,0);
   while(effectMax>24&&packedWidth(effectMax)>width)effectMax--;
  }
  // A one-row compact name may ellipsize, but the full name stays in accessible
  // description/active status and is explicitly identified in overflow metadata.
  for(const item of items){
   if(compact && item.type==='effect'){
    const iconWidth=fontSize>=20?(effects.length>=7 && actor.notes.length?24:30):18;
    const label=item.effect.stacks!=null?'×'+item.effect.stacks:'';
    const tokenWidth=iconWidth+7+(label?Math.max(measured(label,fontSize),fontSize*(0.9+0.72*(label.length-1)))+5:0);
    if(used+tokenWidth>width){overflow.push(item);continue;}
    shown.push({...item,label,width:tokenWidth,sideIcon:true,iconWidth});
    used+=tokenWidth;effectCount++;continue;
   }
   if(compact && item.type==='note' && item.note.icon?.after && item.text.startsWith(item.note.icon.after)){
    const tail=item.text.slice(item.note.icon.after.length).trim();
    if(tail)item.text=tail;
   }
   const noteIcon=item.note?.icon,inlineIcon=noteIcon?.key&&typeof noteIcon.after==='string'&&noteIcon.after&&item.text.startsWith(noteIcon.after)?noteIcon:null;
   const prefix=item.type==='effect'&&fontSize>=20?38:item.type==='effect'||inlineIcon?26:item.note?.resource?17:0;
   const maxText=item.type==='effect'?effectMax:Math.max(12,width-prefix-12);
   const label=wrap(item.text,fontSize,maxText,1)[0]||'',token={...item,label,width:prefix+measured(label,fontSize)+(row===1?8:12),prefix,inlineIcon,truncated:label!==item.text};
   if(item.type==='effect'&&effectCount>=5||used+token.width>width){overflow.push(item);continue;}
   shown.push(token);used+=token.width;if(item.type==='effect')effectCount++;
  }
  // Counts above may over-reserve after a skipped wide token, but never hide a
  // fact or make a later token collide with the explicit details indicator.
  let svg='',x=startX;
  const kinds=new Set(effects.map(e=>e.kind));
  if(prefixVisible&&kinds.size===2)svg+=txt(18,baseline,'Buff!',10,'#89e4d4')+txt(47,baseline,'/',10,'#afbdcc')+txt(55,baseline,'Debuff!',10,'#ff9fae');
  else if(prefixVisible&&kinds.size)svg+=txt(18,baseline,kinds.has('buff')?'Buff!':'Debuff!',fontSize,kinds.has('buff')?'#89e4d4':'#ff9fae');
  else if(prefixVisible&&items.length)svg+=txt(18,baseline,actor.gauge?'INTERRUPT':'RESULT',10,actor.gauge?'#ffe1a0':'#9be4f2');
  if(effects.length)svg+=`<g data-effect-row="${row}" data-effect-rows="1" data-effect-count="${effects.length}" data-shown-effects="${effectCount}">`;
  for(const item of shown){
   const itemBaseline=centerY==null?baseline:alignedBaseline(item.label,fontSize,centerY);
   if(item.sideIcon){
    const ref=item.label||'0',base=alignedBaseline(ref,fontSize,centerY);
    svg+=effectArt(item.effect,x,base,ref,fontSize,true,item.iconWidth);
    if(item.label)svg+=txt(x+item.iconWidth+5,base+textOffset,item.label,fontSize,'#e7cb91');
   }else if(item.type==='effect')svg+=effectArt(item.effect,x,itemBaseline,item.label,fontSize)+txt(x+item.prefix,itemBaseline+textOffset,item.label,fontSize,item.effect.kind==='debuff'?'#ff9fae':'#82eaf3',`data-effect-label="${esc(item.effect.effectId)}"`);
   else if(item.inlineIcon&&!item.truncated){const lead=item.inlineIcon.after,tail=item.label.slice(lead.length).trimStart(),iconX=x+measured(lead,fontSize)+5,asset=effectIcon(item.inlineIcon.key);svg+=txt(x,itemBaseline+textOffset,lead,fontSize,item.note.color||'#d9e8f6',`data-detail-kind="note"`);if(asset)svg+=`<image data-note-effect-icon="${esc(item.inlineIcon.key)}" x="${iconX}" y="${center(item.label,fontSize,itemBaseline)-9}" width="18" height="18" href="data:image/png;base64,${asset.toString('base64')}"/>`;svg+=txt(iconX+23,itemBaseline+textOffset,tail,fontSize,item.note.color||'#d9e8f6',`data-detail-kind="note"`);}
   else {if(item.note?.resource)svg+=`<path data-resource-icon="legacy-diamond" d="M${x+5} ${itemBaseline-10}L${x+10} ${itemBaseline-5}L${x+5} ${itemBaseline}L${x} ${itemBaseline-5}Z" fill="#9be4f2" stroke="#d9ffff" stroke-width=".6"/>`;const runs=item.note?.runs;if(Array.isArray(runs)&&runs.map(r=>r.text).join('')===item.label)svg+=`<text x="${x+item.prefix}" y="${itemBaseline+textOffset}" font-family="Noto Sans KR" font-size="${fontSize}" font-weight="700" xml:space="preserve" data-detail-kind="${item.type}">${runs.map(run=>`<tspan fill="${esc(run.color||item.note.color)}">${esc(run.text)}</tspan>`).join('')}</text>`;else svg+=txt(x+item.prefix,itemBaseline+textOffset,item.label,fontSize,item.note?.color||'#d9e8f6',`data-detail-kind="${item.type}"`);}
   x+=item.width;
  }
  if(effects.length)svg+='</g>';
  return {svg,bottom:items.length?baseline+5:0,shownEffects:shown.filter(i=>i.type==='effect').map(i=>i.effect.effectId),
   omitted:overflow.map(i=>i.type==='effect'?{type:'effect',effectId:i.effect.effectId,name:i.effect.name}:i.type==='hint'?{type:'hint',text:i.fullText||i.text}:{type:'note',index:i.index,text:i.text}),
   shortened:shown.filter(i=>i.truncated).map(i=>i.type==='effect'?{type:'effect',effectId:i.effect.effectId,name:i.effect.name}:{type:i.type,text:i.fullText||i.text})};
 }
 function actorDrawing(actor,target,baseline,detailBaseline){
  if(actor.receipt&&actor.extra)throw new TypeError('One visible received-hit event per actor is required; provide a true hit prefix instead of two receipts');
  const receipt=actor.receipt||actor.extra?.receipt;
  let title=actor.action.label;
  if(actor.extra)title=[title,actor.extra.text].filter(Boolean).join(' / ');
  if(!title&&receipt)title=receipt.outcome==='evaded'?'Evaded':'Hit';
  const inline=target==='boss'&&actor.gauge&&actor.effects.length>0;
  const layout=actionLayout(title,receipt,inline?measured('+'+actor.effects.length+' details',11)+20:0),icon=actor.action.icon||(receipt?{kind:'impact',critical:!!receipt.critical}:null);
  const actionCenter=center(layout.label,20,baseline);
  const lower=detailStrip(actor,target,detailLayout?.[target]?.baseline??detailBaseline,{includeEffects:!inline,...detailLayout?.[target]});
  const upper=inline?detailStrip(actor,target,baseline,{x:layout.endX+16,width:Math.max(0,layout.right-layout.endX-16),includeNotes:false,includeHint:false,prefixVisible:false,row:1,centerY:actionCenter}):null;
  const details=upper?{svg:upper.svg+lower.svg,bottom:lower.bottom,shownEffects:upper.shownEffects,omitted:[...upper.omitted,...lower.omitted],shortened:[...upper.shortened,...lower.shortened]}:lower;
  let svg=txt(18,baseline-2,target==='player'?'YOUR ACTION':'BOSS ACTION',10,target==='player'?'#e7cb91':'#f0b7bf');
  if(title)svg+=drawIcon(icon,115,actionCenter-12,actor.action.color,target)+txt(151,baseline,layout.label,20,actor.action.color,`data-action-recipient="${target}"`);
  const currentHPColor=target==='boss'&&receipt?.source==='player'&&receipt.critical===true&&receipt.amount>0?'#ff3030':actor.action.color;
  if(receipt)svg+=txt(layout.hpX,baseline,hpText(receipt),17,currentHPColor,'data-current-hp="inline"')+(receipt.index>1?txt(622,baseline,totalText(receipt),15,receipt.color,'text-anchor="end" data-received-total="right"'):'');
  return {svg:svg+details.svg,bottom:Math.max(title?baseline+6:0,details.bottom),details,actionShortened:layout.truncated?title:null};
 }
 const own=actorDrawing(player,'player',55,86),enemy=actorDrawing(boss,'boss',134,165),g=boss.gauge;
 let gauge='';if(g){const ratio=Math.max(0,Math.min(1,g.progress));gauge=`<g data-gimmick-gauge="boss-action-wide" data-gimmick-count="${g.hits}/${g.required}"><rect x="18" y="174" width="604" height="12" rx="4" fill="#302711" stroke="#d8ad48" stroke-width="1"/><rect x="20" y="176" width="${600*ratio}" height="8" rx="2" fill="url(#yellow)"/><path d="M320 176V184" stroke="#6b501d" stroke-width="1"/><rect x="568" y="174" width="54" height="12" rx="3" fill="#08111e"/>${txt(595,184,g.hits+' / '+g.required,10,'#ffe1a0','text-anchor="middle"')}</g>`;}
 const defense=model.turnLabel==='Defense Turn',badgeColor=defense?'#8ce1dc':'#ffaf68',badgePath=defense?'M8 1L14 4V9Q14 14 8 17Q2 14 2 9V4Z':'M3 14L12 2L15 1L14 5L5 16ZM1 11L7 17';
 const badge=`<g data-turn-badge="${model.turnLabel}" transform="translate(12 5)"><rect width="152" height="22" rx="5" fill="${defense?'#153740':'#3d2c22'}" stroke="${badgeColor}" stroke-width=".65"/><path data-turn-icon="${defense?'shield':'sword'}" d="${badgePath}" transform="translate(7 2)" fill="none" stroke="${badgeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${txt(30,15,model.turnLabel,13,badgeColor)}</g>`;
 const defs='<defs><linearGradient id="yellow" x2="0" y2="1"><stop stop-color="#fff4a5"/><stop offset=".45" stop-color="#ffcf39"/><stop offset="1" stop-color="#df951c"/></linearGradient></defs>';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="192" data-layout="vertical-compact" data-content-rows-per-side="2" data-divider="108" data-player-bottom="${own.bottom}" data-boss-bottom="${g?186:enemy.bottom}">${defs}<rect x="1" y="1" width="638" height="190" rx="9" fill="#0c1524" stroke="#304156" stroke-width=".8"/><rect x="1" y="1" width="638" height="30" rx="6" fill="#142035"/>${badge}`+txt(622,21,'Total damage '+number(model.totalDamage),14,'#ffe0a0','text-anchor="end"')+'<path data-action-divider="horizontal-compact" d="M18 108H622" stroke="#304156" stroke-width="1"/>'+own.svg+enemy.svg+gauge+'</svg>';
 const effectText=effects=>['buff','debuff'].flatMap(kind=>{const items=effects.filter(e=>e.kind===kind);return items.length?[kind==='buff'?'Buff!':'Debuff!',...items.map(e=>e.name+(e.description?' · '+e.description:''))]:[];});
 const rtext=r=>r?[hpText(r),r.index>1?totalText(r):''].filter(Boolean):[];
 const description=[model.turnLabel,player.action.label,...rtext(player.receipt),...player.notes.map(x=>x.text),...effectText(player.effects),player.extra?.text,...rtext(player.extra?.receipt),boss.action.label,...rtext(boss.receipt),...boss.notes.map(x=>x.text),...effectText(boss.effects),boss.extra?.text,...rtext(boss.extra?.receipt),g?.description||g?.hint,g?.hint&&g.description&&!g.description.includes(g.hint)?g.hint:null].filter(Boolean).join(' / ');
 return {svg,height:192,description,details:{player:own.details,boss:enemy.details},shortenedActions:{player:own.actionShortened,boss:enemy.actionShortened}};
}
module.exports={drawing,createTextBounds};




