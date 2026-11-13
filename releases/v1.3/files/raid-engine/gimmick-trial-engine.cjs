const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),assert=require('node:assert/strict');
let source=fs.readFileSync(__dirname+'/roles-engine.js','utf8');
function rep(a,b){assert.ok(source.includes(a),'Missing '+a);source=source.replace(a,b);}
// Vulnerability scales the finished attack (including critical damage) once.
rep("if(p==='opening')damage+=40;",'');
rep('damage=Math.min(damage,s.bossHP);',"if(p==='opening')damage=Math.floor(damage*1.5);damage=Math.min(damage,s.bossHP);");
rep('damage=Math.min(damage,s.bossHP);', 'if(damage>0&&renewalBonus>0)s.renewalCharges=Math.max(0,(s.renewalCharges??0)-1);damage=Math.min(damage,s.bossHP);');
rep('s.energy-=resourceCost(action);',`const renewalBonus=job==='paladin'&&!s.config.disableClassPassives&&(s.renewalCharges??0)>0?Math.floor(s.config.renewalAttack??level*(s.config.renewalPerLevel??0)):0;
 let renewalProc=false;s.stats.attack+=renewalBonus;s.lastRenewalBonus=renewalBonus;
 
 s.energy-=resourceCost(action);`);
rep('s.totals.evades+=evades;', 's.stats.attack-=renewalBonus;s.totals.evades+=evades;');
rep('heal+=v.procHeal;', '{heal+=v.procHeal;renewalProc=true;}');
rep('s.totals.healing+=actualHeal;', 's.totals.healing+=actualHeal;if(renewalProc&&actualHeal>0&&(s.config.renewalAttack??s.config.renewalPerLevel??0)>0)s.renewalCharges=5;');
rep('s.energy-=resourceCost(action);',`const frenzyBonus=job==='berserker'&&s.config.enableBerserkerFrenzy&&!s.config.disableClassPassives?(s.hp*4<=s.stats.hp?15:s.hp*2<=s.stats.hp?10:s.hp*4<=s.stats.hp*3?5:0):0;
 s.stats.attack+=frenzyBonus;s.lastFrenzyBonus=frenzyBonus;
 s.energy-=resourceCost(action);`);
rep('s.totals.evades+=evades;', 's.stats.attack-=frenzyBonus;s.totals.evades+=evades;');
rep('s.totals.evades+=evades;', `s.lastAttackRage=0;s.lastTurnRage=0;
 if(job==='berserker'&&!s.config.disableClassPassives&&s.hp>0&&s.bossHP>0){
 s.lastAttackRage=action==='attack'?Math.min(100-s.rage,s.config.attackRage??0):0;s.rage+=s.lastAttackRage;
 s.lastTurnRage=Math.min(100-s.rage,s.config.turnRage??0);s.rage+=s.lastTurnRage;
 }
 s.totals.evades+=evades;`);
