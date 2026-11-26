const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
const isPaladin=s=>s.config.job==='paladin';
const PUNISHMENT_STACK_STEP=8,PUNISHMENT_DAMAGE_PER_STEP=10,PUNISHMENT_DAMAGE_CAP=40;
const PUNISHMENT_MAX_STACKS=PUNISHMENT_STACK_STEP*Math.ceil(PUNISHMENT_DAMAGE_CAP/PUNISHMENT_DAMAGE_PER_STEP);
const DIVINE_GRACE_BASE=20,DIVINE_GRACE_DEF_RATIO=.4;
const BLESSING_OFFENSE_DURATION=3,BLESSING_DEFENSE_DURATION=3,BLESSING_MAX_STACKS=3;
const BLESSING_DAMAGE_PER_STACK=6,BLESSING_CRIT_PER_STACK=10;
const threshold=s=>16;
const blessingBonus=s=>Math.min(PUNISHMENT_DAMAGE_CAP,Math.floor((s.paladinBlessing||0)/PUNISHMENT_STACK_STEP)*PUNISHMENT_DAMAGE_PER_STEP);
const duration=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
// Old saved battles have no offensive timer. Retain only their remaining
// active window, capped at the new duration; an explicit zero never revives.
const offensiveTurns=s=>s.smiteBlessingTurns===undefined?Math.min(BLESSING_OFFENSE_DURATION,duration(s.protectionTurns)):duration(s.smiteBlessingTurns);
const stacks=s=>offensiveTurns(s)>0?Math.min(BLESSING_MAX_STACKS,duration(s.smiteBlessingStacks)):0;
function tick(s){const offense=offensiveTurns(s);s.protectionTurns=Math.max(0,(s.protectionTurns||0)-1);s.smiteBlessingTurns=Math.max(0,offense-1);if(!s.smiteBlessingTurns)s.smiteBlessingStacks=0;}
const evolved=s=>(s.paladinBlessing||0)>=threshold(s);
const protectionBonus=s=>stacks(s)*BLESSING_DAMAGE_PER_STACK;
const smiteCrit=s=>stacks(s)*BLESSING_CRIT_PER_STACK+(evolved(s)?10:0);
function begin(s,action,roll){
 if(!isPaladin(s))return;
 s.paladinBlessing=Math.min(PUNISHMENT_MAX_STACKS,s.paladinBlessing||0);
 s.smiteBlessingTurns=offensiveTurns(s);s.smiteBlessingStacks=stacks(s);
 s.paladinEvent={blessingBefore:s.paladinBlessing||0,refund:0,divineHeal:0,smiteHeal:0,attack:s.stats.attack,defense:s.stats.defense};
 s.attackEnchant=0;
 if(action==='prayer'){s.smiteBlessingStacks=Math.min(BLESSING_MAX_STACKS,stacks(s)+1);s.smiteBlessingTurns=BLESSING_OFFENSE_DURATION+1;s.protectionTurns=BLESSING_DEFENSE_DURATION+1;s.paladinBlessing=Math.min(PUNISHMENT_MAX_STACKS,s.paladinBlessing+1);}
 if(s.protectionTurns>0)s.stats.defense*=1.4;
 if(action==='smash'&&s.config.paladinHammerRefund&&roll()<.2){const refund=Math.min(1,s.maxEnergy-s.energy);s.energy+=refund;s.paladinEvent.refund=refund;}
}
function lifesteal(s,action,damage){if(!isPaladin(s)||action!=='smash'||!evolved(s)||damage<=0||s.hp<=0)return;const heal=Math.min(s.stats.hp-s.hp,Math.floor(damage*.01));s.hp+=heal;s.totals.healing+=heal;s.paladinEvent.smiteHeal=heal;}
function struck(s,incoming,roll){
 if(!isPaladin(s)||s.config.disableClassPassives||s.hp<=0||s.bossHP<=0||incoming<=0||roll()>=.5)return;
 s.divineGraceProc=true;const amount=Math.min(s.stats.hp-s.hp,Math.floor(DIVINE_GRACE_BASE+s.stats.defense*DIVINE_GRACE_DEF_RATIO));s.hp+=amount;s.totals.healing+=amount;s.paladinEvent.divineHeal=amount;
}
function finish(s,action,damage){if(!isPaladin(s))return;const e=s.paladinEvent;s.stats.attack=e.attack;s.stats.defense=e.defense;tick(s);Object.assign(s.log.at(-1),{paladin:{...e,blessing:s.paladinBlessing||0,blessingBonus:blessingBonus(s),protectionTurns:s.protectionTurns,smiteBlessingTurns:offensiveTurns(s),smiteBlessingStacks:stacks(s),divineSmite:evolved(s)},hp:s.hp});}
module.exports={PUNISHMENT_MAX_STACKS,BLESSING_OFFENSE_DURATION,BLESSING_DEFENSE_DURATION,BLESSING_MAX_STACKS,BLESSING_DAMAGE_PER_STACK,BLESSING_CRIT_PER_STACK,offensiveTurns,tick,PUNISHMENT_STACK_STEP,PUNISHMENT_DAMAGE_PER_STEP,PUNISHMENT_DAMAGE_CAP,DIVINE_GRACE_BASE,DIVINE_GRACE_DEF_RATIO,threshold,isPaladin,blessingBonus,protectionBonus,smiteCrit,stacks,evolved,begin,lifesteal,struck,finish};
