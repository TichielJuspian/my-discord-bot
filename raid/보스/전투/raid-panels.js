const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
const stages=require('./엔진/enrage-stages.cjs');
const path=require('node:path'),R=require('./엔진/progression-combat.cjs'),registry=require('./raid-boss-registry.js');
const text=content=>({type:10,content}),row=components=>({type:1,components});
const gallery=(file,description)=>({type:12,items:[{media:{url:'attachment://'+file},description}]});
const ASSETS=['warrior.jpg'];
function requestedBossArt(s,resultOnly=false){const boss=registry.get(s.config.boss);if(boss?.enabled&&boss.readyArt&&s.turn===1&&!(s.log||[]).length&&s.hp>0&&s.bossHP>0)return [boss.readyArt.file,boss.readyArt.description];if(boss?.enabled&&boss.artModule)return require(runtimePaths.resolve(runtimePaths.root,boss.artModule)).art(s,resultOnly);if(s.berserkerGroggy>0&&s.hp>0&&s.bossHP>0)return [s.config.boss==='nameless_succubus'?'succubus-art-20261113/Normal/11 Stagger_A.jpg':stages.level(s)>0?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg','GROGGY / '+s.berserkerGroggy+' TURNS LEFT'];
 const recovered=require('./raid-boss-recovery.js').art(s,resultOnly);if(recovered)return recovered;
 if(require('../서큐버스/raid-succubus.js').active(s))return require('../서큐버스/raid-succubus.js').art(s,resultOnly);
 if(!s.log.length)return ['boss-panel.jpg','BATTLE READY / Earth Colossus awaits the challenger'];
 if(s.bossHP<=0)return ['boss-defeated-v5-discord.jpg','BOSS DEFEATED'];
 if(s.hp<=0)return ['boss-victory-original-v5-discord.jpg','The Colossus laughs / Challenger exhausted'];
 const last=s.log.at(-1),ph=last?.phase,rage=stages.level(s)>0;
 if(!resultOnly&&R.phase(s)==='warning'&&rage)return ['colossus-rampage-prepare.jpg','WARNING / The Colossus prepares a devastating assault.'];
 if(resultOnly&&ph==='warning'&&rage&&!last.ultimate)return ['colossus-rampage-prepare.jpg','PREPARATION / NO BOSS ATTACK'];
 if(last?.ultimate)return s.config.job==='paladin'?['boss-judgment.jpg','JUDGMENT / DIRECT HIT']:['boss-ultimate.jpg','RESONANT WAVE SLASH / DIRECT HIT'];
 if(ph==='mark'&&!last.curseInterruptedNow)return [(rage?'boss-v3-enraged-':'boss-v3-')+'mark.jpg',last.emergencyEvaded?'LAST TURN / CURSE EVADED':'LAST TURN / CURSE RELEASED'];
 if(ph==='heavy'&&(resultOnly||R.phase(s)==='recovery'))return [last.rampageStrike===2?'boss-enraged-left-punch-v8.jpg':rage?'boss-enraged-heavy-v10.jpg':'boss-heavy-v10.jpg','LAST TURN / '+(last.rampageStrike===2?'ARM SWEEP':'CRUSHING BLOW')];
 if((ph==='struggle_end'||(ph?.startsWith('struggle')&&last.emergencyEvaded))&&!last.shockwaveInterrupted&&(last.struggleSkills||0)<2)return [rage?'boss-enraged-shockwave-v6-discord.jpg':'boss-normal-shockwave-v6-discord.jpg','LAST TURN / SHOCKWAVE RELEASED'];
 if(resultOnly&&last?.phase==='enrage')return ['boss-enraged.jpg','TRANSFORMATION COMPLETE / NO BOSS ATTACK LAST TURN'];
 if(require('./raid-groggy-final.js').active(s,resultOnly))return ['boss-groggy-final-closeup.jpg','GROGGY / 1 TURN LEFT'];
 if(last?.curseInterruptedNow||last?.shockwaveInterrupted||(resultOnly&&ph==='opening')||ph==='struggle_end'&&(last.struggleSkills||0)>=2)return [rage?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg',last?.curseInterruptedNow?'CAST INTERRUPTED / BOSS STAGGERED':'BOSS STAGGERED'];
   const next=R.phase(s);
 // The interactive screen shows the committed NEXT action. Previous outcomes
 // only select boss art in the brief, non-interactive result screen.
 if(!resultOnly){
  if(next==='enrage')return ['boss-enraged.jpg','ENRAGE / The Colossus awakens'];
  if(next==='heavy'&&s.director?.rampageStrike===2)return ['boss-enraged-left-punch-v8.jpg','NEXT ATTACK / RAMPAGE 2 OF 3 / ARM SWEEP'];
  if(['warning','heavy'].includes(next))return [rage?'boss-enraged-charging.jpg':'boss-charging.jpg','NEXT ATTACK / Both fists raised'];
  if(['mark_warning','mark'].includes(next))return [(rage?'boss-v3-enraged-':'boss-v3-')+'mark_warning.jpg','NEXT ACTION / Curse gathers'];
  if(next.startsWith('struggle'))return [next==='struggle_start'?(rage?'boss-v3-enraged-clash.jpg':'boss-v3-clash.jpg'):(rage?'boss-enraged-special-charge-2.jpg':'boss-special-charge-2.jpg'),'NEXT ACTION / Shockwave gathers'];
  if(next==='opening')return [rage?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg','NEXT ACTION / Staggered'];
  if(next==='normal')return [s.director?.hand==='left'?(rage?'boss-enraged-left-punch-v8.jpg':'boss-left-punch-v8.jpg'):(rage?'boss-v3-enraged-normal.jpg':'boss-heavy.jpg'),'NEXT ATTACK / '+(s.director?.hand||'right').toUpperCase()+' FIST'];
  return [rage?'boss-enraged.jpg':'boss-panel.jpg','NEXT ACTION / '+next.toUpperCase()];
 }
 if(ph==='enrage')return ['boss-enraged.jpg','ENRAGE / The Colossus awakens'];

 const prefix=rage?'boss-v3-enraged-':'boss-v3-';
 if(last?.curseInterruptedNow)return [rage?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg','CAST INTERRUPTED / BOSS STAGGERED'];
 if(ph==='struggle_end'&&(last.mechanicDamage>0||last.emergencyEvaded))return [rage?'boss-enraged-shockwave-v6-discord.jpg':'boss-normal-shockwave-v6-discord.jpg','SHOCKWAVE RELEASED'];
 if(last?.shockwaveInterrupted||ph==='opening'||ph==='struggle_end'&&(last.struggleSkills||0)>=2)return [rage?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg','SHOCKWAVE INTERRUPTED / BOSS STAGGERED'];
 if(ph==='normal'&&last.hand==='left')return [rage?'boss-enraged-left-punch-v8.jpg':'boss-left-punch-v8.jpg','LEFT FIST STRIKE'];
 if(ph==='mark'&&!last.curseInterruptedNow)return [(rage?'boss-v3-enraged-':'boss-v3-')+'mark.jpg',last.emergencyEvaded?'LAST TURN / CURSE EVADED':'LAST TURN / CURSE RELEASED'];
 if(ph==='heavy')return [rage?'boss-enraged-heavy-v10.jpg':'boss-heavy-v10.jpg','TWO-HANDED CRUSHING BLOW'];
 if(!last?.curseInterruptedNow&&['mark_warning','mark'].includes(ph))return [prefix+ph+'.jpg','LAST ACTION / Curse'];
 if(ph?.startsWith('struggle'))return [prefix+'clash.jpg','LAST ACTION / Shockwave'];
 if(['normal','flurry','heavy'].includes(ph))return [rage?'boss-v3-enraged-normal.jpg':'boss-heavy.jpg','LAST ACTION / Boss strike'];
 if(ph==='warning')return [rage?'boss-enraged-charging.jpg':'boss-charging.jpg','LAST ACTION / Charging'];
 return [rage?'boss-enraged.jpg':'boss-panel.jpg',rage?'Enraged Colossus':'Colossus'];
}
const missingArt=new Set();
function bossArt(s,resultOnly=false){const desired=requestedBossArt(s,resultOnly);if(require('node:fs').existsSync(runtimePaths.join(runtimePaths.directory("."),desired[0])))return desired;
 if(!missingArt.has(desired[0])){missingArt.add(desired[0]);console.warn('[RAID ART FALLBACK]',desired[0]);}
 return [stages.level(s)>0&&require('node:fs').existsSync(runtimePaths.join(runtimePaths.directory("."),'boss-enraged.jpg'))?'boss-enraged.jpg':'boss-panel.jpg',desired[1]];
}
function mechanicStatus(s){
 const ph=R.phase(s);if(!ph.startsWith('struggle'))return '';
 const dealt=ph==='struggle_start'?0:s.struggleSkills||0;
 return '**SHOCKWAVE / '+dealt+' / 2 attack skills**\n'+bar(dealt,2,'yellow')+'\n'+require('./엔진/mechanic-rules.cjs').remaining(s)+' actions left. Fail: '+require('./엔진/mechanic-rules.cjs').failureLabel(s)+'.';
}
function bossStatus(s){const labels=[];if(stages.level(s)>0)labels.push(stages.label(s));if(R.phase(s)==='opening')labels.push('EXPOSED');return labels.join(' / ')||'Normal';}
function combatResult(l,s){
 if(!l)return null;
 const lines=require('./raid-combat-copy.js')(l,s);
 const hasIcon=l.damage>0||l.counterDamage>0||['success','perfect'].includes(l.parryResult);
 return {type:17,accent_color:l.parryResult==='perfect'?0x55cfff:l.mechanicDamage?0xe94336:0xffbd45,components:[hasIcon?{type:9,components:[text(lines.join('\n'))],accessory:{type:11,media:{url:'attachment://battle-impact.png'},description:require('./raid-impact-icon.js').kind(l)+' effect'}}:text(lines.join('\n'))]};
}
function bar(v,m,color='red'){const n=v>0?Math.max(1,Math.min(10,Math.round(v/Math.max(1,m)*10))):0;return (color==='red'?'🟥':color==='green'?'🟩':'🟨').repeat(n)+'⬛'.repeat(10-n);}
function display(a,p,boss,phase,initial){
 const s=a.state,paladin=s.config.job==='paladin',ended=s.status!=='active';

 if(a.view==='effects')return require('./raid-compact-effects.js').payload(a);
 if(require('./엔진/devil-offer.cjs').pending(s))return require('./raid-devil-offer-view.js').payload(a);
 if(a.view==='skills')return require('../../클래스/raid-skill-guide.js').payload(a);
 const availableActions=R.actions(s);
 const btn=(action,label,style=2)=>({type:2,style,label,custom_id:'raidtest:'+a.id+':'+s.turn+':'+action,disabled:!!a.cutsceneResult||!!a.motionStage||!['skills','effects','menu','battle','motion','retreat'].includes(action)&&!action.startsWith('inspect_')&&!availableActions.includes(action)});
 const card=require('../../클래스/raid-card-motion.js').asset(a),battleFeed=require('./raid-battle-feed.js');
 const visible=require('./raid-visible-effects.js'),art=bossArt(s,!!a.cutsceneResult)[0];
 const source=runtimePaths.join(runtimePaths.directory('.'),art);
 const bossMedia=require('./raid-boss-art-v34.cjs').asset(require('node:fs').readFileSync(source),source,boss);
 const statuses=require('./흐름/status-panels.cjs').buildInlineStatusPanels({state:s,visible,wrap:battleFeed.wrap,raster:require('./raid-metal-assets.js').raster});
 const profile=gallery(card.name,'Level '+s.config.level+' '+s.config.job+' / HP '+s.hp+' / '+s.stats.hp+' / Energy '+s.energy+' / '+s.maxEnergy);
 let actions=[];if(ended)actions=[row([btn('retreat','End battle',4)])];else if(s.config.job==='berserker')actions=require('../../클래스/광전사/berserker-ui.cjs').buttons(s,btn);else{actions=[row([btn('attack','Attack'),btn(paladin?'guard':'parry',paladin?'Phys. Guard':'Phys. Parry'),btn(paladin?'smash':'thrust',paladin?(require('../../클래스/성기사/paladin-rules.cjs').evolved(s)?'Divine Smash':'Smash')+' · -1E':((s.thrustCasts||0)>=require('../../클래스/검사/warrior-rules.cjs').threshold(s)?'Deep Thrust':'Thrust')+' · -'+R.resourceCost('thrust',s)+'E',1),btn(paladin?'prayer':'slash',paladin?'Blessing · -2E':'Slash · -1E',1)])];const specials=[],ultLeft=Math.max(0,(s.config.level>=90?2:1)-(s.ultimateUses??Number(!!s.ultimateUsed))),evadeLeft=Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses??Number(!!s.emergencyUsed)));if(s.config.level>=10)specials.push(btn('resonant_wave',ultLeft?(paladin?'Judgment':'Resonant Wave Slash')+' · '+ultLeft+' left':'Ultimate Used',3));specials.push(btn('emergency_evade',evadeLeft?'Evade · '+evadeLeft+' left':'Evade Used',3));if(availableActions.includes('purification'))specials.push(btn('purification','Purification · -3E',1));if(availableActions.includes('cleanse'))specials.push(btn('cleanse','Lift curse',3));specials.push(btn('menu','Menu'));actions.push(row(specials));}
 if(a.view==='menu'&&!ended){for(const row of actions)for(const b of row.components)if(b.custom_id.endsWith(':menu')){b.custom_id=b.custom_id.replace(/:menu$/,':battle');b.label='Close Menu';}actions.push(row([btn('skills','Skill guide'),btn('retreat','End battle',4)]));}
 actions.forEach(require('./raid-button-icons.js').decorate);
 const components=[gallery(bossMedia.name,boss),profile,...actions],files=[bossMedia,card];
 for(const item of statuses){if(item.content)components.push(text(item.content));else{components.push(gallery(item.name,item.description));files.push(item);}}
 const gauge=R.phase(s).startsWith("struggle")?{hits:s.struggleSkills||0,required:2}:null;
 const presentation=require("./흐름/raid-two-piece-model.cjs");
 const overlay=presentation.forLegacy(a,R.phase(s));
 if(gauge)overlay.break=gauge;
 return {flags:32768,attachments:[],components,files,allowedMentions:{parse:[]},twoPiece:presentation.twoPieceDescriptor(bossMedia,card,overlay)};
}
module.exports={requestedBossArt,display,bar,bossArt,combatResult,ASSETS,mechanicStatus,bossStatus};