rep("if(job==='paladin'&&damage>0&&random(s)<v.procChance/100)","if(!s.config.disableClassPassives&&job==='paladin'&&damage>0&&random(s)<v.procChance/100)");
rep("if(s.hp===0&&level>=100&&!s.lastStand)","if(!s.config.disableLastStand&&!s.config.disableClassPassives&&s.hp===0&&level>=100&&!s.lastStand)");
rep("if(s.hp>0&&job==='warrior'&&hits>0)","if(!s.config.disableClassPassives&&s.hp>0&&job==='warrior'&&hits>0&&counterTriggered)");
rep("if(job==='berserker'&&s.hp>0)","if(!s.config.disableClassPassives&&job==='berserker'&&s.hp>0)");
rep("arcaneBonus:10+2*l", "arcaneBonus:Math.floor(10+(s.config.skillTuning?.arcanePerLevel??2)*l)");
rep("burst:[0,6*l+chargeBonus,13*l+2*chargeBonus,21*l+3*chargeBonus]", "burst:[0,6*l+chargeBonus,13*l+2*chargeBonus,21*l+3*chargeBonus].map((n,k)=>Math.floor(n+(s.config.skillTuning?.burstExtraPerLevel??0)*l*k))");
rep("counterDamage=s.stats.counter+(stance?v.counterBonus:0)", "counterDamage=(s.config.counterBase??(Math.floor(s.stats.attack*(s.config.counterAttackRatio??.2))+Math.floor(Math.min(25,level)*(s.config.counterLevelScale??1))))+(stance?v.counterBonus:0)");
rep("if(s.config.elements&&BOSSES[s.config.boss].favored===job)counterDamage=", "if(s.config.counterCrit){const chance=s.config.tieredCritical?s.stats.crit:Math.min(100,s.stats.crit);s.lastCounterCritTier=Math.floor(chance/100)+(random(s)<(chance%100)/100?1:0);if(s.lastCounterCritTier>0)counterDamage=Math.floor(counterDamage*(1+s.lastCounterCritTier*(.2+(s.config.ruinPercentPerPoint??0)*s.config.ruin/100+(s.stats.critDamagePercent??0)/100)))+s.stats.critFlat;}if(s.config.elements&&BOSSES[s.config.boss].favored===job)counterDamage=");
rep('if(s.config.elements&&BOSSES[s.config.boss].favored===job)counterDamage=', 'if(!(s.config.counterDefenseRatio>0)&&level>=20&&random(s)<(s.config.perfectCounterChance??.2)){s.lastPerfectCounter=true;counterDamage=Math.floor(counterDamage*1.5);}if(s.config.elements&&BOSSES[s.config.boss].favored===job)counterDamage=');
rep('let incoming=0,dot=0', 's.lastPerfectCounter=false;s.lastCounterCritTier=0;let incoming=0,dot=0');
rep("job==='spellblade'?1.45:1.2", "job==='spellblade'?(s.config.spellbladeCritMultiplier??1.45):1.2");
rep("const critChance=Math.min(100,s.stats.crit+(action==='arcane_strike'?15:0));critical=random(s)<critChance/100;if(critical)damage=Math.floor(damage*(job==='spellblade'?(s.config.spellbladeCritMultiplier??1.45):1.2))+s.stats.critFlat;", "const rawCrit=s.stats.crit+(action==='arcane_strike'?15:0),critChance=s.config.tieredCritical?rawCrit:Math.min(100,rawCrit);const critRoll=random(s);const critTier=Math.floor(critChance/100)+(critRoll<(critChance%100)/100?1:0);criticalTier=critTier;critical=critTier>0;if(critical){const multiplier=(job==='spellblade'?(s.config.spellbladeCritMultiplier??1.45):1.2)+(s.config.ruinPercentPerPoint??0)*s.config.ruin/100+(s.stats.critDamagePercent??0)/100;damage=Math.floor(damage*(1+critTier*(multiplier-1)))+s.stats.critFlat;}");
rep('dodgeResult=random(s)<.2', 'dodgeResult=random(s)<(s.config.perfectDodgeChance??.2)');
rep('let incoming=0,dot=0', 's.lastMechanicDamage=0;let incoming=0,dot=0');
rep("if(j==='spellblade'&&!s.dodgeCooldown)a.push('dodge');",'');
rep("(action==='dodge'?Math.min(85,42+s.stats.evasion):s.stats.evasion)",'s.stats.evasion');
rep("if(action==='dodge'){","if(job==='spellblade'&&!s.config.disableClassPassives){");rep("if(action==='dodge'&&!dodgeResult)","if(job==='spellblade'&&!dodgeResult)");
rep('Math.floor(s.stats.defense*.5)',"Math.floor(s.stats.defense*(job==='spellblade'?.2:.5))");
rep("'parry','dodge','retreat'","'parry','dodge','cleanse','retreat'");
rep("const a=['attack','guard','retreat']","const a=['attack','guard','retreat'];if(s.marks>0)a.push('cleanse');const unused=[]");
rep('curse:0,status:', 'marks:0,struggleDamage:0,curse:0,status:');
rep("if(action==='attack')damage=s.stats.attack;", "if(action==='cleanse')s.marks=0;\n if(action==='attack')damage=s.stats.attack;");
rep("const attacks=['stun'", "const attacks=['stun'");
rep("if(s.curse>0){dot=barrier?0:16+2*enraged;if(barrier)blocked+=16+2*enraged;s.curse--;}","dot=s.marks*3;");
rep("if(p==='curse'&&s.hp>0&&statusEffect!=='stun')s.curse=job==='paladin'?2:3;",'');
// Resolve mandatory mechanics before counter/resource/defeat processing.
rep('s.hp=Math.max(0,s.hp-incoming-dot);',`const counterTriggered=!s.config.disableClassPassives&&job==='warrior'&&hits>0&&random(s)<(s.config.counterChance??1);
  s.lastCounterReduction=0;
  incoming-=s.lastCounterReduction;blocked+=s.lastCounterReduction;
  
  let mechanicDamage=0;
  if(p==='struggle_start'){s.struggleDamage=0;s.struggleSkills=0;}
  if(['struggle_start','struggle','struggle_end'].includes(p))s.struggleDamage+=damage;
  if(['struggle_start','struggle','struggle_end'].includes(p)&&['thrust','arcane_strike','burst1','burst2','burst3','signature','counter'].includes(action)&&damage>0)s.struggleSkills=Math.min(2,(s.struggleSkills||0)+1);
  if(p==='struggle_end'&&(s.struggleSkills||0)<2)mechanicDamage+=80;
  s.curseInterruptedNow=false;
  if(['mark_warning','mark_prepare','mark'].includes(p))s.curseInterrupted=false;
  if(['mark_warning','mark'].includes(p)&&['thrust','arcane_strike','burst1','burst2','burst3','signature','counter'].includes(action)&&damage>0){s.curseInterrupted=true;s.curseInterruptedNow=true;}
  if(p==='mark'&&!s.curseInterrupted)s.marks=Math.min(3,s.marks+1);
  s.lastMechanicDamage=mechanicDamage;
  s.hp=Math.max(0,s.hp-incoming-dot-mechanicDamage);`);
