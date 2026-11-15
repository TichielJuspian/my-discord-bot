'use strict';
const { secondNormalHitDamage } = require('./succubus-second-hit.cjs');
// Pure adapter over current v1.4 rules. Never import a character store/lobby/database.
const path=require('node:path');
function createCombat({root=path.join(__dirname,'..'),random=null}={}) {
 const load=f=>require(path.join(root,f));
 const Legacy=load('raid-engine/progression-combat.cjs'),Build=load('raid-test-build.js');
 const W=load('raid-engine/warrior-rules.cjs'),Crit=load('raid-engine/critical-rules.cjs');
 const Offer=load('raid-engine/devil-offer.cjs'),Stages=load('raid-engine/enrage-stages.cjs');
 const Profiles=load('raid-engine/pattern-profiles.cjs'),Mechanic=load('raid-engine/mechanic-rules.cjs');
 function roll(s){if(random)return random();let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
 const native=a=>a==='ultimate'?'resonant_wave':a;
 function create({level=1,enhancement=0,seed=1}={}){
  const s=Legacy.create(Build.config('warrior',level,enhancement,'nameless_succubus'),seed);
  // Reuse the actual level bonus thresholds via the old state's 3-based capacity.
  s.maxEnergy=5+(s.maxEnergy-3);s.energy=s.maxEnergy;
  s.energyRecoveryInterval=level>=30?1:2;s.turn=0;s.phase='new';
  s.director.phase='idle';s.director.queue=[];s.director.combatActions=0;s.director.patternReadyAt={};
  s.offer=null;s.offerEffects=null;s.raidId='raid15-isolated';s.buffs=[];
  return s;
 }
 const available=(s,a)=>['parry','magic_parry'].includes(a)?true:a==='emergency_evade'?!s.emergencyUsed:Legacy.actions(s).includes(native(a));
 function finish(s,action,incoming){
  const oldHot=s.overheatTurns||0,oldPower=s.overheatPower||0,oldDefense=s.thrustDefenseTurns||0;
  W.finish(s,native(action),incoming,()=>roll(s));
  // v1.5 inner actions are not turns. Duration decay is owned by endRound.
  if(oldHot>0){s.overheatTurns=oldHot;s.overheatPower=oldPower;}
  else if(s.overheatTurns>0){s.overheatTurns=Math.max(1,s.overheatTurns-1);s.log.at(-1).warrior.overheatTurns=s.overheatTurns;}
  s.thrustDefenseTurns=oldDefense;
  if(s.hp<=0)s.status='defeated';else if(s.bossHP<=0)s.status='victory';
 }
 function attack(original,action,{reaction='hit',opening=false}={}){
  const s=structuredClone(original),a=native(action);if(!available(s,action))throw Error('Unavailable attack');
  const energyStart=s.energy;const charmed=(s.roundCharm||0)>0&&roll(s)<.3;
  const actual=charmed?'charmed':a;const cost=Legacy.resourceCost(actual,s);s.energy-=cost;
  const beforePassives=s.config.disableClassPassives;if(s.roundCharm>0)s.config.disableClassPassives=true;
  W.begin(s,actual);
  if(actual==='resonant_wave'){s.ultimateUses=(s.ultimateUses||0)+1;s.ultimateUsed=s.ultimateUses>=(s.config.level>=90?2:1);}
  let damage=actual==='attack'?s.stats.attack:actual==='slash'?s.stats.attack*1.6:actual==='thrust'?W.thrust(s):actual==='resonant_wave'?Math.floor(s.stats.attack*6):0;
  let crit=null;
  if(damage>0){
   // v1.4 floors the attack component's flat support adjustment before criticals.
   damage+=Math.floor(s.stats.attack)-s.stats.attack;
   crit=Crit.roll(s.stats.crit+s.warriorEvent.thrustCrit,(s.config.ruinPercentPerPoint||0)*s.config.ruin+(s.stats.critDamagePercent||0)+(s.warriorEvent.thrustCritDamage||0),()=>roll(s));
   if(crit.critical)damage=Math.floor(damage*crit.damageMultiplier)+s.stats.critFlat;
  }
  if(opening)damage=Math.floor(damage*1.5); // Existing v1.4 opening multiplier.
  const offer=Offer.effects(s);if(offer)damage=Math.floor(damage*(1+(offer.outgoing||0)));
  damage=Math.floor(damage*(1+(s.stats.damagePercent||0)/100));
  damage=reaction==='evade'?0:reaction==='guard'?Math.floor(damage*.7):damage;
  damage=Math.min(damage,s.bossHP);W.heal(s,actual,damage);
  const offerHeal=offer?Math.min(s.stats.hp-s.hp,Math.floor(damage*(offer.lifesteal||0))):0;s.hp+=offerHeal;s.totals.healing+=offerHeal;
  s.bossHP-=damage;s.totals.damage+=damage;
  // Blocked Charm attempts did not execute a Basic Attack and therefore earn no energy.
  if(actual==='attack')s.energy=Math.min(s.maxEnergy,s.energy+1);
  const log={turn:s.turn,phase:s.phase,action:actual,requestedAction:a,damage,incoming:0,critical:!!crit?.critical,crit,charmBlocked:charmed,energyStart,energyEnd:s.energy,energyEntries:[...(cost?[{reason:a,requested:-cost,applied:-cost}]:[]),...(actual==='attack'?[{reason:'basic_attack',requested:1,applied:s.energy-(energyStart-cost)}]:[])],reaction,ultimate:actual==='resonant_wave'};
  s.log.push(log);finish(s,actual,0);s.config.disableClassPassives=beforePassives;return {state:s,log:s.log.at(-1),executed:actual};
 }
 function defense(original,action,pattern){
  const s=structuredClone(original),energyStart=s.energy;
  const matched=(action==='parry'&&pattern.type==='physical')||(action==='magic_parry'&&pattern.type==='magic');
  const actual=matched?'parry':'wait';
  const beforePassives=s.config.disableClassPassives;if(s.roundCharm>0)s.config.disableClassPassives=true;
  W.begin(s,actual);let incoming=0,hits=0,evades=0,blocked=0,parryResult=null;
  const base=Stages.baseValues(s);const raw=pattern.kind==='N'?base.normal:pattern.kind==='H'?base.heavy:pattern.kind==='G'?Mechanic.failureDamage(s):0;
  const resolvedHits=[];
  const count=pattern.kind==='N'?pattern.hits:raw>0?1:0;
  for(let n=0;n<count;n++){
   const scaled=secondNormalHitDamage(s,pattern.kind,n,pattern.kind==='G'?raw:Stages.scaleAttack(s,raw));
   const damage=Math.max(1,Math.floor(scaled*100/(100+Math.max(0,s.stats.defense)))-s.stats.mitigation);
   if(roll(s)<s.stats.evasion/100){evades++;resolvedHits.push({index:n+1,kind:pattern.kind,type:pattern.type,evaded:true,incoming:0});continue;}
   resolvedHits.push({index:n+1,kind:pattern.kind,type:pattern.type,evaded:false,incoming:damage});
   incoming+=damage;hits++;
  }
  if(matched&&count>0){parryResult=W.parry(s,()=>roll(s));const before=incoming;incoming=parryResult==='perfect'?0:Math.ceil(incoming*.4);blocked+=before-incoming;}
  const offer=Offer.effects(s),penalty=s.contractPenalty&&s.turn>=s.contractPenalty.startTurn?s.contractPenalty:null;
  if(penalty?.interaction==='replace')incoming=Math.ceil(incoming*penalty.multiplier);
  else {if(offer)incoming=Math.ceil(incoming*(1+(offer.incoming||0)));if(penalty)incoming=Math.ceil(incoming*penalty.multiplier);}
  // Presentation allocation only: difference exact whole-combo transforms of resolved prefixes.
  let prefix=0,previous=0;
  const presentation={basis:'resolved-prefix-allocation',hits:resolvedHits.map(hit=>{
   prefix+=hit.incoming;let total=prefix;
   if(matched&&count>0)total=parryResult==='perfect'?0:Math.ceil(total*.4);
   if(penalty?.interaction==='replace')total=Math.ceil(total*penalty.multiplier);
   else {if(offer)total=Math.ceil(total*(1+(offer.incoming||0)));if(penalty)total=Math.ceil(total*penalty.multiplier);}
   const allocated={...hit,incoming:total-previous};previous=total;return allocated;
  })};
  s.hp=Math.max(0,s.hp-incoming);
  if(!s.config.disableLastStand&&!s.config.disableClassPassives&&s.hp===0&&s.config.level>=50&&!s.lastStand){s.hp=1;s.lastStand=true;}
  if(s.hp>0&&parryResult==='perfect')s.energy=Math.min(s.maxEnergy,s.energy+1);
  s.totals.evades+=evades;s.totals.blocked+=blocked;
  s.log.push({turn:s.turn,phase:s.phase,action,damage:0,incoming,hits,evades,blocked,parryResult,parryEnergy:parryResult==='perfect'?1:0,energyStart,energyEnd:s.energy,energyEntries:parryResult==='perfect'?[{reason:'perfect_parry',requested:1,applied:s.energy-energyStart}]:[]});
  finish(s,actual,incoming);s.config.disableClassPassives=beforePassives;return {state:s,log:s.log.at(-1),presentation};
 }
 function beginRound(s){s.roundCharm=s.charmTurns||0;s.roundHot=s.overheatTurns||0;s.roundDefense=s.thrustDefenseTurns||0;s.defenseRenewed=false;s.roundOffer=Offer.effects(s)?.remaining||0;s.offerGrantedThisRound=false;s.roundPenalty=s.contractPenalty&&s.turn>=s.contractPenalty.startTurn?s.contractPenalty.turns||0:0;}
 function endRound(s){
  if(s.roundCharm>0)s.charmTurns=Math.max(0,(s.charmTurns||0)-1);
  if(s.roundHot>0){s.overheatTurns=Math.max(0,s.overheatTurns-1);if(!s.overheatTurns)s.overheatPower=0;}
  if(s.roundDefense>0&&!s.defenseRenewed)s.thrustDefenseTurns=Math.max(0,s.thrustDefenseTurns-1);
  if(s.roundOffer>0&&s.offerEffects&&!s.offerGrantedThisRound)s.offerEffects.remaining=Math.max(0,s.offerEffects.remaining-1);
  if(s.roundPenalty>0&&s.contractPenalty?.duration==='turns'){s.contractPenalty.turns--;if(s.contractPenalty.turns<=0)s.contractPenalty=null;}
 }
 function contract(original,choice){const s=structuredClone(original);s.offer={screen:'choice',stage:Stages.level(s),guaranteed:!!s.pendingGuarantee};const turn=s.turn;const resolved=Offer.resolve(s,choice==='yes'?'offer_yes':'offer_no');resolved.turn=turn;resolved.phase=s.phase;resolved.offerGrantedThisRound=true;return resolved;}
 const disabledReason=(s,a)=>available(s,a)?null:a==='ultimate'?(s.config.level<10?'Unlocks at level 10':'No uses left'):a==='emergency_evade'?'Used this battle':'Not enough energy';
 return {disabledReason,cost:(s,a)=>['parry','magic_parry'].includes(a)?0:Legacy.resourceCost(native(a),s),attackActions:['attack','thrust','slash','ultimate'],defenseActions:['parry','magic_parry','attack','thrust','slash','ultimate','emergency_evade'],interruptionSkills:['thrust','slash'],isAttackAction:a=>['attack','thrust','slash','ultimate'].includes(a),isSupport:()=>false,create,attack,defense,available,beginRound,endRound,contract,roll,weights:s=>Profiles.weights(s),cooldown:(s,key)=>Profiles.cooldown(s,key),due:s=>Stages.due(s),enter:s=>Stages.enter(s),stage:s=>Stages.level(s),perfectChance:s=>W.perfectChance(s)};
}
module.exports={createCombat};
