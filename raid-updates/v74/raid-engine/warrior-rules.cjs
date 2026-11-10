'use strict';
const active=s=>s.config.job==='warrior',threshold=s=>10;
const perfectChance=s=>Math.min(1,.2+(s.hone||0)*.02),perfectReduction=()=>.85;
function begin(s,a){if(!active(s))return;s.warriorEvent={defense:s.stats.defense,thrustCrit:0,thrustDamage:0,parryHeal:0,wasHot:s.overheatTurns>0};s.parryAttackReady=0;
 if(a==='thrust'){const n=s.overheatTurns>0?2:(s.sharpEye||0);s.warriorEvent.thrustDamage=n*.1;s.warriorEvent.thrustCrit=(s.sixthSense||s.overheatTurns>0)?15:0;s.warriorEvent.lifesteal=!!s.sixthSense||s.overheatTurns>0;s.sharpEye=0;s.sixthSense=false;if(n){s.thrustDefense=n*.2;s.thrustDefenseTurns=3;}}
 if(s.thrustDefenseTurns>0)s.stats.defense*=1+s.thrustDefense;
}
function thrust(s){return s.stats.attack*((s.hone||0)>=10?3.5:2.5)*(1+s.warriorEvent.thrustDamage);}
function parry(s,roll){const perfect=roll()<perfectChance(s);s.warriorEvent.parryReduction=perfect?.85:.6;if(!(s.overheatTurns>0)){s.sharpEye=Math.min(2,(s.sharpEye||0)+1);if(perfect)s.sixthSense=true;}s.warriorEvent.perfect=perfect;return perfect?'perfect':'success';}
function heal(s,a,d){if(active(s)&&a==='thrust'&&s.warriorEvent.lifesteal&&s.hp>0){const h=Math.min(s.stats.hp-s.hp,Math.floor(d*.02));s.hp+=h;s.totals.healing+=h;}}
function finish(s,a,incoming,roll){if(!active(s))return;const e=s.warriorEvent;if(a==='slash'&&(s.log.at(-1)?.damage||0)>0)s.hone=(s.hone||0)+1;
 const wasHot=s.overheatTurns>0;if(wasHot)s.overheatTurns--;if(!s.overheatTurns)s.overheatPower=0;
 if(!wasHot&&e.perfect&&!s.config.disableClassPassives&&s.hp>0&&s.energy>0&&roll()<.4){const n=s.energy;s.energy=0;s.overheatTurns=3;s.sixthSense=false;s.sharpEye=0;s.overheatPower=n*.05;s.overheatCount=(s.overheatCount||0)+1;e.overheat=n;e.overheatTurns=s.overheatTurns;if(Array.isArray(s.log.at(-1)?.energyEntries))s.log.at(-1).energyEntries.push({reason:'overheat',requested:-n,applied:-n});}
 if(wasHot&&!s.overheatTurns)e.overheatEnded=true;
 s.thrustDefenseTurns=Math.max(0,(s.thrustDefenseTurns||0)-1);s.stats.defense=e.defense;s.thrustCasts=s.hone||0;s.thrustParryBuff=s.sharpEye?'success':null;
 Object.assign(s.log.at(-1),{warrior:{...e,deep:(s.hone||0)>=10,hone:s.hone||0},hp:s.hp,energyEnd:s.energy});}
module.exports={active,threshold,perfectChance,perfectReduction,begin,thrust,parry,finish,heal};
