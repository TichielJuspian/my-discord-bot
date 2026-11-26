const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const { secondNormalHitDamage } = require('../../서큐버스/succubus-second-hit.cjs');
// Pure adapter over current v1.4 rules. Never import a character store/lobby/database.
const path=require('node:path');
const {ultimateReaction}=require('./rules.cjs');
const W=require('../../../클래스/검사/warrior-rework.cjs');
function createCombat({root=runtimePaths.join(runtimePaths.directory("raid15"),'..'),random=null,bladerPolicy=W.BALANCE_POLICY}={}) {
 const load=f=>require(runtimePaths.join(root,f));
 const Legacy=load('raid-engine/progression-combat.cjs'),Build=load('raid-test-build.js');
 const Crit=load('raid-engine/critical-rules.cjs');
 const Offer=load('raid-engine/devil-offer.cjs'),Stages=load('raid-engine/enrage-stages.cjs');
 const Profiles=load('raid-engine/pattern-profiles.cjs'),Mechanic=load('raid-engine/mechanic-rules.cjs');
 function roll(s){if(random)return random();let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
 const native=a=>a==='ultimate'?'resonant_wave':a;
 function create({level=1,enhancement=0,seed=1}={}){
  const s=Legacy.create(Build.config('warrior',level,enhancement,'nameless_succubus'),seed);
  // Reuse the actual level bonus thresholds via the old state's 3-based capacity.
  s.maxEnergy=5+(s.maxEnergy-3);s.energy=s.maxEnergy;
  s.energyRecoveryInterval=2;s.turn=0;s.phase='new';
  s.director.phase='idle';s.director.queue=[];s.director.combatActions=0;s.director.patternReadyAt={};
  s.offer=null;s.offerEffects=null;s.raidId='raid15-isolated';s.buffs=[];
  return W.normalize(s);
 }
 const cost=(s,a)=>Offer.energyCost(s,['parry','magic_parry'].includes(a)?0:a==='thrust'?W.thrustCost(s,bladerPolicy):Legacy.resourceCost(native(a),s));
 const available=(s,a)=>a==='thrust'?W.canThrust(s)&&s.energy>=cost(s,a):['parry','magic_parry'].includes(a)?true:a==='emergency_evade'?Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses??Number(!!s.emergencyUsed)))>0:s.energy>=cost(s,a)&&Legacy.actions(s).includes(native(a));
 function prepare(s){W.normalize(s);if(!s.bladerRound)W.beginRound(s);s.thrustDefense=0;s.thrustDefenseTurns=0;return s;}
 function finish(s,details={}){
  const l=s.log.at(-1);
  l.warrior={...details,deep:false,hone:W.hone(s),focus:W.focus(s),perfectChance:W.perfectChance(s),tranceChance:W.tranceChance(s),sharpEyeTurns:W.sharpEyeRemaining(s),sixthSenseTurns:W.sixthSenseRemaining(s),overheatTurns:W.tranceRemaining(s),thrustCrit:W.tranceRemaining(s)>0?W.TRANCE_CRIT_CHANCE:0,thrustCritDamage:W.focusCritDamage(s,bladerPolicy),honeReduction:W.honeReduction(s,bladerPolicy)};
  l.hp=s.hp;l.energyEnd=s.energy;
  if(s.hp<=0)s.status='defeated';else if(s.bossHP<=0)s.status='victory';
 }
 function attack(original,action,{reaction='hit',opening=false}={}){
  const s=prepare(structuredClone(original)),a=native(action);const counter=s.phase==='counter'&&['thrust','slash'].includes(action);if(counter?action==='slash'&&s.energy<1:!available(s,action))throw Error('Unavailable attack');
  const energyStart=s.energy;const charmed=(s.roundCharm||0)>0&&roll(s)<.3;
  const actual=charmed?'charmed':a;reaction=ultimateReaction(reaction,actual==='resonant_wave');const actionCost=counter&&!charmed?(action==='slash'?1:0):cost(s,actual);s.energy-=actionCost;
  const beforePassives=s.config.disableClassPassives;if(s.roundCharm>0)s.config.disableClassPassives=true;
  // The attack phase is spent even if Charm prevents the chosen action.
  if(['idle','ultimate_bonus','stagger_a','stagger_b'].includes(s.phase))W.closeThrustWindow(s);
  if(actual==='resonant_wave'){s.ultimateUses=(s.ultimateUses||0)+1;s.ultimateUsed=s.ultimateUses>=(s.config.level>=90?2:1);}
  const atk=Offer.stat(s,'attack');
   let damage=actual==='attack'?atk:actual==='slash'?atk*W.SLASH_MULTIPLIER:actual==='thrust'?W.thrust(s,atk):actual==='resonant_wave'?Math.floor(atk*6):0;
  let crit=null;
  if(damage>0){
   // v1.4 floors the attack component's flat support adjustment before criticals.
   damage+=Math.floor(atk)-atk;
   crit=Crit.roll(s.stats.crit+(W.tranceRemaining(s)>0?W.TRANCE_CRIT_CHANCE:0),(s.config.ruinPercentPerPoint||0)*s.config.ruin+(s.stats.critDamagePercent||0)+W.focusCritDamage(s,bladerPolicy),()=>roll(s));
   if(crit.critical)damage=Math.floor(damage*crit.damageMultiplier)+s.stats.critFlat;
  }
  if(opening)damage=Math.floor(damage*1.5); // Existing v1.4 opening multiplier.
  const offer=Offer.effects(s);if(offer)damage=Math.floor(damage*(1+(offer.outgoing||0)));
  damage=Math.floor(damage*(1+(s.stats.damagePercent||0)/100));
  damage=reaction==='evade'?0:reaction==='guard'?Math.floor(damage*.7):damage;
  damage=Math.min(damage,s.bossHP);const thrustHeal=actual==='thrust'&&s.hp>0?Math.min(s.stats.hp-s.hp,Math.floor(damage*W.THRUST_LIFESTEAL)):0;s.hp+=thrustHeal;s.totals.healing+=thrustHeal;
  const offerHeal=offer?Math.min(s.stats.hp-s.hp,Math.floor(damage*(offer.lifesteal||0))):0;s.hp+=offerHeal;s.totals.healing+=offerHeal;
  s.bossHP-=damage;s.totals.damage+=damage;
  // Blocked Charm attempts did not execute a Basic Attack and therefore earn no energy.
  
  const log={turn:s.turn,phase:s.phase,action:actual,requestedAction:a,damage,incoming:0,critical:!!crit?.critical,crit,charmBlocked:charmed,energyStart,energyEnd:s.energy,energyEntries:[...(actionCost?[{reason:a,requested:-actionCost,applied:-actionCost}]:[])],reaction,ultimate:actual==='resonant_wave'};
  if(damage>0)W.onLanded(s,actual);s.log.push(log);finish(s,{thrustHeal});s.config.disableClassPassives=beforePassives;return {state:s,log:s.log.at(-1),executed:actual};
 }
 function defense(original,action,pattern){
  const s=prepare(structuredClone(original)),energyStart=s.energy;
  const matched=pattern.directionMatched!==false&&((action==='parry'&&pattern.type==='physical')||(action==='magic_parry'&&pattern.type==='magic'));
  const beforePassives=s.config.disableClassPassives;if(s.roundCharm>0)s.config.disableClassPassives=true;
  let incoming=0,hits=0,evades=0,blocked=0,parryResult=null;
  const base=Stages.baseValues(s);const raw=pattern.kind==='N'?base.normal:pattern.kind==='H'?base.heavy:pattern.kind==='G'?Mechanic.failureDamage(s):0;
  const resolvedHits=[];
  const count=pattern.kind==='N'?pattern.hits:raw>0?1:0;
  for(let n=0;n<count;n++){
   const scaled=secondNormalHitDamage(s,pattern.kind,n+(pattern.hitOffset||0),pattern.kind==='G'?raw:Stages.scaleAttack(s,raw));
   const damage=pattern.trueDamage?scaled:Math.max(1,Math.floor(scaled*100/(100+Math.max(0,Offer.stat(s,'defense'))))-s.stats.mitigation);
   const evaded=!pattern.trueDamage&&roll(s)<s.stats.evasion/100;
   const hitParry=matched?(roll(s)<W.perfectChance(s)?'perfect':'success'):['parry','magic_parry'].includes(action)?'failed':null;
   parryResult=hitParry;
   if(evaded){evades++;resolvedHits.push({index:n+1,kind:pattern.kind,type:pattern.type,evaded:true,parryResult:hitParry,incoming:0});continue;}
   const afterParry=hitParry==='perfect'?0:hitParry==='success'?Math.ceil(damage*.4):damage;
   const taken=(pattern.kind==='N'||pattern.kind==='H')?Math.ceil(afterParry*W.directFactor(s,bladerPolicy)):afterParry;
   resolvedHits.push({index:n+1,kind:pattern.kind,type:pattern.type,evaded:false,parryResult:hitParry,incoming:taken});
   blocked+=damage-taken;incoming+=taken;hits++;
  }
  const offer=pattern.trueDamage?null:Offer.effects(s),penalty=s.contractPenalty&&s.turn>=s.contractPenalty.startTurn?s.contractPenalty:null;
  if(penalty?.interaction==='replace')incoming=Math.ceil(incoming*penalty.multiplier);
  else {if(offer)incoming=Math.ceil(incoming*(1+(offer.incoming||0)));if(penalty)incoming=Math.ceil(incoming*penalty.multiplier);}
  // Presentation allocation only: difference exact whole-combo transforms of resolved prefixes.
  let prefix=0,previous=0;
  const presentation={basis:'resolved-prefix-allocation',hits:resolvedHits.map(hit=>{
   prefix+=hit.incoming;let total=prefix;
   if(penalty?.interaction==='replace')total=Math.ceil(total*penalty.multiplier);
   else {if(offer)total=Math.ceil(total*(1+(offer.incoming||0)));if(penalty)total=Math.ceil(total*penalty.multiplier);}
   const allocated={...hit,incoming:total-previous};previous=total;return allocated;
  })};
  s.hp=Math.max(0,s.hp-incoming);
  if(!s.config.disableLastStand&&!s.config.disableClassPassives&&s.hp===0&&s.config.level>=50&&!s.lastStand){s.hp=1;s.lastStand=true;}
  if(s.hp>0&&['success','perfect'].includes(parryResult))s.energy=Math.min(s.maxEnergy,s.energy+1);
  if(['parry','magic_parry'].includes(action)&&!matched&&count>0){parryResult='failed';s.energy=Math.max(0,s.energy-hits);}
  s.totals.evades+=evades;s.totals.blocked+=blocked;
  s.log.push({turn:s.turn,phase:s.phase,action,damage:0,incoming,hits,evades,blocked,parryResult,parryEnergy:['success','perfect'].includes(parryResult)?1:0,energyStart,energyEnd:s.energy,energyEntries:parryResult&&(parryResult!=='failed'||hits>0)?[{reason:parryResult+'_parry',requested:parryResult==='failed'?-hits:1,applied:s.energy-energyStart}]:[]});
  const perfect=resolvedHits.some(hit=>hit.parryResult==='perfect');
  const proc=W.onParry(s,{landed:matched&&count>0,perfect,passives:!s.config.disableClassPassives,grantThrust:resolvedHits.some(h=>!h.evaded&&['success','perfect'].includes(h.parryResult)),roll:()=>roll(s)});
  finish(s,{perfect,overheat:proc.trance});s.config.disableClassPassives=beforePassives;return {state:s,log:s.log.at(-1),presentation};
 }
 function beginRound(s){W.beginRound(s);s.tranceRefreshed=false;s.roundCharm=s.charmTurns||0;s.roundHot=s.overheatTurns||0;s.roundDefense=s.thrustDefenseTurns||0;s.defenseRenewed=false;s.roundOffer=Offer.effects(s)?.remaining||0;s.offerGrantedThisRound=false;s.roundPenalty=s.contractPenalty&&s.turn>=s.contractPenalty.startTurn?s.contractPenalty.turns||0:0;}
 function endRound(s){
  if(s.roundCharm>0)s.charmTurns=Math.max(0,(s.charmTurns||0)-1);
  if(s.config.job==='warrior')W.finishRound(s);
  else if(s.roundHot>0&&!s.tranceRefreshed){s.overheatTurns=Math.max(0,s.overheatTurns-1);if(!s.overheatTurns)s.overheatPower=0;}
  if(s.roundDefense>0&&!s.defenseRenewed)s.thrustDefenseTurns=Math.max(0,s.thrustDefenseTurns-1);
  if(s.roundOffer>0&&s.offerEffects&&!s.offerGrantedThisRound)s.offerEffects.remaining=Math.max(0,s.offerEffects.remaining-1);
  if(s.roundPenalty>0&&s.contractPenalty?.duration==='turns'){s.contractPenalty.turns--;if(s.contractPenalty.turns<=0)s.contractPenalty=null;}
 }
 function contract(original,choice){const s=structuredClone(original);s.offer={screen:'choice',stage:Stages.level(s),guaranteed:!!s.pendingGuarantee};const turn=s.turn;const resolved=Offer.resolve(s,choice==='yes'?'offer_yes':'offer_no');resolved.turn=turn;resolved.phase=s.phase;resolved.offerGrantedThisRound=true;return resolved;}
 const disabledReason=(s,a)=>available(s,a)?null:a==='ultimate'?(s.config.level<10?'Unlocks at level 10':'No uses left'):a==='emergency_evade'?'Used this battle':a==='thrust'&&!W.canThrust(s)?'Requires a successful Parry or Blade Trance':'Not enough energy';
 return {disabledReason,cost,canThrust:W.canThrust,attackActions:['attack','thrust','slash','ultimate'],defenseActions:['parry','magic_parry','attack','thrust','slash','ultimate','emergency_evade'],interruptionSkills:['thrust','slash'],isAttackAction:a=>['attack','thrust','slash','ultimate'].includes(a),isSupport:()=>false,create,attack,defense,available,beginRound,endRound,contract,roll,weights:s=>Profiles.weights(s),cooldown:(s,key)=>Profiles.cooldown(s,key),due:s=>Stages.due(s),enter:s=>Stages.enter(s),stage:s=>Stages.level(s),perfectChance:s=>W.perfectChance(s)};
}
module.exports={createCombat};
