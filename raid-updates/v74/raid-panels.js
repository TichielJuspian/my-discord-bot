'use strict';
const stages=require('./raid-engine/enrage-stages.cjs');
const path=require('node:path'),R=require('./raid-engine/progression-combat.cjs');
const text=content=>({type:10,content}),row=components=>({type:1,components});
const gallery=(file,description)=>({type:12,items:[{media:{url:'attachment://'+file},description}]});
const ASSETS=['warrior.jpg','inventory-empty.png','warrior-skills.png'];
function requestedBossArt(s,resultOnly=false){if(s.config.boss==='earth'&&s.turn===1&&!(s.log||[]).length&&s.hp>0&&s.bossHP>0)return ['colossus-ready-v55.jpg','BATTLE READY / Earth Colossus awaits the challenger'];if(s.config.boss==='nameless_succubus')return require('./raid-succubus').art(s,resultOnly);if(s.config.boss==='earth')return require('./raid-colossus-art').art(s,resultOnly);if(s.berserkerGroggy>0&&s.hp>0&&s.bossHP>0)return [s.config.boss==='nameless_succubus'?'succubus-groggy-two-v2.jpg':stages.level(s)>0?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg','GROGGY / '+s.berserkerGroggy+' TURNS LEFT'];
 const recovered=require('./raid-boss-recovery').art(s,resultOnly);if(recovered)return recovered;
 if(require('./raid-succubus').active(s))return require('./raid-succubus').art(s,resultOnly);
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
 if(require('./raid-groggy-final').active(s,resultOnly))return ['boss-groggy-final-closeup.jpg','GROGGY / 1 TURN LEFT'];
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
function bossArt(s,resultOnly=false){const desired=requestedBossArt(s,resultOnly);if(require('node:fs').existsSync(path.join(__dirname,desired[0])))return desired;
 if(!missingArt.has(desired[0])){missingArt.add(desired[0]);console.warn('[RAID ART FALLBACK]',desired[0]);}
 return [stages.level(s)>0&&require('node:fs').existsSync(path.join(__dirname,'boss-enraged.jpg'))?'boss-enraged.jpg':'boss-panel.jpg',desired[1]];
}
function mechanicStatus(s){
 const ph=R.phase(s);if(!ph.startsWith('struggle'))return '';
 const dealt=ph==='struggle_start'?0:s.struggleSkills||0;
 return '**SHOCKWAVE / '+dealt+' / 2 attack skills**\n'+bar(dealt,2,'yellow')+'\n'+require('./raid-engine/mechanic-rules.cjs').remaining(s)+' actions left. Fail: '+require('./raid-engine/mechanic-rules.cjs').failureLabel(s)+'.';
}
function bossStatus(s){const labels=[];if(stages.level(s)>0)labels.push(stages.label(s));if(R.phase(s)==='opening')labels.push('EXPOSED');return labels.join(' / ')||'Normal';}
function combatResult(l,s){
 if(!l)return null;
 const lines=require('./raid-combat-copy')(l,s);
 const hasIcon=l.damage>0||l.counterDamage>0||['success','perfect'].includes(l.parryResult);
 return {type:17,accent_color:l.parryResult==='perfect'?0x55cfff:l.mechanicDamage?0xe94336:0xffbd45,components:[hasIcon?{type:9,components:[text(lines.join('\n'))],accessory:{type:11,media:{url:'attachment://battle-impact.png'},description:require('./raid-impact-icon').kind(l)+' effect'}}:text(lines.join('\n'))]};
}
function bar(v,m,color='red'){const n=v>0?Math.max(1,Math.min(10,Math.round(v/Math.max(1,m)*10))):0;return (color==='red'?'🟥':color==='green'?'🟩':'🟨').repeat(n)+'⬛'.repeat(10-n);}
function display(a,p,boss,phase,initial){
 const s=a.state,paladin=s.config.job==='paladin',ended=s.status!=='active';
 if(a.view==='skills')return require('./raid-battle-inventory').skillPayload(a);
 if(['equipment','inventory'].includes(a.view))return require('./raid-battle-inventory').payload(a);
 if(a.view==='effects')return require('./raid-compact-effects').payload(a);
 if(require('./raid-engine/devil-offer.cjs').pending(s))return require('./raid-devil-offer-view').payload(a);
 const availableActions=R.actions(s);
 const btn=(action,label,style=2)=>({type:2,style,label,custom_id:'raidtest:'+a.id+':'+s.turn+':'+action,disabled:!!a.cutsceneResult||!!a.motionStage||!['equipment','inventory','skills','effects','menu','battle','motion','retreat'].includes(action)&&!action.startsWith('inspect_')&&!availableActions.includes(action)});
 const card=require('./raid-card-motion').asset(a),feed=require('./raid-battle-feed').asset(a),bossStatus=require('./raid-metal-assets').boss(a,boss),statuses=require('./raid-visible-effects').asset(a),art=bossArt(s,!!a.cutsceneResult),bossMedia=require('./raid-boss-media').asset(art[0],'boss-current.png',art[1]);
 const profile=gallery(card.name,'Level '+s.config.level+' '+s.config.job+' / HP '+s.hp+' / '+s.stats.hp+' / Energy '+s.energy+' / '+s.maxEnergy);
 let actions=[];if(a.view==='menu')actions=[row([btn('equipment','Equipment'),btn('inventory','Inventory'),btn('skills','Skill guide'),btn('battle','Back',1)]),row([btn('retreat','End battle',4)])];
 else if(ended)actions=[row([btn('retreat','End battle',4)])];else if(s.config.job==='berserker')actions=require('./berserker-ui.cjs').buttons(s,btn);else{actions=[row([btn('attack','Attack'),btn(paladin?'guard':'parry',paladin?'Guard':'Parry'),btn(paladin?'smash':'thrust',paladin?((s.paladinBlessing||0)>=8?'Divine Smite':'Smite')+' · 1 Energy':((s.thrustCasts||0)>=require('./raid-engine/warrior-rules.cjs').threshold(s)?'Deep Thrust':'Thrust')+' / '+R.resourceCost('thrust',s)+' Energy',1),btn(paladin?'prayer':'slash',paladin?'Blessing · 2 Energy':'Slash / 1 Energy',1)])];const specials=[],ultLeft=Math.max(0,(s.config.level>=90?2:1)-(s.ultimateUses??Number(!!s.ultimateUsed))),evadeLeft=Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses??Number(!!s.emergencyUsed)));if(s.config.level>=10)specials.push(btn('resonant_wave',ultLeft?(paladin?'Judgment':'Resonant Wave Slash')+' · '+ultLeft+' left':'Ultimate Used',3));specials.push(btn('emergency_evade',evadeLeft?'Evade · '+evadeLeft+' left':'Evade Used',3));if(availableActions.includes('cleanse'))specials.push(btn('cleanse','Lift curse',3));specials.push(btn('menu','Menu'));actions.push(row(specials));}
 const components=[gallery(bossMedia.name,bossMedia.description),gallery(bossStatus.name,bossStatus.description),gallery(feed.name,feed.description),{type:17,accent_color:0xc9a967,components:[profile,...actions]}],files=[bossMedia,bossStatus,feed,card];
 if(statuses){components.push(gallery(statuses.name,statuses.description));files.push(statuses);}
 return {flags:32768,attachments:[],components,files,allowedMentions:{parse:[]}};
}
module.exports={requestedBossArt,display,bar,bossArt,combatResult,ASSETS,mechanicStatus,bossStatus};