rep('s.log.push({dodgeResult,','s.log.push({curseInterruptedNow:!!s.curseInterruptedNow,mechanicDamage:s.lastMechanicDamage||0,marks:s.marks,struggleDamage:s.struggleDamage,struggleSkills:s.struggleSkills||0,dodgeResult,');
// Opt-in Warrior active redesign; legacy skills remain available outside this trial.
source=source.replaceAll('resourceCost(action)','resourceCost(action,s)');
rep("function resourceCost(action,s){return", "function resourceCost(action,s){if(s?.config.warriorActiveV2){if(action==='thrust')return 2;if(action==='parry')return 1;}return");
rep('return a.filter(action=>', "if(j==='warrior'&&s.config.warriorActiveV2){for(let i=a.length-1;i>=0;i--)if(['counter','fortress','signature','first_aid','enchant','parry'].includes(a[i]))a.splice(i,1);a.push('thrust','parry');}return a.filter(action=>");
rep("if(action==='attack')damage=s.stats.attack;", "if(action==='thrust')damage=s.stats.attack*2;if(action==='attack')damage=s.stats.attack;");
rep('let critical=false;if(damage>0){', `s.lastParryAttackBonus=0;let critical=false;if(damage>0){
 if(job==='warrior'&&s.config.warriorActiveV2&&s.parryAttackReady&&s.config.parryAttackBonus!==false){s.lastParryAttackBonus=Math.floor(s.stats.attack*.4*Math.min(3,Number(s.parryAttackReady)));damage+=s.lastParryAttackBonus;s.parryAttackReady=false;}`);
rep("if(action==='parry'&&hitIndex===0)","if(action==='parry'&&!s.config.warriorActiveV2&&hitIndex===0)");
rep('const counterTriggered=', `if(action==='parry'&&s.config.warriorActiveV2&&hits>0){parryAttempted=true;const parryIncoming=incoming;
 const parryRoll=random(s);if(parryRoll<(s.config.uniqueRelic?1:.95)){if(parryRoll<(s.config.uniqueRelic?.4:.2)){parryResult='perfect';blocked+=incoming;incoming=0;parryEnergy=2;}
 else{parryResult='success';const remaining=Math.ceil(incoming*.4);blocked+=incoming-remaining;incoming=remaining;parryEnergy=1;}}
 else{parryResult='failed';const remaining=Math.ceil(incoming*.7);blocked+=incoming-remaining;incoming=remaining;}
 s.parryBlockedThisTurn=parryIncoming-incoming;
 if(['success','perfect'].includes(parryResult)&&s.config.parryAttackBonus!==false)s.parryAttackReady=Math.min(3,Number(s.parryAttackReady||0)+1);}
 const counterTriggered=`);
