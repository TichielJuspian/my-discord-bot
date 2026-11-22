'use strict';
module.exports=source=>{
 const rep=(a,b)=>{if(!source.includes(a))throw Error('v3.2 legacy target missing: '+a);source=source.replace(a,b);};
 rep("job==='paladin'?9:6","job==='paladin'?6:6");
 const start="if(action==='shoulder_tackle'){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+1);e.energyGain=s.energy-before;energyRecord('tackle',1,before);}";
 rep(start,"if(action==='shoulder_tackle')e.energyGain=0;");
 source="const Purify=require('../../../클래스/성기사/purification.cjs');\n"+source;
 rep('function resourceCost(action,s){',"function resourceCost(action,s){if(action==='purification')return 3;");
 rep('return a.filter(action=>s.energy>=resourceCost(action,s));',"if(j==='paladin'&&Purify.removable(s))a.push('purification');return a.filter(action=>s.energy>=resourceCost(action,s));");
 rep('s.energy-=energyCost;W.begin(s,action);',"s.energy-=energyCost;const purified=action==='purification'?Purify.apply(s):[];if(action==='purification')s.config.disableClassPassives=passivesBefore;W.begin(s,action);");
 rep('s.bossHP-=damage;s.totals.damage+=damage;',"s.bossHP-=damage;s.totals.damage+=damage;if(action==='attack'){const gain=job==='paladin'?1:B.isBerserker(s)?s.berserkerEvent.released===1?2:s.berserkerEvent.released===2?1:0:0,before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+gain);if(gain)energyRecord('attack',gain,before);}");
 rep("s.guardEnergy=s.config.warriorActiveV2&&action==='guard'&&s.hp>0&&s.bossHP>0?", "s.guardEnergy=job==='paladin'&&action==='guard'&&(hits+evades)>0&&s.hp>0&&s.bossHP>0?");
 rep("if(s.config.warriorActiveV2&&action==='guard'&&s.hp>0&&s.bossHP>0)energyRecord('guard',1,before);", "if(s.guardEnergy)energyRecord('guard',1,before);");
 rep('s.log.push({crit:criticalInfo,', 's.log.push({purified,crit:criticalInfo,');
 return source;
};
