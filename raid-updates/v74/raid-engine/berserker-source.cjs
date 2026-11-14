'use strict';
const assert = require('node:assert/strict');
module.exports = function patch(source) {
  const rep = (a,b) => {assert.ok(source.includes(a), 'Berserker integration target missing: '+a);source=source.replace(a,b);};
  source = "const B=require('./berserker-rules.cjs');\n" + source;
  rep('const rawCrit=s.stats.crit+', 'const rawCrit=s.stats.crit+(B.isBerserker(s)?B.critBonus(s):0)+');
  rep('function actions(s){', "function actions(s){if(B.isBerserker(s))return B.actions(s);");
  rep('function resourceCost(action,s){', "function resourceCost(action,s){if(B.isBerserker(s))return B.cost(action,s);");
  rep("const {job,level}=s.config,v=values(s),p=phase(s);", "const {job,level}=s.config,v=values(s),p=(s.berserkerGroggy>0?'opening':phase(s));");
  rep("const frenzyBonus=job==='berserker'", "const frenzyBonus=false");
  rep('s.energy-=energyCost;', "s.energy-=energyCost;if(B.isBerserker(s)){const e=B.begin(s,action,()=>random(s));if(action==='blood_transfusion'){selfDamage=e.selfDamage;s.hp-=selfDamage;energyEntries.push({reason:'blood_absorb',requested:-e.absorbedEnergy,applied:-e.absorbedEnergy});}if(action==='shoulder_tackle'){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+1);e.energyGain=s.energy-before;energyRecord('tackle',1,before);}}");
  rep("if(action==='attack')damage=s.stats.attack;", "if(action==='attack')damage=s.stats.attack*(B.isBerserker(s)?B.attackMultiplier(s):1);if(action==='berserker_ultimate')damage=s.stats.attack*B.attackMultiplier(s);");
  rep('damage=Math.min(damage,s.bossHP);', 'if(B.isBerserker(s))damage=B.outgoing(s,damage);damage=Math.min(damage,s.bossHP);');
  rep('s.bossHP-=damage;s.totals.damage+=damage;', 's.bossHP-=damage;s.totals.damage+=damage;if(B.isBerserker(s)&&s.berserkerEvent.released===3)heal+=Math.floor(damage*.04);if(B.isBerserker(s))B.afterAttack(s,damage,()=>random(s));');
  rep("s.lastMechanicDamage=mechanicDamage;", `if(B.isBerserker(s)){
    const physical=(s.config.boss==='earth'&&['normal','heavy','flurry'].includes(p))||(s.config.boss==='nameless_succubus'&&p==='normal'&&s.director?.hand==='left')||s.config.bossPhysicalPhases?.includes(p);
    const curseExtra=s.sandstormExtraDamage||0;
    const before=incoming;incoming=B.incoming(s,Math.max(0,incoming-curseExtra),{physical})+B.bloodIncoming(s,curseExtra);blocked+=before-incoming;
    // Failed raid mechanics bypass all class mitigation, including Blood Draw.
    if(!['earth','nameless_succubus'].includes(s.config.boss))mechanicDamage=B.incoming(s,mechanicDamage);
    const snapshots=s.berserkerCurseDamage||[];
    if(dot>0)dot=B.bloodIncoming(s,snapshots.reduce((a,b)=>a+b,0));
    s.berserkerCurseDamage=snapshots.slice(0,s.marks||0);
    while(s.berserkerCurseDamage.length<(s.marks||0))s.berserkerCurseDamage.push(B.incoming(s,3,{blood:false}));
  }s.lastMechanicDamage=mechanicDamage;`);
  rep('Math.min(s.stats.hp-s.hp,Math.max(0,heal', 'Math.min(B.healCapacity(s),Math.max(0,heal');
  // Each charge-2/3 release contributes two interrupt units, charge-1 one unit.
  rep("if(action!=='resonant_wave'&&action!=='emergency_evade'&&p==='struggle_end'", "if(B.isBerserker(s)&&p.startsWith('struggle')&&damage>0)s.struggleSkills=Math.min(2,(s.struggleSkills||0)+B.interruptWeight(s));if(action!=='berserker_ultimate'&&action!=='resonant_wave'&&action!=='emergency_evade'&&p==='struggle_end'");
  rep("if(action!=='resonant_wave'&&action!=='emergency_evade'&&p==='mark'", "if(B.isBerserker(s)&&['mark_warning','mark'].includes(p)&&damage>0&&B.interruptWeight(s)>0){s.curseInterrupted=true;s.curseInterruptedNow=true;}if(action!=='berserker_ultimate'&&action!=='resonant_wave'&&action!=='emergency_evade'&&p==='mark'");
  rep("const attacks=action==='resonant_wave'", "const attacks=action==='berserker_ultimate'||action==='resonant_wave'");
  rep("'attack','thrust','smash','resonant_wave'", "'attack','berserker_ultimate','thrust','smash','resonant_wave'");
  rep('s.turn++;if(s.bossHP<=0)', `if(B.isBerserker(s)){
    const e=s.berserkerEvent;
    if(e.action==='berserker_ultimate'){s.ultimateUses=(s.ultimateUses??0)+1;s.berserkerGroggy=2;}
    else if(original.berserkerGroggy>0)s.berserkerGroggy=Math.max(0,original.berserkerGroggy-1);
    // Healing was already resolved in the host engine; do not apply it twice.
    if(s.log.at(-1).lastStandTriggered)s.berserkerCharge=0;
    const result=B.finish(s,{damage:0,dealtDamage:damage,incomingDamage:incoming+s.lastMechanicDamage,heavyOrSpecial:p==='heavy'||p.startsWith('struggle'),normalHit:p==='normal'&&incoming>0});
    if(e.relicEnergyGain!==undefined){energyEntries.push({reason:'finisher_relic',requested:2,applied:e.relicEnergyGain});s.log.at(-1).energyEnd=s.energy;}
    result.lifesteal=e.released===3?Math.min(actualHeal,Math.floor(damage*.04)):0;
    Object.assign(s.log[s.log.length-1],{berserker:result,ultimate:e.action==='berserker_ultimate',groggy:original.berserkerGroggy>0});
  }s.turn++;if(s.bossHP<=0)`);
  return source;
};
