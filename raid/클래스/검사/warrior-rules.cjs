'use strict';
const active=s=>s.config.job==='warrior',threshold=()=>Infinity;
const HONE_MAX=40;
const PERFECT_PARRY_BASE=30,PERFECT_PARRY_PER_HONE=1,PERFECT_PARRY_CAP=70;
const perfectChance=s=>Math.min(.7,(30+(s.hone||0))/100),perfectReduction=()=>1;
function begin(s,a){if(!active(s))return;s.hone=Math.min(HONE_MAX,s.hone||0);const hot=s.overheatTurns>0;
 s.warriorEvent={defense:s.stats.defense,thrustCrit:hot?10:0,thrustCritDamage:hot?10:0,parryHeal:0,wasHot:hot};delete s.parryFocus;s.thrustDefense=0;s.thrustDefenseTurns=0;
 if(a==='thrust'){s.warriorEvent.thrustCrit+=(hot?2:s.sharpEye||0)*20;s.warriorEvent.lifesteal=hot||!!s.sixthSense;s.warriorEvent.sixthSenseDamage=s.warriorEvent.lifesteal?1.2:1;if(!hot){s.parryAttackReady=0;s.sharpEye=0;s.sixthSense=false;}}
}
function thrust(s){return s.stats.attack*3*(s.warriorEvent.sixthSenseDamage||1);}
function parry(s,roll){const perfect=roll()<perfectChance(s);s.warriorEvent.parryReduction=perfect?1:.6;s.sharpEye=Math.min(2,(s.sharpEye||0)+1);s.parryAttackReady=1;if(perfect){s.sixthSense=true;s.hone=Math.min(HONE_MAX,(s.hone||0)+1);}s.warriorEvent.perfect=perfect;return perfect?'perfect':'success';}
function heal(s,a,d){if(!active(s)||s.hp<=0)return;const rate=a==='slash'?.02:a==='thrust'&&s.warriorEvent.lifesteal?.01:0;if(!rate)return;const h=Math.min(s.stats.hp-s.hp,Math.floor(d*rate));s.hp+=h;s.totals.healing+=h;s.warriorEvent.sixthSenseHeal=h;}
function finish(s,a,incoming,roll){if(!active(s))return;const e=s.warriorEvent,l=s.log.at(-1);if(l.damage>0){if(a==='attack')s.hone=Math.min(HONE_MAX,(s.hone||0)+1);if(a==='slash')s.bladerFocus=Math.min(20,(s.bladerFocus||0)+1);}
 const wasHot=s.overheatTurns>0;if(wasHot)s.overheatTurns--;
 if(e.perfect&&!s.config.disableClassPassives&&s.hp>0&&roll()<Math.min(.5,.3+(s.bladerFocus||0)/100)){s.overheatTurns=4;s.overheatPower=0;s.tranceRefreshed=true;s.overheatCount=(s.overheatCount||0)+1;e.overheat=true;e.overheatTurns=4;}
 if(s.overheatTurns>0){s.sharpEye=2;s.sixthSense=true;}else{s.overheatPower=0;if(wasHot)e.overheatEnded=true;}
 s.stats.defense=e.defense;s.thrustCasts=s.hone||0;s.thrustParryBuff=s.sharpEye?'success':null;
 Object.assign(l,{warrior:{...e,deep:false,hone:s.hone||0,focus:s.bladerFocus||0,perfectChance:perfectChance(s)},hp:s.hp,energyEnd:s.energy});
}
module.exports={HONE_MAX,PERFECT_PARRY_BASE,PERFECT_PARRY_PER_HONE,PERFECT_PARRY_CAP,active,threshold,perfectChance,perfectReduction,begin,thrust,parry,finish,heal};
