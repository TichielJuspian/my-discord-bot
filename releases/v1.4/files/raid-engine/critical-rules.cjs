'use strict';
// Raw chance stays unmodified. Convert overflow only at the final hit calculation.
function profile(rawChance, bonusDamagePercent=0, baseMultiplier=1.2) {
 const raw=Math.max(0,Number(rawChance)||0), actualChance=Math.min(100,raw), overflow=Math.max(0,raw-100);
 return {rawChance:raw,actualChance,overflow,damageMultiplier:(baseMultiplier*100+bonusDamagePercent+overflow)/100};
}
function roll(rawChance,bonusDamagePercent,random,{baseMultiplier=1.2,guaranteedChance=0}={}) {
 const result=profile(rawChance,bonusDamagePercent,baseMultiplier);
 const procChance=Math.max(0,Math.min(100,guaranteedChance));
 const guaranteedProc=procChance>0&&random()<procChance/100;
 const critical=guaranteedProc||random()<result.actualChance/100;
 return {...result,guaranteedChance:procChance,guaranteedProc,critical,tier:critical?1:0};
}
module.exports={profile,roll};
