'use strict';
// Pure Blader battle-state helpers. No storage, account data, or other jobs.
const HONE_THRESHOLD=60,FOCUS_THRESHOLD=30,PERFECT_BASE=30,PERFECT_CAP=70;
const TRANCE_BASE=30,TRANCE_CAP=60,TRANCE_ROUNDS=3,BUFF_ROUNDS=2;
const TRANCE_CRIT_CHANCE=20,SIXTH_SENSE_REDUCTION=.10,THRUST_MULTIPLIER=3.5,SHARP_EYE_MULTIPLIER=1.2,THRUST_LIFESTEAL=.01,SLASH_MULTIPLIER=1.2;
const active=s=>s.config?.job==='warrior';
const stack=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const add=value=>Math.min(Number.MAX_SAFE_INTEGER,stack(value)+1);
const focus=s=>stack(s.bladerFocus),hone=s=>stack(s.hone),tranceRemaining=s=>stack(s.overheatTurns);
const perfectChance=s=>Math.min(PERFECT_CAP,PERFECT_BASE+Math.floor(hone(s)/2))/100;
const tranceChance=s=>Math.min(TRANCE_CAP,TRANCE_BASE+focus(s))/100;
// Raw stack bonuses are percentage points; approved battle policy is applied below.
const rawHoneReduction=s=>Math.floor(Math.max(0,hone(s)-HONE_THRESHOLD)/2);
const rawFocusCritDamage=s=>Math.floor(Math.max(0,focus(s)-FOCUS_THRESHOLD)/2);
const BALANCE_POLICY=Object.freeze({honeMitigationCap:30,focusCritDamageCap:null,tranceThrustCost:0});
const honeReduction=(s,p=BALANCE_POLICY)=>Math.min(p.honeMitigationCap,rawHoneReduction(s));
const focusCritDamage=(s,p=BALANCE_POLICY)=>p.focusCritDamageCap==null?rawFocusCritDamage(s):Math.min(p.focusCritDamageCap,rawFocusCritDamage(s));
const thrustCost=(s,p=BALANCE_POLICY)=>tranceRemaining(s)>0?p.tranceThrustCost:1;
const directFactor=(s,p=BALANCE_POLICY)=>(1-honeReduction(s,p)/100)*(hasSixthSense(s)?1-SIXTH_SENSE_REDUCTION:1);
const sharpEyeRemaining=s=>Math.max(stack(s.sharpEyeTurns),tranceRemaining(s));
const sixthSenseRemaining=s=>Math.max(stack(s.sixthSenseTurns),tranceRemaining(s));
const isSharpEye=s=>sharpEyeRemaining(s)>0,hasSixthSense=s=>sixthSenseRemaining(s)>0;
const canThrust=s=>tranceRemaining(s)>0||!!s.parryAttackReady;
const thrust=s=>s.stats.attack*THRUST_MULTIPLIER*(isSharpEye(s)?SHARP_EYE_MULTIPLIER:1);
function alias(s){if(!active(s))return s;s.sharpEye=isSharpEye(s)?1:0;s.sixthSense=hasSixthSense(s);return s;}
function normalize(s){
 if(!active(s)||s.bladerRulesVersion===1)return s;
 s.hone=hone(s);s.bladerFocus=focus(s);s.parryAttackReady=s.parryAttackReady?1:0;
 s.sharpEyeTurns=s.sharpEyeTurns==null?(s.sharpEye?BUFF_ROUNDS:0):stack(s.sharpEyeTurns);
 s.sixthSenseTurns=s.sixthSenseTurns==null?(s.sixthSense?BUFF_ROUNDS:0):stack(s.sixthSenseTurns);
 s.overheatTurns=Math.min(TRANCE_ROUNDS,tranceRemaining(s));s.bladerRulesVersion=1;
 return alias(s);
}
function beginRound(s){if(!active(s))return s;normalize(s);s.bladerRound={sharp:stack(s.sharpEyeTurns),sense:stack(s.sixthSenseTurns),trance:tranceRemaining(s),sharpRenewed:false,senseRenewed:false,tranceRenewed:false};return s;}
function buff(s,which){if(!active(s))return s;
 if(which==='sharp'){s.sharpEyeTurns=BUFF_ROUNDS;if(s.bladerRound)s.bladerRound.sharpRenewed=true;}
 else if(which==='sense'){s.sixthSenseTurns=BUFF_ROUNDS;if(s.bladerRound)s.bladerRound.senseRenewed=true;}
 else throw Error('Unknown Blader buff');
 return alias(s);
}
function onLanded(s,action){if(!active(s))return s;
 if(action==='attack')return buff(s,'sense');
 if(action==='slash'){s.hone=add(s.hone);s.bladerFocus=add(s.bladerFocus);}
 return s;
}
function onParry(s,{landed=false,perfect=false,passives=true,roll}={}){
 if(!active(s)||!landed)return {trance:false};
 s.hone=add(s.hone);s.parryAttackReady=1;
 if(!perfect)return {trance:false};
 buff(s,'sharp');
 const proc=passives&&s.hp>0&&roll()<tranceChance(s);
 if(proc){
  s.overheatTurns=TRANCE_ROUNDS;s.overheatPower=0;s.tranceRefreshed=true;
  s.overheatCount=add(s.overheatCount);if(s.bladerRound)s.bladerRound.tranceRenewed=true;alias(s);
 }
 return {trance:proc};
}
// Only the normal Parry license expires. Trance remains an independent unlock.
function closeThrustWindow(s){if(active(s))s.parryAttackReady=0;}
function finishRound(s){if(!active(s))return s;
 const r=s.bladerRound;if(!r)return alias(s);
 if(r.sharp>0&&!r.sharpRenewed)s.sharpEyeTurns=Math.max(0,stack(s.sharpEyeTurns)-1);
 if(r.sense>0&&!r.senseRenewed)s.sixthSenseTurns=Math.max(0,stack(s.sixthSenseTurns)-1);
 if(r.trance>0&&!r.tranceRenewed)s.overheatTurns=Math.max(0,tranceRemaining(s)-1);
 if(!tranceRemaining(s))s.overheatPower=0;
 delete s.bladerRound;return alias(s);
}
module.exports={HONE_THRESHOLD,FOCUS_THRESHOLD,PERFECT_BASE,PERFECT_CAP,TRANCE_BASE,TRANCE_CAP,TRANCE_ROUNDS,BUFF_ROUNDS,TRANCE_CRIT_CHANCE,SIXTH_SENSE_REDUCTION,THRUST_MULTIPLIER,SHARP_EYE_MULTIPLIER,THRUST_LIFESTEAL,SLASH_MULTIPLIER,focus,hone,tranceRemaining,perfectChance,tranceChance,rawHoneReduction,rawFocusCritDamage,honeReduction,focusCritDamage,thrustCost,directFactor,BALANCE_POLICY,sharpEyeRemaining,sixthSenseRemaining,isSharpEye,hasSixthSense,canThrust,thrust,normalize,beginRound,buff,onLanded,onParry,closeThrustWindow,finishRound};