rep("s.parryCooldown=action==='parry'?3:Math.max(0,s.parryCooldown-1);", "s.parryCooldown=s.config.warriorActiveV2?0:action==='parry'?3:Math.max(0,s.parryCooldown-1);");
rep('return p[(s.turn-1)%p.length];',"if(s.director)return s.director.phase;const next=p[(s.turn-1)%p.length];return next==='mark'&&s.curseInterrupted?'normal':next;");
rep('s.log.push({', 's.guardEnergy=s.config.warriorActiveV2&&action===\'guard\'&&s.hp>0&&s.bossHP>0?Math.min(1,s.maxEnergy-s.energy):0;s.energy+=s.guardEnergy;s.log.push({guardEnergy:s.guardEnergy,');
// One free emergency evade per battle from level 10. It consumes the turn,
// avoids direct/mechanic damage and this turn's curse application/tick only.
rep("const a=['attack','guard','retreat'];", "const a=['attack','guard','retreat'];if(s.config.level>=10&&!s.emergencyUsed)a.push('emergency_evade');");
rep('function resourceCost(action,s){', "function resourceCost(action,s){if(action==='emergency_evade')return 0;");
rep('s.energy-=resourceCost(action,s);', "if(action==='emergency_evade')s.emergencyUsed=true;s.energy-=resourceCost(action,s);");
rep("const attacks=['stun','blind'].includes(statusEffect)?[]:","const attacks=action==='emergency_evade'||['stun','blind'].includes(statusEffect)?[]:");
rep('dot=s.marks*3;', "dot=action==='emergency_evade'?0:s.marks*3;");
rep("if(p==='struggle_end'&&(s.struggleSkills||0)<2)mechanicDamage+=80;", "if(action!=='emergency_evade'&&p==='struggle_end'&&(s.struggleSkills||0)<2)mechanicDamage+=80;");
rep("if(p==='mark'&&!s.curseInterrupted)s.marks=", "if(action!=='emergency_evade'&&p==='mark'&&!s.curseInterrupted)s.marks=");
rep('s.log.push({', "s.log.push({emergencyEvaded:action==='emergency_evade',");
// Resonant Wave Slash: one level-20 ultimate, three energy, one turn.
rep("a.push('thrust','parry');", "a.push('thrust','parry');if(s.config.level>=20&&!s.ultimateUsed)a.push('resonant_wave');");
rep('function resourceCost(action,s){', "function resourceCost(action,s){if(action==='resonant_wave')return 0;");
rep('s.energy-=resourceCost(action,s);', "if(action==='resonant_wave')s.ultimateUsed=true;s.energy-=resourceCost(action,s);");
rep("if(action==='thrust')damage=", "if(action==='resonant_wave')damage=Math.floor(s.stats.attack*(job==='paladin'?8:7));if(action==='thrust')damage=");
rep("const attacks=action==='emergency_evade'||", "const attacks=action==='resonant_wave'||action==='emergency_evade'||");
rep("if(action!=='emergency_evade'&&p==='struggle_end'", "if(action!=='resonant_wave'&&action!=='emergency_evade'&&p==='struggle_end'");
rep("if(action!=='emergency_evade'&&p==='mark'", "if(action!=='resonant_wave'&&action!=='emergency_evade'&&p==='mark'");
rep('s.log.push({', "s.log.push({ultimate:action==='resonant_wave',patternCancelled:action==='resonant_wave'&&!['opening','recovery'].includes(p),");
// Guard replaces the old flat bonus with 40% post-defense direct mitigation.
rep("block=action==='guard'?Math.floor(s.stats.defense*(job==='spellblade'?.2:.5)):0", "block=0");
rep('if(barrier){blocked+=mitigated;', "if(action==='guard'){const before=mitigated;mitigated=Math.ceil(mitigated*.6);blocked+=before-mitigated;}if(barrier){blocked+=mitigated;");
rep('Math.max(0,heal-Math.max(0,s.turn-12)*6)','Math.max(0,heal)');

rep("if(!s.config.disableClassPassives&&job==='paladin'&&damage>0&&random(s)<v.procChance/100)","if(false)");
rep('return a.filter(action=>',"if(j==='paladin'){a.splice(0,a.length,'attack','guard','smash','prayer','retreat');if(s.config.level>=20&&!s.ultimateUsed)a.push('resonant_wave');if(s.config.level>=10&&!s.emergencyUsed)a.push('emergency_evade');if(s.marks>0)a.push('cleanse');}return a.filter(action=>");
rep('function resourceCost(action,s){',"function resourceCost(action,s){if(action==='smash')return 1;if(action==='prayer')return 2;");
rep("if(action==='attack')damage=s.stats.attack;", "if(action==='smash')damage=Math.floor(s.stats.attack*1.5);if(action==='prayer'){const q=random(s);heal=Math.floor((50+s.stats.hp*.1)*(q<.05?.5:q<.81?1:1.5));}if(action==='attack')damage=s.stats.attack;");
source=source.replaceAll("['thrust','arcane_strike'","['smash','thrust','arcane_strike'");
rep('s.log.push({',"let passiveEnergy=0,graceDamage=0,graceProc=false;if(job==='paladin'&&!s.config.disableClassPassives&&s.hp>0&&s.bossHP>0&&random(s)<.3){graceProc=true;passiveEnergy=Math.min(1,s.maxEnergy-s.energy);s.energy+=passiveEnergy;}s.log.push({graceProc,graceDamage,passiveEnergy,");

