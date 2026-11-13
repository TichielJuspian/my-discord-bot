'use strict';
const stages=require('./raid-engine/enrage-stages.cjs');
// The large scene shows the resolved LAST TURN. NEXT ACTION is text-only intent.
function art(s,resultOnly=false){
 if(s.bossHP<=0)return ['boss-defeated-v5-discord.jpg','BOSS DEFEATED'];
 if(s.hp<=0)return ['boss-victory-original-v5-discord.jpg','CHALLENGER EXHAUSTED'];
 const l=(s.log||[]).filter(x=>!x.offerCinematic).at(-1);
 const level=l?.bossEnrageLevel??(l?.enrageTransition?Math.max(0,l.enrageTransition-1):stages.level(s));
 const rage=level>0,idle=rage?'boss-enraged.jpg':'boss-panel.jpg';
 const stagger=rage?'boss-enraged-staggered-v7-discord.jpg':'boss-staggered-v7-discord.jpg';
 const prefix=rage?'boss-v3-enraged-':'boss-v3-';
 if(!l)return [idle,'BATTLE READY'];
 if(l.ultimate&&s.config.job==='berserker')return ['ragnarok-colossus-impact-v2.jpg','LAST TURN / RAGNAROK / DIRECT HIT'];
 if(l.ultimate)return [s.config.job==='paladin'?'boss-judgment.jpg':'boss-ultimate.jpg','LAST TURN / ULTIMATE'];
 if(l.curseInterruptedNow||l.shockwaveInterrupted)return [stagger,'LAST TURN / INTERRUPTED'];
 if(l.groggy||l.phase==='opening')return [l.groggyRemaining===1?'boss-groggy-final-closeup.jpg':stagger,'LAST TURN / GROGGY / NO ATTACK'];
 if(l.phase==='enrage')return [level>=3?'colossus-enrage-maximum-v38.jpg':level===2?'colossus-enrage-lv2-v39.jpg':'boss-enraged.jpg','ENRAGED LV '+level+' / NO ATTACK'];
 if(l.phase==='recovery'&&l.patternKind==='S')return ['boss-enraged.jpg','LAST TURN / RECOVERY / NO ATTACK / NORMAL DAMAGE RECEIVED'];
 if(l.phase==='rampage')return ['colossus-rampage-prepare.jpg','LAST TURN / FURY / NO ATTACK'];
 if(l.phase==='warning')return [rage?'boss-enraged-charging.jpg':'boss-charging.jpg','LAST TURN / PREPARATION / NO ATTACK'];
 if(l.phase==='heavy')return [l.rampageStrike===2?'colossus-side-swing.jpg':rage?'boss-enraged-heavy-v10.jpg':'boss-heavy-v10.jpg','LAST TURN / '+(l.rampageStrike>0?'RAMPAGE '+l.rampageStrike+'/3 / ':'')+(l.rampageStrike===2?'ARM SWEEP':'DOWNWARD SLAM')];
 if(l.phase==='normal'||l.phase==='flurry')return [l.hand==='left'?(rage?'boss-enraged-left-punch-v8.jpg':'boss-left-punch-v8.jpg'):(rage?'boss-v3-enraged-normal.jpg':'boss-heavy.jpg'),'LAST TURN / '+(l.hand||'right').toUpperCase()+' FIST'];
 if(l.phase==='struggle_end')return [rage?'boss-enraged-shockwave-v6-discord.jpg':'boss-normal-shockwave-v6-discord.jpg','LAST TURN / SHOCKWAVE RELEASED'];
 if(l.phase==='struggle_start')return [prefix+'clash.jpg','LAST TURN / SHOCKWAVE CHARGING'];
 if(l.phase==='struggle')return [rage?'boss-enraged-special-charge-2.jpg':'boss-special-charge-2.jpg','LAST TURN / SHOCKWAVE CHARGING'];
 if(l.phase==='mark')return [prefix+'mark.jpg','LAST TURN / CURSE RELEASED'];
 if(l.phase==='mark_warning')return [prefix+'mark_warning.jpg','LAST TURN / CURSE FORMING'];
 return [idle,'LAST TURN / RECOVERY / NO ATTACK'];
}
module.exports={art};

