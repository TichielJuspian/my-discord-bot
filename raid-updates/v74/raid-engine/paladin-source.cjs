'use strict';
module.exports=source=>{
 const rep=(a,b)=>{if(!source.includes(a))throw Error('Paladin integration missing: '+a);source=source.replace(a,b);};
 source="const P=require('./paladin-rules.cjs');\n"+source;
 rep("job==='paladin'?8:7","job==='paladin'?9:7");
 rep("if(action==='smash')damage=Math.floor(s.stats.attack*1.5);","if(action==='smash')damage=Math.floor(s.stats.attack*2.2*(1+P.blessingBonus(s)/100)*(1+P.protectionBonus(s)/100));");
 const prayer="if(action==='prayer'){const q=random(s);s.lastPrayerResult=q<.05?'weak':q<.81?'normal':'perfect';s.enchantRefreshed=!!s.attackEnchant;s.attackEnchant=1;s.enchantGranted=true;heal=Math.floor((50+s.stats.hp*.1)*(q<.05?.5:q<.81?1:1.5));}";
 rep(prayer,'');
 rep('s.energy-=energyCost;',"s.energy-=energyCost;P.begin(s,action,()=>random(s));if(s.paladinEvent?.refund)energyEntries.push({reason:'hammer_refund',requested:1,applied:s.paladinEvent.refund});");
 rep('const rawCrit=s.stats.crit+',"const rawCrit=s.stats.crit+(job==='paladin'&&action==='smash'?P.smiteCrit(s):0)+");
 const old="if(job==='paladin'&&!s.config.disableClassPassives&&s.hp>0&&incoming>0&&random(s)<.4){s.divineGraceProc=true;if(s.config.uniqueRelic){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+1);energyRecord('divine_grace',1,before);}const remaining=Math.ceil(incoming*.6);s.divineGraceBlocked=incoming-remaining;blocked+=s.divineGraceBlocked;incoming=remaining;}";
 rep(old,"");
 rep("let passiveEnergy=0,graceDamage=0;", "P.struck(s,incoming,()=>random(s));let passiveEnergy=0,graceDamage=0;");
 rep('s.turn++;if(s.bossHP<=0)',"P.finish(s,action,damage);s.turn++;if(s.bossHP<=0)");
 rep('mitigated=Math.ceil(mitigated*.6);',"mitigated=Math.ceil(mitigated*(job==='paladin'?.5:.6));");
 rep('s.bossHP-=damage;s.totals.damage+=damage;',"P.lifesteal(s,action,damage);s.bossHP-=damage;s.totals.damage+=damage;");
 return source;
};