// Per-action prayer outcome is persisted for presentation.
rep("if(action==='smash')damage=", "s.lastPrayerResult=null;if(action==='smash')damage=");
rep("const q=random(s);heal=", "const q=random(s);s.lastPrayerResult=q<.05?'weak':q<.81?'normal':'perfect';heal=");
rep('s.log.push({', 's.log.push({prayerResult:s.lastPrayerResult,');
// Charm affects requested attacks only; blocked attempts consume a turn, not energy.
rep("const {job,level}=s.config,v=values(s),p=phase(s);", "const {job,level}=s.config,v=values(s),p=phase(s);const requestedAction=action;const charmActive=s.config.boss==='nameless_succubus'&&(s.charmTurns||0)>0;const charmBlocked=charmActive&&['attack','thrust','smash','resonant_wave','arcane_strike','burst1','burst2','burst3','signature'].includes(action)&&random(s)<.3;if(charmBlocked)action='charmed';if(charmActive)s.charmTurns--;s.charmApplied=false;");
rep('function resourceCost(action,s){', "function resourceCost(action,s){if(action==='charmed')return 0;");
rep("if(action==='cleanse')s.marks=0;", "if(action==='cleanse'){s.marks=0;s.charmTurns=0;}");
rep("if(s.marks>0)a.push('cleanse')", "if(s.marks>0||s.charmTurns>0)a.push('cleanse')");
rep("if(s.marks>0)a.push('cleanse')", "if(s.marks>0||s.charmTurns>0)a.push('cleanse')");
rep("s.marks=Math.min(3,s.marks+1);", "{if(s.config.boss==='nameless_succubus'){s.charmTurns=(s.charmTurns||0)+5;s.charmApplied=true;}else s.marks=Math.min(3,s.marks+1);}");
rep('s.log.push({', 's.log.push({requestedAction,charmBlocked,charmApplied:s.charmApplied,charmTurns:s.charmTurns||0,');
// Charm seals class passives for the entire affected turn, including its final turn.
rep('if(charmBlocked)action=', "const passivesBefore=s.config.disableClassPassives;if(charmActive)s.config.disableClassPassives=true;if(charmBlocked)action=");
rep("job==='paladin'&&!s.config.disableClassPassives&&s.hp>0&&s.bossHP>0&&random(s)<.3", "job==='paladin'&&!s.config.disableClassPassives&&!s.charmTurns&&s.hp>0&&s.bossHP>0&&random(s)<.3");
rep("s.turn++;if(s.bossHP<=0)", "s.config.disableClassPassives=passivesBefore;s.turn++;if(s.bossHP<=0)");
// Presentation ledger observes the existing mutations without changing their order or RNG.
rep('s.energy-=resourceCost(action,s);', `const energyStart=s.energy,energyEntries=[];
 const energyRecord=(reason,requested,before)=>energyEntries.push({reason,requested,applied:s.energy-before});
 const energyCost=resourceCost(action,s);s.energy-=energyCost;
 if(energyCost)energyEntries.push({reason:action,requested:-energyCost,applied:-energyCost});`);
