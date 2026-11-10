'use strict';
const isPaladin=s=>s.config.job==='paladin';
const blessingBonus=s=>Math.floor((s.paladinBlessing||0)/4)*10;
const stacks=s=>(s.protectionTurns||0)>0?(s.smiteBlessingStacks||0):0;
const evolved=s=>(s.paladinBlessing||0)>=8;
const protectionBonus=s=>stacks(s)*10;
const smiteCrit=s=>stacks(s)*15+(evolved(s)?20:0);
function begin(s,action,roll){
 if(!isPaladin(s))return;
 s.paladinEvent={blessingBefore:s.paladinBlessing||0,refund:0,divineHeal:0,smiteHeal:0,attack:s.stats.attack,defense:s.stats.defense};
 s.attackEnchant=0;
 if(action==='prayer'){s.smiteBlessingStacks=Math.min(3,stacks(s)+1);s.protectionTurns=6;s.paladinBlessing=(s.paladinBlessing||0)+1;}
 if(s.protectionTurns>0)s.stats.defense*=2;
 if(action==='smash'&&s.config.paladinHammerRefund&&roll()<.2){const refund=Math.min(1,s.maxEnergy-s.energy);s.energy+=refund;s.paladinEvent.refund=refund;}
}
function lifesteal(s,action,damage){if(!isPaladin(s)||action!=='smash'||!evolved(s)||damage<=0||s.hp<=0)return;const heal=Math.min(s.stats.hp-s.hp,Math.floor(damage*.01));s.hp+=heal;s.totals.healing+=heal;s.paladinEvent.smiteHeal=heal;}
function struck(s,incoming,roll){
 if(!isPaladin(s)||s.config.disableClassPassives||s.hp<=0||s.bossHP<=0||incoming<=0||roll()>=.5)return;
 s.divineGraceProc=true;const amount=Math.min(s.stats.hp-s.hp,Math.floor(30+s.stats.defense*.4));s.hp+=amount;s.totals.healing+=amount;s.paladinEvent.divineHeal=amount;
}
function finish(s,action,damage){if(!isPaladin(s))return;const e=s.paladinEvent;s.stats.attack=e.attack;s.stats.defense=e.defense;s.protectionTurns=Math.max(0,(s.protectionTurns||0)-1);if(!s.protectionTurns)s.smiteBlessingStacks=0;Object.assign(s.log.at(-1),{paladin:{...e,blessing:s.paladinBlessing||0,blessingBonus:blessingBonus(s),protectionTurns:s.protectionTurns,smiteBlessingStacks:stacks(s),divineSmite:evolved(s)},hp:s.hp});}
module.exports={isPaladin,blessingBonus,protectionBonus,smiteCrit,stacks,evolved,begin,lifesteal,struck,finish};
