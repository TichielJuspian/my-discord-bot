'use strict';
const R=require('./warrior-rework.cjs');
const active=s=>s.config.job==='warrior',threshold=()=>Infinity;
// Legacy adapter: each successful engine step already advances one turn.
function begin(s,a){if(!active(s))return;
 R.beginRound(s);
 s.warriorEvent={defense:s.stats.defense,thrustCrit:R.tranceRemaining(s)>0?R.TRANCE_CRIT_CHANCE:0,thrustCritDamage:R.focusCritDamage(s),parryHeal:0,wasHot:R.tranceRemaining(s)>0};
 // Every accepted Earth step completes its single combined attack/defense turn.
 R.closeThrustWindow(s);
 delete s.parryFocus;s.thrustDefense=0;s.thrustDefenseTurns=0;
}
function parry(s,roll){
 const perfect=roll()<R.perfectChance(s);
 s.warriorEvent.parryReduction=perfect?1:.6;s.warriorEvent.perfect=perfect;s.warriorEvent.qualifyingParry=true;
 return perfect?'perfect':'success';
}
function heal(s,a,d){if(!active(s)||s.hp<=0||a!=='thrust')return;const heal=Math.min(s.stats.hp-s.hp,Math.floor(d*R.THRUST_LIFESTEAL));s.hp+=heal;s.totals.healing+=heal;s.warriorEvent.thrustHeal=heal;}
function finish(s,a,incoming,roll){if(!active(s))return;
 const e=s.warriorEvent,l=s.log.at(-1);if(l.damage>0)R.onLanded(s,a);
 const proc=R.onParry(s,{landed:!!e.qualifyingParry,perfect:!!e.perfect,passives:!s.config.disableClassPassives,roll});
 if(proc.trance)e.overheat=true;
 R.finishRound(s);
 if(e.wasHot&&!R.tranceRemaining(s))e.overheatEnded=true;
 s.stats.defense=e.defense;s.thrustCasts=R.hone(s);s.thrustParryBuff=R.isSharpEye(s)?'success':null;
 Object.assign(l,{warrior:{...e,deep:false,hone:R.hone(s),focus:R.focus(s),perfectChance:R.perfectChance(s),tranceChance:R.tranceChance(s),sharpEyeTurns:R.sharpEyeRemaining(s),sixthSenseTurns:R.sixthSenseRemaining(s),overheatTurns:R.tranceRemaining(s),honeReduction:R.honeReduction(s)},hp:s.hp,energyEnd:s.energy});
}
module.exports={HONE_MAX:Number.MAX_SAFE_INTEGER,PERFECT_PARRY_BASE:R.PERFECT_BASE,PERFECT_PARRY_PER_HONE:.5,PERFECT_PARRY_CAP:R.PERFECT_CAP,active,threshold,perfectChance:R.perfectChance,perfectReduction:()=>1,begin,thrust:R.thrust,parry,finish,heal,canThrust:R.canThrust,thrustCost:R.thrustCost,directFactor:R.directFactor,SLASH_MULTIPLIER:R.SLASH_MULTIPLIER};