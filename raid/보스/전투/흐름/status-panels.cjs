const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
// Reviewed row styles with an opt-in recipient-aware status boundary.
// Legacy Succubus descriptors remain an adapter; no combat state is changed.
const fs=require('node:fs'),path=require('node:path'),BuffIcons=require('./buff-icons.cjs'),Recipient=require('./recipient-presentation.cjs'),Profile=require('../../서큐버스/succubus-presentation.cjs');
const BOOSTER_ICON_FILE='discord-boost.png';
const {renderPanel}=require('../raid-panel-delta.cjs');
const ORDER=['buff','debuff'];
// Cache only fully resolved artwork. Any icon, stack, duration or description
// change produces a different SVG, so shared snapshots cannot reuse stale rows.
const rasterCaches=new WeakMap();
function cachedRaster(raster,svg){
 let c=rasterCaches.get(raster);if(!c){c={map:new Map(),bytes:0};rasterCaches.set(raster,c);}
 if(c.map.has(svg)){const entry=c.map.get(svg);c.map.delete(svg);c.map.set(svg,entry);return entry.png;}
 const png=raster(svg),size=Buffer.byteLength(svg)+png.length;c.map.set(svg,{png,size});c.bytes+=size;
 while(c.map.size>24||c.bytes>8*1024*1024){const first=c.map.keys().next().value;c.bytes-=c.map.get(first).size;c.map.delete(first);}
 return png;
}
function descriptors(state,visible,list){
 const result=(list||visible.descriptors(state)).map(e=>{
  // The independent Sharp Eye / Sixth Sense rows already explain their CRIT.
  // Remove only the confirmed redundant phrase from this Succubus-only view.
  if(state.config?.job==='warrior'&&e.name==='BLADE TRANCE')return {...e,description:e.description.replace(' (Thrust CRIT +35%)','')};
  if(e.name!=='Booster')return {...e,name:state.config?.job==='warrior'&&e.name==='Thrust Defense'?'Defense Up':e.name};
  // Use the hydrated combat snapshot, never a copied historical boost factor.
  const percent=state.boosterAttackPercent;
  const description=Number.isFinite(percent)&&percent>=0?'Attack +'+percent+'%':
   (e.description.match(/^Attack \+[\d.]+%/)?.[0]||e.description);
  return {...e,name:'Server Booster',description};
 });
 const p=state.contractPenalty;
 if(p&&p.turns>0){
  const pending=state.turn<p.startTurn;
  result.push({name:'Contract Vulnerability',group:'debuff',bad:true,shape:'scroll',count:null,turns:p.turns,
   description:pending?'Starts next turn · Damage taken +100%':'Damage taken +100%',contractPenaltyIcon:true});
 }
 const grouped=result.map(e=>e.group==='contract'?{...e,group:'debuff',bad:true}:e);
 return ORDER.flatMap(group=>grouped.filter(e=>e.group===group));
}
function planStatusPanels({state,visible,wrap,list,recipientEffects,maxPanels=6}){
 if(!Number.isInteger(maxPanels)||maxPanels<1)throw new RangeError('Status panels require at least one attachment slot');
 if(recipientEffects!==undefined){
  const groups=Recipient.groupEffects(recipientEffects);if(groups.length>maxPanels)throw new RangeError('Status panels require one attachment slot per recipient/category');
  return groups.map(({target,group,effects})=>{
   const rows=effects.map(e=>({...e,group,name:e.name,description:e.description||'',shape:e.shape||'star',bad:e.kind==='debuff',count:e.stacks??null,turns:e.turns??null}));
   const drawing=visible.drawing(state,wrap,rows);
   const recipient=target==='boss'?'Boss':'Player',title=({buff:'Buffs',contract:'Contract',debuff:'Debuffs'})[group];
   const svg=drawing.svg.replace('>'+title+'</text>','>'+recipient+' '+title+'</text>');
   return {...drawing,svg,effects:rows,target,description:recipient+' / '+drawing.description};
  });
 }
 const effects=descriptors(state,visible,list);if(!effects.length)return [];
 // Keep each category together, allowing its drawing to grow for every row.
 // The battle view reserves six slots; at most three category panels are used.
 const groups=ORDER.map(group=>effects.filter(e=>e.group===group)).filter(group=>group.length);
 if(groups.length>maxPanels)throw new RangeError('Status panels require one attachment slot per active category');
 return groups.map(group=>({...visible.drawing(state,wrap,group),effects:group}));
}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function fitOuterFrame(svg,height){
 // The legacy top chamfer left a dark triangular wedge under Discord's rounded
 // image mask. Keep every row and its geometry, rounding only the outside edge.
 svg=svg.replace('<path d="M12 1H628L639 12V29H1V12Z"', '<path d="M1 1H639V29H1Z"');
 const start=svg.indexOf('>')+1;
 return svg.slice(0,start)+`<defs><clipPath id="status-outer-frame"><rect width="640" height="${height}" rx="10"/></clipPath></defs><g clip-path="url(#status-outer-frame)">`+
  svg.slice(start,-6)+`</g></svg>`;
}
function withStatusArtwork(drawing,icons){
 let index=0;const titleLimits=[];
 let svg=drawing.svg.replace(/<path d="[^"]*" transform="translate\(20 (\d+)\) scale\(1\.24\)"[^>]*\/>/g,(shape,y)=>{
  const effect=drawing.effects[index++],icon=icons[effect.iconKey||effect.name],rowY=Number(y)-17;
  let content=icon?`<image x="18" y="${Number(y)-2}" width="34" height="34" href="data:image/png;base64,${icon.toString('base64')}"/>`:shape;
  // Upper-right is stacks, lower-right is remaining turns, independently.
  for(const [value,top] of [[effect.count,true],[effect.turns,false]]){
   if(value==null)continue;
   const label=String(value)+(top?'':'t'),width=Math.max(19,label.length*7+8),x=38,badgeY=rowY+(top?6:42);
   content+=`<rect x="${x}" y="${badgeY}" width="${width}" height="16" rx="4" fill="#08111e"/><text x="${x+width/2}" y="${badgeY+12}" text-anchor="middle" font-family="Noto Sans KR" font-size="12" font-weight="700" fill="#e7cb91">${esc(label)}</text>`;
   if(top&&x+width>66)titleLimits.push({y:rowY+22,x:x+width+8,name:effect.name});
  }
  return content;
 });
 for(const effect of drawing.effects){
  const suffix=effect.turns!=null?' · '+effect.turns+' turn'+(effect.turns===1?'':'s')+' left':
   effect.name==='Parry Empowerment'?'':effect.count!=null?' · '+effect.count+(effect.name==='Attack Enchant'?' charge':effect.count===1?' stack':' stacks'):'';
  if(suffix)svg=svg.replace('>'+esc(effect.name+suffix)+'</text>','>'+esc(effect.name)+'</text>');
 }
 for(const limit of titleLimits){
  const width=622-limit.x,fit=limit.name.length*10>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:'';
  svg=svg.replace(`<text x="72" y="${limit.y}" `,`<text x="${limit.x}" y="${limit.y}"${fit} `);
 }
 return fitOuterFrame(svg,drawing.height);
}
function resolveIcons(options,panels){
 const icons={...(options.effectIcons||{})};
 if(icons['Server Booster']===undefined&&icons.Booster!==undefined)icons['Server Booster']=icons.Booster;
 for(const name of Object.keys(BuffIcons.FILES)){const icon=BuffIcons.read(name,options.state.config?.job);if(icon&&icons[name]===undefined)icons[name]=icon;}
 const sources={"Devil's Contract":'contract-vulnerability.png','Contract Vulnerability':'contract-vulnerability.png','Server Booster':BOOSTER_ICON_FILE};
 if(options.penaltyIcon!==undefined)icons['Contract Vulnerability']=options.penaltyIcon;
 for(const [name,file] of Object.entries(sources)){
  if(icons[name]===undefined&&panels.some(p=>p.effects.some(e=>e.name===name))){
   const location=runtimePaths.join(runtimePaths.directory("raid15"),'assets',file);
   if(fs.existsSync(location))icons[name]=fs.readFileSync(location);
  }
 }
 for(const panel of panels)for(const effect of panel.effects){
  if(!effect.iconKey||icons[effect.iconKey]!==undefined)continue;
  // User-supplied IDs win. Only legacy-adapted rows may use old label keys.
  const legacy=options.recipientEffects===undefined?icons[effect.name]:undefined;
  icons[effect.iconKey]=legacy===undefined?Profile.readEffectIcon(effect.iconKey):legacy;
 }
 return icons;
}
function buildStatusPanels(options){
 const panels=planStatusPanels(options).map(panel=>({...panel,effects:panel.effects.map(e=>e.effectId?e:Profile.activeEffect(e,options.state)||e)}));
 // Custom previews may supply different icon bytes for the same icon name.
 const receipts=options.effectIcons||options.penaltyIcon!==undefined?undefined:options.panelRefs;
 let icons;
 return panels.map((panel,i)=>{
  const rows=panel.effects.map(e=>[e.name,e.description,e.iconKey,e.group,e.count,e.turns]);
  const input=JSON.stringify([options.state.config?.job,i,rows,panel.description]);
  return renderPanel(receipts,'effects',input,()=>{
   icons??=resolveIcons(options,panels);
   const kit=require('./status-kit-render.cjs').drawing(panel,icons,options.wrap);
   const attachment=cachedRaster(options.raster,kit.svg);
   const key=require('crypto').createHash('sha256').update(attachment).digest('hex').slice(0,20);
   return {name:`active-effects-${i+1}-${key}.png`,attachment,description:panel.description};
  },panel.description);
 });
}
function buildInlineStatusPanels(options){
 const effects=descriptors(options.state,options.visible,options.list).map(row=>Profile.activeEffect(row,options.state)||row);
 const output=[];
 const label=e=>[e.name,e.count==null?'':`×${e.count}`,e.turns==null?'':`· ${e.turns}t`].filter(Boolean).join(' ');
 for(const group of ORDER){
  const rows=effects.filter(row=>row.group===group);
  if(!rows.length)continue;
  const header=`${group==='buff'?'BUFFS':'DEBUFFS'} ${rows.length}`;
  const color=group==='buff'?'#a8dfcb':'#ffc0d7';
  const icons=resolveIcons(options,[{effects:rows}]);
  // Split tall runs for Discord. Extra entries continue in accessible text.
  for(let offset=0;offset<rows.length;offset+=16){
   const page=rows.slice(offset,offset+16);
   const description=[header,...page.map(label)].join(' · ');
   if(output.filter(entry=>entry.name).length>=6){
    output.push({content:`**${header}**\n${page.map(e=>`${group==='buff'?'↑':'↓'} ${label(e)}`).join('\n')}`});
    continue;
   }
   const key=JSON.stringify([options.state.config?.job,header,offset,page.map(e=>[label(e),e.iconKey])]);
   const panel=renderPanel(options.panelRefs,'effects',`inline:${key}`,()=>{
    const text=(x,y,value,size,fill)=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-size="${size}" font-weight="700" fill="${fill}" stroke="#181820" stroke-width="2.4" paint-order="stroke">${esc(value)}</text>`;
    const parts=[text(6,24,header,23,color)];let y=36;
    for(let i=0;i<page.length;i+=2){
     const line=page.slice(i,i+2).map(e=>[e,options.wrap(label(e),22,365,99)]);
     for(const [column,[effect,words]] of line.entries()){
      const x=6+column*420,icon=Profile.readEffectIcon(effect.iconKey)||icons[effect.iconKey]||icons[effect.name];
      if(icon)parts.push(`<image x="${x}" y="${y+2}" width="30" height="30" href="data:image/png;base64,${icon.toString('base64')}"/>`);
      else parts.push(text(x+4,y+25,group==='buff'?'↑':'↓',24,color));
      words.forEach((word,index)=>parts.push(text(x+38,y+25+index*27,word,22,'#f1edf2')));
     }
     y+=Math.max(1,...line.map(item=>item[1].length))*27+8;
    }
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${y+4}">${parts.join('')}</svg>`;
    const attachment=cachedRaster(options.raster,svg);
    const digest=require('node:crypto').createHash('sha256').update(attachment).digest('hex').slice(0,20);
    return {name:`active-effects-${offset+1}-${digest}.png`,attachment,description:description.slice(0,1024)};
   },description.slice(0,1024));
   output.push(panel);
  }
 }
 return output;
}