rep('s.energy+=dodgeEnergy;', "{const before=s.energy;s.energy+=dodgeEnergy;if(dodgeResource&&s.hp>0&&s.bossHP>0)energyRecord('perfect_dodge',dodgeResource,before);}");
rep('if(s.hp>0&&s.bossHP>0)s.energy=Math.min(s.maxEnergy,s.energy+parryEnergy);', "if(s.hp>0&&s.bossHP>0){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+parryEnergy);if(parryEnergy)energyRecord(parryResult==='perfect'?'perfect_parry':'parry_refund',parryEnergy,before);}");
rep('s.energy+=s.guardEnergy;', "{const before=s.energy;s.energy+=s.guardEnergy;if(s.config.warriorActiveV2&&action==='guard'&&s.hp>0&&s.bossHP>0)energyRecord('guard',1,before);}");
rep('s.energy+=passiveEnergy;', "{const before=s.energy;s.energy+=passiveEnergy;energyRecord('divine_grace',1,before);}");
rep('if(s.turn%3===0&&s.hp>0&&s.bossHP>0)s.energy=Math.min(s.maxEnergy,s.energy+1);', "if(s.turn%(s.config.level>=50?2:3)===0&&s.hp>0&&s.bossHP>0){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+1);energyRecord('turn_recovery',1,before);}Object.assign(s.log[s.log.length-1],{energyStart,energyEnd:s.energy,energyEntries});");
// Curse counterplay is interruption or emergency evasion; no free cleanse action.
source=source.replaceAll("a.push('cleanse')","void 0");
// Presentation event only: does not change survival or damage rules.
rep('s.log.push({', 's.log.push({parryBlocked:action==="parry"&&parryAttempted?(s.parryBlockedThisTurn||0):0,lastStandTriggered:!!s.lastStand&&!original.lastStand,');
rep('mechanicDamage+=80;', "mechanicDamage+=require('./mechanic-rules.cjs').failureDamage(s);");
// Offer modifiers apply once to direct damage; curse and failure damage remain unchanged.
rep('damage=Math.min(damage,s.bossHP);', "const activeOffer=require('./devil-offer.cjs').effects(s);if(activeOffer)damage=Math.floor(damage*(1+(activeOffer.outgoing||0)));damage=Math.min(damage,s.bossHP);if(activeOffer)heal+=Math.floor(damage*(activeOffer.lifesteal||0));");
rep('incoming-=s.lastCounterReduction;blocked+=s.lastCounterReduction;', "incoming-=s.lastCounterReduction;blocked+=s.lastCounterReduction;if(activeOffer)incoming=Math.ceil(incoming*(1+(activeOffer.incoming||0)));");
rep("p==='normal'?[40+extra]:p==='heavy'?[90+extra]:", "p==='normal'?[['earth','nameless_succubus'].includes(s.config.boss)?require('./enrage-stages.cjs').values(s).normal:40+extra]:p==='heavy'?[['earth','nameless_succubus'].includes(s.config.boss)?require('./enrage-stages.cjs').values(s).heavy:90+extra]:");
// Prayer enchant: one persistent charge, spent only by a landed primary attack.
rep("s.lastPrayerResult=null;", "s.lastPrayerResult=null;s.enchantGranted=false;s.enchantConsumed=false;s.enchantRefreshed=false;");
rep("s.lastPrayerResult=q<.05?'weak':q<.81?'normal':'perfect';", "s.lastPrayerResult=q<.05?'weak':q<.81?'normal':'perfect';s.enchantRefreshed=!!s.attackEnchant;s.attackEnchant=1;s.enchantGranted=true;");
rep('damage=Math.min(damage,s.bossHP);', "if(job==='paladin'&&s.attackEnchant&&damage>0&&s.bossHP>0){damage=Math.floor(damage*1.1);s.attackEnchant=0;s.enchantConsumed=true;}damage=Math.min(damage,s.bossHP);");
rep('s.log.push({', 's.log.push({enchantGranted:s.enchantGranted,enchantRefreshed:s.enchantRefreshed,enchantConsumed:s.enchantConsumed,attackEnchant:s.attackEnchant||0,');
// Beginner progression: keep spent-use counters separate from legacy flags.
source=source.replaceAll('s.config.level>=10&&!s.emergencyUsed','(s.emergencyUses??Number(!!s.emergencyUsed))<(s.config.level>=100?2:1)');
source=source.replaceAll('s.config.level>=20&&!s.ultimateUsed','s.config.level>=10&&(s.ultimateUses??Number(!!s.ultimateUsed))<(s.config.level>=90?2:1)');
rep("if(action==='emergency_evade')s.emergencyUsed=true;", "if(action==='emergency_evade'){s.emergencyUses=(s.emergencyUses??Number(!!s.emergencyUsed))+1;s.emergencyUsed=s.emergencyUses>=(level>=100?2:1);}");
rep("if(action==='resonant_wave')s.ultimateUsed=true;", "if(action==='resonant_wave'){s.ultimateUses=(s.ultimateUses??Number(!!s.ultimateUsed))+1;s.ultimateUsed=s.ultimateUses>=(level>=90?2:1);}");
rep('s.config.level>=50?2:3','s.config.level>=30?2:3');
rep('s.hp===0&&level>=100&&!s.lastStand','s.hp===0&&level>=50&&!s.lastStand');
// Colossus Sandstorm: four subsequent combat turns, one debuff; reapply refreshes.
rep("dot=action==='emergency_evade'?0:s.marks*3;", "dot=s.config.boss==='earth'&&s.marks>0&&s.sandstormTurns>0&&action!=='emergency_evade'?Math.ceil(s.stats.hp*.05):0;");
rep("const requestedAction=action;", "s.sandstormApplied=false;s.sandstormExtraDamage=0;s.sandstormExpired=false;if(s.config.boss==='earth'&&s.marks>0&&s.sandstormTurns==null)s.sandstormTurns=4;const requestedAction=action;");
// Sandstorm direct multiplier is applied after all class mitigation below.
rep("else s.marks=Math.min(3,s.marks+1);", "else {s.marks=s.config.boss==='earth'?1:Math.min(3,s.marks+1);s.sandstormTurns=4;s.sandstormApplied=true;}");
rep("s.totals.evades+=evades;", "if(s.config.boss==='earth'&&s.marks>0&&!s.sandstormApplied){s.sandstormTurns=Math.max(0,(s.sandstormTurns||0)-1);if(!s.sandstormTurns){s.marks=0;s.sandstormExpired=true;}}s.totals.evades+=evades;");
rep("s.log.push({", "s.log.push({sandstormApplied:!!s.sandstormApplied,sandstormExpired:!!s.sandstormExpired,sandstormTurns:s.sandstormTurns||0,sandstormStacks:s.marks||0,sandstormExtraDamage:s.sandstormExtraDamage||0,");
rep('let critical=false;', 'let criticalTier=0,critical=false;');
rep('s.log.push({', 's.log.push({criticalTier,counterCritTier:s.lastCounterCritTier||0,');
source=require('./berserker-source.cjs')(source);
// Percent-max-HP Sandstorm bypasses old flat mark snapshots and class mitigation.
rep('if(dot>0)dot=B.bloodIncoming(s,snapshots.reduce((a,b)=>a+b,0));',"if(dot>0&&s.config.boss!=='earth')dot=B.bloodIncoming(s,snapshots.reduce((a,b)=>a+b,0));");
// Preparation is visible for a full turn before counterplay opens.
source=source.replaceAll("['mark_warning','mark'].includes(p)","(s.config.boss==='nameless_succubus'?['mark_prepare','mark'].includes(p):s.config.boss==='earth'?p==='mark':['mark_warning','mark'].includes(p))");
source=source.replaceAll("['struggle_start','struggle','struggle_end'].includes(p)&&", "(s.config.boss==='earth'?['struggle','struggle_end'].includes(p):['struggle_start','struggle','struggle_end'].includes(p))&&");
source=source.replace("B.isBerserker(s)&&p.startsWith('struggle')&&damage>0", "B.isBerserker(s)&&p.startsWith('struggle')&&(s.config.boss!=='earth'||p!=='struggle_start')&&damage>0");
source=source.replace("s.hp>0&&s.bossHP>0&&random(s)<.3){graceProc=true", "s.hp>0&&s.bossHP>0&&(incoming>0||s.lastMechanicDamage>0)&&random(s)<.4){graceProc=true");
rep("if(job==='paladin'&&s.attackEnchant&&damage>0&&s.bossHP>0){damage=Math.floor(damage*1.1);s.attackEnchant=0;s.enchantConsumed=true;}", "");
rep('let criticalTier=0,critical=false;if(damage>0){', "let criticalTier=0,critical=false;if(damage>0){if(job==='paladin'&&s.attackEnchant&&s.bossHP>0){damage+=Math.floor(s.stats.attack*.2);s.attackEnchant=0;s.enchantConsumed=true;}");

