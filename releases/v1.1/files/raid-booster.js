'use strict';
const ATTACK_PERCENT_PER_STACK = 10;
function attack(base,count,rally=0){
 if(!Number.isFinite(base)||base<0||base>Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(count)||count<0||!Number.isFinite(rally)||rally<0)throw Error('Invalid booster attack input');
 const value=Math.floor(base*(1+rally+(ATTACK_PERCENT_PER_STACK/100)*count));
 if(!Number.isSafeInteger(value)||value<0)throw Error('Boosted attack exceeds supported numeric range');
 return value;
}
function apply(original,count){
 const s=structuredClone(original);s.boosterBaseAttack??=s.sharedBaseline?.attack??s.stats.attack;
 s.stats.attack=attack(s.boosterBaseAttack,count,s.sharedBuffEffects?.attack||0);
 s.boosterCount=count;s.boosterAttackPercent=ATTACK_PERCENT_PER_STACK*count;return s;
}
module.exports={apply,attack,ATTACK_PERCENT_PER_STACK};