const BATTLE_STATUS_EMOJI=Object.freeze({"shared.server_booster":{"name":"raid_server_booster","id":"","animated":false},"warrior.blade_trance":{"name":"bladetrance","id":"","animated":false},"warrior.thrust_defense":{"name":"defenseup","id":"","animated":false},"warrior.hone":{"name":"hone","id":"","animated":false},"warrior.sharp_eye":{"name":"sharpeye","id":"","animated":false},"warrior.sixth_sense":{"name":"sixthsense","id":"","animated":false},"succubus.contract_vulnerability":{"name":"contractvulnerability","id":"","animated":false},"succubus.devils_contract":{"name":"contractvulnerability","id":"","animated":false},"succubus.charm":{"name":"StatusCurseIconCharm","id":"","animated":false},"berserker.blood_draw":{"name":"berserkerblooddraw","id":"","animated":false},"paladin.blessing":{"name":"paladinblessing","id":"","animated":false},"paladin.divine_grace":{"name":"paladindivinegrace","id":"","animated":false},"paladin.divine_punishment":{"name":"paladindivinepunishment","id":"","animated":false}});
/** Native markdown only; no new raster, effects fetch, frame, or attachment. */
function formatBattleStatusRows(groups){
 const output=[];let content='',separated=false;
 for(const lines of groups){
  if(!lines.length)continue;
  for(const [i,label] of lines.entries()){
   const row='## '+label;
   if(!content&&!output.length)content='# Buffs/Debuffs';
   let spacer=content?(separated&&i===0?'\n\n':'\n'):'';
   if(content.length+spacer.length+row.length>=1900){output.push({content});content='';spacer='';}
   content+=spacer+row;
  }
  separated=true;
 }
 if(content)output.push({content});
 return output;
}
function buildBattleStatusText(options){
 const effects=descriptors(options.state,options.visible,options.list).map(e=>e.effectId?e:Profile.activeEffect(e,options.state)||e);
 const groups=[];
 const label=e=>{
  const name=String(e.name||'').replace(/[\\*_~`<>]/g,'');
  const custom=Object.hasOwn(BATTLE_STATUS_EMOJI,e.effectId)?BATTLE_STATUS_EMOJI[e.effectId]:null;
  const icon=e.effectId==='warrior.focus'||e.name==='Focus'?'↑':custom?`<${custom.animated?'a':''}:${custom.name}:${custom.id}>`:'';
  const body=[name,e.count==null?'':'×'+e.count,e.turns==null?'':'· '+e.turns+'t'].filter(Boolean).join(' ');
  return {text:[icon,body].filter(Boolean).join(' '),width:body.length+(icon?3:0)};
 };
 for(const group of ORDER){
  const labels=effects.filter(e=>e.group===group).map(label);if(!labels.length)continue;
  const lines=[];
  for(let i=0;i<labels.length;i++){
   const a=labels[i],b=labels[i+1];
   lines.push(b&&a.width+b.width<=32?(++i,a.text+'   ·   '+b.text):a.text);
  }
  groups.push(lines);
 }
 return formatBattleStatusRows(groups);
}
module.exports={BOOSTER_ICON_FILE,buildStatusPanels,buildInlineStatusPanels,planStatusPanels,buildBattleStatusText,formatBattleStatusRows};
