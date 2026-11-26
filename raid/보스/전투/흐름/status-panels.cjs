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
  const pending=state.turn<p.startTurn,percent=Number(((p.multiplier-1)*100).toFixed(2));
  const change=Number.isFinite(percent)?'Damage taken '+(percent>=0?'+':'')+percent+'%':'More damage taken';
  result.push({name:'Contract Vulnerability',group:'debuff',bad:true,shape:'scroll',count:null,turns:p.turns,
   description:(pending?'Starts next turn · ':'')+change,contractPenaltyIcon:true});
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
const { escapeSvgText: esc } = require('../../../svg-escape.cjs');
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

const MOBILE_PAIR_WIDTH = 44;
const ROWS_PER_GROUP = 3;
const clean = value => String(value ?? '').replace(/[*_~`<>\\]/g, '').replace(/\s+/g, ' ').trim();

function compactDescription(effect, state) {
 let detail = clean(effect.description).replace(/ \(base ATK display unchanged\)/ig, '');
 const warrior = state.config?.job === 'warrior';
 if (warrior && (effect.name === 'Hone' || effect.name === 'Focus')) {
  const rules = require('../../../클래스/검사/warrior-rework.cjs');
  const [label, baseline, chance] = effect.name === 'Hone'
   ? ['Perfect Parry', rules.PERFECT_BASE, rules.perfectChance(state)]
   : ['Trance', rules.TRANCE_BASE, rules.tranceChance(state)];
  const current = Math.round(chance * 100);
  detail = detail.replace(/^(?:Perfect Parry|Blade Trance) chance \d+%/,
   label + ' ' + baseline + '%' + (current === baseline ? '' : ' → ' + current + '%'));
 }
 return detail
  .replace(/\. (\d+) turns? remaining\.?/gi, ' ($1T)')
  .replace(/ for \d+ turns?\b/gi, match => effect.turns == null ? match : '')
  .replace(/\. Thrust is unlocked; Sharp Eye and Sixth Sense stay active\.?/i, '')
  .replace(/Reapplication refreshes to (\d+) turns; does not stack\.?/i, 'Refreshes to $1T; no stacks')
  .replace(/Heal for (\d+)% of actual damage dealt/ig, 'Lifesteal $1%')
  .replace(/Maximum HP/ig, 'Max HP')
  .replace(/Take (\d+)% less direct damage/ig, 'Taken −$1% direct')
  .replace(/Critical chance/ig, 'Crit')
  .replace(/Critical damage/ig, 'Crit DMG')
  .replace(/(?:Damage taken|Damage received)/ig, 'DMG taken')
  .replace(/Damage dealt/ig, 'DMG dealt')
  .replace(/(?:Thrust|Smite) damage/ig, match => match.split(' ')[0] + ' DMG')
  .replace(/\. *$/, '');
}


const SHORT_NAMES = {
 'Server Booster':'Booster', 'Battle Rally':'Rally', 'Contract Vulnerability':'Vulnerability',
 "Devil's Contract":'Contract', 'Divine Punishment':'Punishment', 'BLADE TRANCE':'Blade Trance',
};

function activeEffects(state) {
 const visible = require('../raid-visible-effects.js');
 return descriptors(state, visible).map(effect => {
  const row = effect.name === 'Tackle Defense' && state.tackleDefenseTurns > 0
   ? {...effect, count:null, turns:state.tackleDefenseTurns}
   : effect;
  return Profile.activeEffect(row, state) || row;
 });
}

function effectIconAndBadges(effect) {
 const visual = Profile.nativeEffectIcon(effect.iconKey || effect.effectId);
 const icon = visual.discord || (effect.group === 'buff' ? '⬆️' : '⬇️');
 const count = effect.count == null || effect.effectId === 'berserker.charge' && visual.custom ? '' : '×' + clean(effect.count);
 const turns = effect.turns == null ? '' : clean(effect.turns) + 'T';
 return {icon, badges:[count, turns].filter(Boolean).map(badge => '`' + badge + '`')};
}

function displayWidth(text) {
 return [...text.replace(/<a?:[^:>]+:\d+>/g, '◼◼').replace(/[*`\ufe0f]/g, '')].length;
}

function summaryLabel(effect, state, width) {
 const {icon,badges} = effectIconAndBadges(effect);
 const name = clean(SHORT_NAMES[effect.name] || effect.name);
 const detail = compactDescription(effect, state);
 const parts = detail.split(/; | · | \/ |\. (?=[A-Z])/);
 const first = parts.find(part => /\d/.test(part)) || parts[0];
 const short = first
  .replace(/^Perfect Parry /, 'Parry ')
  .replace(/^Trance /, '')
  .replace(/^Attack /, 'ATK ')
  .replace(/^Next Basic or charged Attack: /, '')
  .replace(/^Next Attack: /, '')
  .replace(/^Direct DMG taken /, 'Taken ');
 const label = '**' + name + '**' + (short ? ' · ' + short : '');
 // The first numeric detail stays with the effect name. Badges are optional
 // when the row is tight; the full details retain their duration information.
 for(const extras of [badges, badges.slice(-1), []]){
  const candidate = [icon, ...extras, label].join(' ');
  if(displayWidth(candidate) <= width)return candidate;
 }
 return null;
}

function planRows(effects, state, title, reserveOverflow) {
 const rows = Array.from({length:ROWS_PER_GROUP},()=>[]);
 let from = 0, shown = 0;
 for (const effect of effects) {
  for(let i=from;i<rows.length;i++){
   const row=rows[i];
   if(row.length===2)continue;
   const occupied=row.length ? displayWidth(row.join(' / ')+' / ') : 0;
   const titleWidth=i===0 ? title.length+2 : 0;
   const overflowWidth=reserveOverflow&&i===rows.length-1 ? 7 : 0;
   const label=summaryLabel(effect,state,MOBILE_PAIR_WIDTH-occupied-titleWidth-overflowWidth);
   if(!label)continue;
   row.push(label);
   shown++;
   // Keep one effect per row when three effects can use the three rows.
   from=effects.length<=ROWS_PER_GROUP?i+1:i;
   break;
  }
 }
 return {rows,shown};
}

function statusRows(effects, state, title) {
 if(!effects.length)return ['None','–','–'];
 let plan=planRows(effects,state,title,false);
 if(plan.shown<effects.length)plan=planRows(effects,state,title,true);
 const hidden=effects.length-plan.shown;
 const rows=plan.rows.map(labels=>labels.join(' / '));
 if(hidden)rows[2]+=(rows[2]?' · ':'')+'**+'+hidden+'**';
 return rows.map(row=>row||'–');
}

function buildBattleStatusPanel(state) {
 const effects = activeEffects(state);
 const lines = ORDER.flatMap(group => {
  const title=group==='buff'?'BUFFS':'DEBUFFS';
  const [first,...rest]=statusRows(effects.filter(effect=>effect.group===group),state,title);
  return ['**'+title+'**　'+first,...rest];
 });
 return {type:17,components:[{type:10,content:lines.join('\n')}]};
}

module.exports={BOOSTER_ICON_FILE,buildStatusPanels,planStatusPanels,buildBattleStatusPanel};
