"use strict";
const P=require('./pattern-profiles.cjs'),stages=require('./enrage-stages.cjs');
// Owner-approved ordering: finish a shown contract, replace buffs at its result.
const POLICY=Object.freeze({activeOfferAtStageGuarantee:'replace_on_result',crossedStageBeforeGuarantee:'guaranteed_offer_before_next_stage',displayedOffer:'finish_offer_next',maximumClock:'displayed_turns'});
function roll(d){let x=d.rng;x^=x<<13;x^=x>>>17;x^=x<<5;d.rng=x>>>0;return d.rng/4294967296;}
function clearPattern(s){const d=s.director;d.queue=[];d.hand=null;d.comboIndex=0;d.rampageStrike=0;d.rampageActive=false;d.gimmickRecoveryPending=false;s.struggleSkills=0;s.struggleDamage=0;}
function complete(s,key){s.director.patternReadyAt[key]=P.combatCount(s)+P.cooldown(s,key);}
function eligible(s){P.ensure(s);const d=s.director,now=P.combatCount(s);return P.ORDER.map((key,i)=>({key,weight:P.weights(s)[i]})).filter(x=>x.weight>0&&now>=(d.patternReadyAt[x.key]||0)&&(x.key!=='S'||(!require('./devil-offer.cjs').effects(s)&&!require('./devil-offer.cjs').pending(s))));}
function pick(pool,unit){if(!(unit>=0&&unit<1)||!pool.length)throw Error('Invalid pattern selection');let n=unit*pool.reduce((a,x)=>a+x.weight,0);for(const entry of pool){n-=entry.weight;if(n<0)return entry.key;}return pool.at(-1).key;}
function startOffer(s,guaranteed){if(require('./devil-offer.cjs').pending(s))return false;clearPattern(s);require('./devil-offer.cjs').begin(s,guaranteed);}
function select(s){if(require('./devil-offer.cjs').pending(s))return false;const d=s.director,key=pick(eligible(s),roll(d));clearPattern(s);d.patternKind=key;
 if(key==='S'){startOffer(s,false);return;}
 if(key==='N'){d.phase='normal';d.hand='left';d.comboIndex=1;return;}
 if(key==='H'){d.phase='heavy';return;}
 if(key==='C'){d.phase='mark_warning';d.queue=['mark'];return;}
 d.phase='struggle_start';d.queue=['struggle_end'];d.specialFailureDamage=require('./mechanic-rules.cjs').failureDamage(s);
}
function enterEnrage(s){if(require('./devil-offer.cjs').pending(s))return false;P.ensure(s);clearPattern(s);s.director.patternReadyAt={};s.berserkerGroggy=0;stages.enter(s);require('./devil-offer.cjs').onStageEnter(s);s.director.phase='enrage';s.director.patternKind='enrage';s.director.stageCombatStart=P.combatCount(s);s.director.stageTurnStart=s.turn+1;}
function bookkeeping(s,last){if(last.phase==='heavy')complete(s,'H');
 if(last.phase==='mark'||last.curseInterruptedNow||(last.ultimate&&['mark_warning','mark_prepare'].includes(last.phase)))complete(s,'C');
 if(last.phase==='struggle_end'||last.shockwaveInterrupted||(last.phase.startsWith('struggle')&&(last.struggleSkills>=2||last.ultimate)))complete(s,'G');}
function advance(s,last){if(require('./devil-offer.cjs').pending(s))return false;P.ensure(s);const d=s.director;bookkeeping(s,last);
 if(last.phase==='recovery')d.gimmickRecoveryPending=false;
 // Every completed transformation shows its guaranteed contract before another stage.
 if(last.phase==='enrage'){d.stageCombatStart=P.combatCount(s);d.stageTurnStart=s.turn;startOffer(s,true);return;}
 if(stages.due(s)){enterEnrage(s);return;}
 // A cancelled G has its own recovery sequence, including ultimate cancellations.
 if(last.phase.startsWith('struggle')&&(last.ultimate||last.shockwaveInterrupted||last.struggleSkills>=2)){
  last.shockwaveInterrupted=true;clearPattern(s);d.gimmickRecoveryPending=true;d.phase='opening';d.queue=['opening','recovery'];return;
 }
 // Ultimates during G openings preserve the uncompleted G recovery.
 // A class ultimate may refresh groggy; overlap uses max remaining, not a sum.
 if(last.ultimate&&(d.gimmickRecoveryPending||(last.phase==='opening'&&d.queue.includes('recovery')))){
  const remaining=Math.max(d.queue.filter(x=>x==='opening').length,s.berserkerGroggy||0);clearPattern(s);d.gimmickRecoveryPending=true;
  d.phase=remaining>0?'opening':'recovery';d.queue=remaining>0?[...Array(remaining-1).fill('opening'),'recovery']:[];return;
 }
 if(last.ultimate){clearPattern(s);if(s.berserkerGroggy>0){d.phase='opening';d.queue=Array(s.berserkerGroggy-1).fill('opening');return;}select(s);return;}
 if(last.curseInterruptedNow){clearPattern(s);select(s);return;}
 if(d.queue.length){d.phase=d.queue.shift();d.hand=null;return;}
 if(last.phase==='normal'){
  d.lastHand=last.hand;
  if((d.comboIndex||1)<P.get(s).comboMax&&P.canContinue(P.get(s),d.comboIndex||1,roll(d))){d.comboIndex=(d.comboIndex||1)+1;d.phase='normal';d.hand=d.comboIndex===3?'wing':d.comboIndex===2?'right':'left';return;}
 }
 select(s);
}
function afterOffer(s){if(require('./devil-offer.cjs').pending(s))return false;P.ensure(s);complete(s,'S');clearPattern(s);if(stages.due(s)){enterEnrage(s);return;}
 // An ultimate used on the transformation turn keeps its class groggy effect.
 // Contract scenes consume no combat actions, so advertise those remaining openings.
 if(s.berserkerGroggy>0){s.director.phase='opening';s.director.queue=Array(s.berserkerGroggy-1).fill('opening');return;}select(s);}
module.exports={POLICY,roll,eligible,pick,select,advance,afterOffer,enterEnrage,complete};