// Divine Grace mitigates the hit before HP loss; it no longer restores energy.
rep("let passiveEnergy=0,graceDamage=0,graceProc=false;", "let passiveEnergy=0,graceDamage=0;const graceProc=!!s.divineGraceProc,graceBlocked=s.divineGraceBlocked||0;");
rep("if(job==='paladin'&&!s.config.disableClassPassives&&!s.charmTurns&&s.hp>0&&s.bossHP>0&&(incoming>0||s.lastMechanicDamage>0)&&random(s)<.4){graceProc=true;passiveEnergy=Math.min(1,s.maxEnergy-s.energy);{const before=s.energy;s.energy+=passiveEnergy;energyRecord('divine_grace',1,before);}}", "");
rep('s.lastMechanicDamage=0;', 's.divineGraceProc=false;s.divineGraceBlocked=0;s.lastMechanicDamage=0;');
rep('s.hp=Math.max(0,s.hp-incoming-dot-mechanicDamage);', "if(job==='paladin'&&!s.config.disableClassPassives&&s.hp>0&&incoming>0&&random(s)<.4){s.divineGraceProc=true;if(s.config.uniqueRelic){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+1);energyRecord('divine_grace',1,before);}const remaining=Math.ceil(incoming*.6);s.divineGraceBlocked=incoming-remaining;blocked+=s.divineGraceBlocked;incoming=remaining;}s.hp=Math.max(0,s.hp-incoming-dot-mechanicDamage);");
rep('graceProc,graceDamage,passiveEnergy,', 'graceBlocked,graceProc,graceDamage,passiveEnergy,');

// Defense is a multiplier; preserve fractional DEF until the final hit is rounded.
rep('Math.max(1,Math.floor(raw*(1-support.damageReduction))-s.stats.defense-s.stats.mitigation-block)', 'Math.max(1,Math.floor(raw*(1-support.damageReduction)*100/(100+Math.max(0,B.isBerserker(s)?B.defense(s):s.stats.defense)))-s.stats.mitigation-block)');

