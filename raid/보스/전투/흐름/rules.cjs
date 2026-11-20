const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const ATTACK_ACTIONS=Object.freeze(['attack','thrust','slash','ultimate']);
const DEFENSE_ACTIONS=Object.freeze(['parry','magic_parry','attack','thrust','slash','ultimate','emergency_evade']);
function bossReaction(random=Math.random){const n=random();if(!(n>=0&&n<1))throw new RangeError('Random sample must be in [0,1)');return n<.7?'hit':n<.9?'guard':'evade';}
// Keep the existing Succubus 10% evasion. Defense attacks cannot be blocked.
function defenseBossReaction(boss,random=Math.random){if(boss!=='nameless_succubus')return 'hit';const n=random();if(!(n>=0&&n<1))throw new RangeError('Random sample must be in [0,1)');return n>=.9?'evade':'hit';}
// Successful Ultimate activation is decided by the class adapter, not boss avoidance.
function ultimateReaction(reaction,activated){return activated?'hit':reaction;}
function reactedDamage(damage,reaction){if(!Number.isFinite(damage)||damage<0)throw new RangeError('Nonnegative damage required');return reaction==='evade'?0:reaction==='guard'?Math.floor(damage*.7):damage;}
function maxCombo(stage){if(!['normal','enrage1','enrage2','maximum'].includes(stage))throw new RangeError('Unknown stage');return 2;}
function comboHits(stage,random=Math.random){let hits=1;while(hits<maxCombo(stage)&&random()<.6)hits++;return hits;}
function energyMaximum(levelBonus){if(!Number.isInteger(levelBonus)||levelBonus<0||levelBonus>2)throw new RangeError('Verified level energy bonus must be 0..2');return 5+levelBonus;}
function addEnergy(state,amount){state.energy=Math.min(state.maxEnergy,Math.max(0,state.energy+amount));}
function beginIdle(state){
 if(state.phase==='idle')return false;
 state.phase='idle';state.turn++;state.attackUltimateBonusUsed=false;
 if(![1,2].includes(state.energyRecoveryInterval))throw new RangeError('Recovery interval must be 1 or 2');
 state.energyRecoveryInterval=2;
 const completedTurns=state.turn-1;
 if(completedTurns>0&&completedTurns%2===0)addEnergy(state,state.config.level>=30?2:1);
 return true;
}
/** Perfect is one roll per defense choice, one energy reward across a full combo. */
function parry({action,type,perfectChance,random=Math.random}){
 const matched=(action==='parry'&&type==='physical')||(action==='magic_parry'&&type==='magic');
 if(!matched)return {matched:false,perfect:false,multiplier:1,energy:0};
 if(!(perfectChance>=0&&perfectChance<=1))throw new RangeError('Verified v1.4 perfect chance required');
 const perfect=random()<perfectChance;
 return {matched:true,perfect,multiplier:perfect?0:.4,energy:perfect?1:0};
}
const CONTRACT_POLICY=Object.freeze({duration:'turns',turns:3,interaction:'multiply'});
function contractRefusal(state,policy=CONTRACT_POLICY){
 state.contractRefusals=(state.contractRefusals||0)+1;
 if(state.contractRefusals<3)return;
 state.contractRefusals=0;
 state.contractPenaltyPending=true;
 if(!policy)return;
 if(!['battle','turns'].includes(policy.duration)||!['multiply','replace'].includes(policy.interaction)||(policy.duration==='turns'&&(!Number.isInteger(policy.turns)||policy.turns<1)))throw new TypeError('Explicit contract duration and interaction required');
 // The same penalty neither stacks nor extends while active. Third-NO batches still reset.
 if(!state.contractPenalty)state.contractPenalty={multiplier:2,duration:policy.duration,turns:policy.duration==='turns'?policy.turns:null,interaction:policy.interaction,startTurn:state.turn+1};
 state.contractPenaltyApplied=true;state.contractPenaltyPending=false;
}

module.exports={defenseBossReaction,CONTRACT_POLICY,ATTACK_ACTIONS,DEFENSE_ACTIONS,bossReaction,ultimateReaction,reactedDamage,maxCombo,comboHits,energyMaximum,addEnergy,beginIdle,parry,contractRefusal};
