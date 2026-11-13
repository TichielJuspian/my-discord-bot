"use strict";
// Frequency and sequencing only. No HP, damage, class, or outcome balance.
const ORDER=Object.freeze(['N','H','C','G','S']);
const SUCCUBUS=Object.freeze({id:'succubus-common-v1',version:1,comboChance:.6,comboMax:2,
 weights:Object.freeze([[24,34.5,21,20.5,0],[15,22,43,8,12],[6,47,33,4,10],[4,29,20,0,47]].map(Object.freeze)),
 cooldowns:Object.freeze([{H:1,C:3,G:5,S:5},{H:1,C:3,G:5,S:5},{H:1,C:3,G:5,S:5},{H:0,C:1,G:5,S:5}].map(Object.freeze))});
const ENRAGED_SUCCUBUS=Object.freeze({...SUCCUBUS,comboMax:3});
const COLOSSUS=Object.freeze({id:'colossus-common-v1',version:1,comboChance:.6,comboMax:2,sharedComboCap:3,
 // Only existing left/right single strikes are available. Never repurpose flurry.
 weights:Object.freeze([[24,34.5,21,20.5,0],[15,22,43,8,12],[6,47,23,4,20],[4,29,20,0,47]].map(Object.freeze)),
 cooldowns:SUCCUBUS.cooldowns});
const active=s=>['nameless_succubus','earth'].includes(s.config?.boss)&&!!s.director;
const get=s=>active(s)?(s.config.boss==='earth'?COLOSSUS:(s.director.enrageLevel||0)>0?ENRAGED_SUCCUBUS:SUCCUBUS):null;
const combatLogs=s=>(s.log||[]).filter(l=>!l.offerCinematic&&l.action!=='retreat');
function combatCount(s){return Number.isSafeInteger(s.director?.combatActions)?s.director.combatActions:combatLogs(s).length;}
function stageStartCount(s){const logs=combatLogs(s);for(let i=logs.length-1;i>=0;i--)if(logs[i].phase==='enrage'&&logs[i].bossEnrageLevel===2)return i+1;
 return logs.length?logs.filter(l=>l.turn<=s.director.stageStart).length:combatCount(s);}
function stageStartTurn(s){const logs=s.log||[];for(let i=logs.length-1;i>=0;i--)if(logs[i].phase==='enrage'&&logs[i].bossEnrageLevel===2)return logs[i].turn+1;return Number.isSafeInteger(s.director?.stageStart)?s.director.stageStart+1:s.turn;}
function ensure(s){if(!active(s))return s;const d=s.director;
 d.combatActions=combatCount(s);d.patternProfile=get(s).id;d.patternVersion=1;
 if(!d.patternReadyAt){const now=d.combatActions;d.patternReadyAt={};for(const [key,old]of Object.entries({H:'heavyUntil',C:'curseUntil',G:'waveUntil'}))if(d[old]>s.turn)d.patternReadyAt[key]=now+d[old]-s.turn;
  if(s.offer?.screen==='active')d.patternReadyAt.S=now+Math.max(0,5-((d.offerCombat||0)-(d.offerNextCombat||0)+8));}
 if(!Number.isInteger(d.comboIndex))d.comboIndex=d.phase==='normal'&&d.hand==='wing'?3:d.phase==='normal'&&d.hand==='right'?2:1;
 if(d.enrageLevel===2&&!Number.isSafeInteger(d.stageCombatStart))d.stageCombatStart=stageStartCount(s);
 if(d.enrageLevel===2&&!Number.isSafeInteger(d.stageTurnStart))d.stageTurnStart=stageStartTurn(s);
 return s;}
function init(s){ensure(s);Object.assign(s.director,{combatActions:0,stageCombatStart:0,stageTurnStart:0,patternReadyAt:{},comboIndex:1,phase:'normal',hand:'left',queue:[]});return s;}
function recordCombat(before,next){if(active(next)){ensure(next);next.director.combatActions=combatCount(before)+1;}}
function weights(s){return get(s).weights[s.director.enrageLevel||0];}
function cooldown(s,key){return get(s).cooldowns[s.director.enrageLevel||0][key]||0;}
function canContinue(profile,index,unit){return index<profile.comboMax&&unit<profile.comboChance;}
module.exports={ORDER,SUCCUBUS,COLOSSUS,active,get,combatLogs,combatCount,stageStartTurn,ensure,init,recordCombat,weights,cooldown,canContinue};