source=require('./paladin-source.cjs')(source);
source=require('./warrior-source.cjs')(source);
// Amplify final direct damage once; DoT remains a separate max-HP loss.
rep('s.hp=Math.max(0,s.hp-incoming-dot-mechanicDamage);', "if(s.config.boss==='earth'&&s.marks>0&&s.sandstormTurns>0&&incoming>0){const beforeSandstorm=incoming;incoming=Math.ceil(incoming*120/100);s.sandstormExtraDamage=incoming-beforeSandstorm;}s.hp=Math.max(0,s.hp-incoming-dot-mechanicDamage);");
rep('damage=Math.min(damage,s.bossHP);', 'damage=Math.floor(damage*(1+(s.stats.damagePercent||0)/100));damage=Math.min(damage,s.bossHP);');
const ctx={module:{exports:{}},require:createRequire(__dirname+'/roles-engine.js'),structuredClone};vm.runInNewContext(source,ctx);const R=ctx.module.exports;
for(const [boss,first]of [['earth','normal'],['dark','normal'],['arcane','flurry'],['frost','flurry']])R.BOSSES[boss].patterns=[first,'warning','heavy','mark_warning','mark','normal','struggle_start','struggle','struggle_end','opening'];
R.BOSSES.nameless_succubus={...R.BOSSES.earth,name:'Nameless Succubus',patterns:[...R.BOSSES.earth.patterns]};
const director=require('./pattern-director.cjs'),offer=require('./devil-offer.cjs');
function create(config,seed){const s=R.create(config,seed);if(config.job==='spellblade')s.stats.evasion=Math.min(80,(config.baseEvasion??40)+(config.gearEvasion??20));if(config.disableEvasionForDiagnostic)s.stats.evasion=0;if(config.randomPatterns){director.init(s);offer.init(s);}if(['earth','nameless_succubus'].includes(s.config.boss)){s.bossMaxHP=require('../raid-boss-health').maximum(s.config.boss);s.bossHP=s.bossMaxHP;}return s;}
function step(s,...args){if(offer.pending(s))return offer.resolve(s,...args);if(String(args[0]).startsWith('offer_'))throw Error('Unavailable offer action');let input=s;if(require('./pattern-profiles.cjs').active(s)){input=structuredClone(s);require('./pattern-profiles.cjs').ensure(input);offer.ensureEffects(input);}if(s.config.boss==='earth'&&!require('./pattern-profiles.cjs').active(s)&&s.director?.phase==='enrage'){input=structuredClone(s);const stages=require('./enrage-stages.cjs');stages.enter(input);delete input.director.pendingEnrageLevel;input.berserkerGroggy=0;}const next=R.step(input,...args);if(next.turn!==s.turn){const resolved=next.log.at(-1);if(resolved){if(resolved.phase.startsWith('struggle')&&resolved.struggleSkills>=2)resolved.shockwaveInterrupted=true;resolved.bossEnrageLevel=input.director?.enrageLevel||0;resolved.groggyRemaining=resolved.phase==='opening'?(s.berserkerGroggy||1+(s.director?.queue||[]).filter(x=>x==='opening').length):0;}offer.afterCombat(s,next);if(s.config.boss==='earth')require('./pattern-profiles.cjs').recordCombat(s,next);}if(next.director&&next.turn!==s.turn){const l=next.log.at(-1);l.hand=s.director.hand;if(input.config.boss==='nameless_succubus'&&require('./pattern-profiles.cjs').active(input))l.comboIndex=l.phase==='normal'?(input.director.comboIndex||1):0;if(s.config.boss==='earth'){l.patternKind=s.director.patternKind;l.rampageStrike=s.director.rampageStrike||0;}if(next.status==='active'){if(!require('./pattern-profiles.cjs').active(s)&&s.config.boss!=='earth'&&s.config.job==='berserker'&&(s.berserkerGroggy>0||l.berserker?.action==='berserker_ultimate')){next.director.queue=next.berserkerGroggy>1?['opening']:[];next.director.phase=next.berserkerGroggy>0?'opening':'normal';next.director.hand='right';}else director.advance(next,l);}}return next;}
// Diagnostic automation only: never select retired actions or unavailable skills.
// Live Discord battles still use actions()/step() and do not call this chooser.
function choose(s,mode){
 const available=offer.pending(s)?offer.actions(s):R.actions(s);
 if(!available.length)throw Error('No legal diagnostic actions');
 const p=R.phase(s);
 if(mode==='handle'&&s.marks>0&&!['struggle_start','struggle','struggle_end'].includes(p)&&available.includes('cleanse'))return 'cleanse';
 const preferred=R.policy(s);
 if(available.includes(preferred))return preferred;
 if(preferred==='guard'&&s.config.job==='warrior'&&available.includes('parry'))return 'parry';
 return available.includes('attack')?'attack':available.find(a=>a!=='retreat')||available[0];
}
module.exports={...R,create,choose,step,actions:s=>offer.pending(s)?offer.actions(s):R.actions(s)};


