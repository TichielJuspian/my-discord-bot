'use strict';
const P=require('./pattern-profiles.cjs'),stages=require('./enrage-stages.cjs');
const {roll,pick}=require('./common-pattern-director.cjs');
// Colossus sequences use existing phases and artwork. Succubus stays independent.
function clearPattern(s){const d=s.director;d.queue=[];d.hand=null;d.comboIndex=0;d.rampageStrike=0;d.rampageActive=false;d.gimmickRecoveryPending=false;d.guaranteedSpecialPending=false;s.struggleSkills=0;s.struggleDamage=0;}
function complete(s,key){s.director.patternReadyAt[key]=P.combatCount(s)+P.cooldown(s,key);}
function eligible(s){P.ensure(s);const now=P.combatCount(s);return P.ORDER.map((key,i)=>({key,weight:P.weights(s)[i]})).filter(x=>x.weight>0&&now>=(s.director.patternReadyAt[x.key]||0));}
function startSpecial(s,guaranteed=false){clearPattern(s);const d=s.director;Object.assign(d,{patternKind:'S',phase:'rampage',queue:['warning','heavy','heavy','heavy','recovery'],rampageActive:true,specialGuaranteed:guaranteed});}
function select(s){const key=pick(eligible(s),roll(s.director));clearPattern(s);const d=s.director;d.patternKind=key;
 if(key==='N'){d.phase='normal';d.hand='left';d.comboIndex=1;return;}
 if(key==='H'){d.phase='warning';d.queue=['heavy'];return;}
 if(key==='C'){d.phase='mark_warning';d.queue=['mark'];return;}
 if(key==='S'){startSpecial(s);return;}
 d.phase='struggle_start';d.queue=['struggle','struggle_end'];d.specialFailureDamage=require('./mechanic-rules.cjs').failureDamage(s);
}
function enterEnrage(s){P.ensure(s);clearPattern(s);const d=s.director;d.patternReadyAt={};d.heavyUntil=0;d.curseUntil=0;d.waveUntil=0;d.offerNextCombat=0;d.normalRun=0;s.berserkerGroggy=0;stages.enter(s);d.phase='enrage';d.patternKind='enrage';d.stageCombatStart=P.combatCount(s);d.stageTurnStart=s.turn+1;}
function cancelUltimate(s){clearPattern(s);if(s.berserkerGroggy>0){s.director.patternKind='opening';s.director.phase='opening';s.director.queue=Array(s.berserkerGroggy-1).fill('opening');return;}select(s);}
function advance(s,last){P.ensure(s);const d=s.director;
 // The S cooldown begins after its final idle turn (or existing ultimate cancellation).
 if(d.patternKind==='S'){
  if(last.ultimate){complete(s,'S');clearPattern(s);if(stages.due(s)){enterEnrage(s);return;}cancelUltimate(s);return;}
  if(d.queue.length){d.phase=d.queue.shift();d.hand=null;d.rampageStrike=d.phase==='heavy'?(d.rampageStrike||0)+1:0;return;}
  complete(s,'S');clearPattern(s);
  if(stages.due(s)){enterEnrage(s);return;}select(s);return;
 }
 if(d.guaranteedSpecialPending){
  if(last.ultimate&&s.berserkerGroggy>0){d.phase='opening';d.queue=Array(s.berserkerGroggy-1).fill('opening');return;}
  if(d.queue.length){d.phase=d.queue.shift();return;}
  if(s.berserkerGroggy>0){d.phase='opening';d.queue=Array(s.berserkerGroggy-1).fill('opening');return;}
  startSpecial(s,true);return;
 }
 if(last.phase==='heavy')complete(s,'H');
 if(last.phase==='mark'||last.curseInterruptedNow||(last.ultimate&&last.phase==='mark_warning'))complete(s,'C');
 if(last.phase==='struggle_end'||last.shockwaveInterrupted||(last.phase.startsWith('struggle')&&(last.struggleSkills>=2||last.ultimate)))complete(s,'G');
 if(last.phase==='recovery')d.gimmickRecoveryPending=false;
 if(last.phase==='enrage'){d.stageCombatStart=P.combatCount(s);d.stageTurnStart=s.turn;
  if(s.berserkerGroggy>0){clearPattern(s);d.patternKind='opening';d.guaranteedSpecialPending=true;d.phase='opening';d.queue=Array(s.berserkerGroggy-1).fill('opening');return;}
  startSpecial(s,true);return;}
 if(stages.due(s)){enterEnrage(s);return;}
 if(last.phase.startsWith('struggle')&&(last.ultimate||last.shockwaveInterrupted||last.struggleSkills>=2)){last.shockwaveInterrupted=true;clearPattern(s);d.patternKind='G';d.gimmickRecoveryPending=true;d.phase='opening';d.queue=['opening','recovery'];return;}
 if(last.ultimate&&(d.gimmickRecoveryPending||(last.phase==='opening'&&d.queue.includes('recovery')))){const remaining=Math.max(d.queue.filter(x=>x==='opening').length,s.berserkerGroggy||0);clearPattern(s);d.patternKind='G';d.gimmickRecoveryPending=true;d.phase=remaining?'opening':'recovery';d.queue=remaining?[...Array(remaining-1).fill('opening'),'recovery']:[];return;}
 if(last.ultimate){cancelUltimate(s);return;}
 if(last.curseInterruptedNow){clearPattern(s);select(s);return;}
 if(d.queue.length){d.phase=d.queue.shift();d.hand=null;return;}
 if(last.phase==='normal'&&(d.comboIndex||1)<P.get(s).comboMax&&P.canContinue(P.get(s),d.comboIndex||1,roll(d))){d.comboIndex=(d.comboIndex||1)+1;d.phase='normal';d.hand='right';return;}
 select(s);
}
module.exports={roll,pick,eligible,select,startSpecial,enterEnrage,advance,complete};
