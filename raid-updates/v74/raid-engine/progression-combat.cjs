'use strict';
const R=require('./gimmick-trial-engine.cjs'),P=require('./slot-progression.cjs');
const SKILL_TUNING={warrior:{counterExtraPerLevel:.5},paladin:{},spellblade:{arcanePerLevel:1},berserker:{burstExtraPerLevel:3}};
const JOBS=structuredClone(R.JOBS);
const GROWTH=Object.fromEntries(['warrior','paladin','berserker'].map(job=>[job,{attack:1,hp:2,defense:.2,crit:.5}]));
for(const [job,g]of Object.entries(GROWTH)){JOBS[job].growth={...g};JOBS[job].base.hp=300;}
JOBS.warrior.base.attack=10;
// Three aggregate slots are provisional; named items remain unimplemented.
function budget(level){if(!Number.isSafeInteger(level)||level<1||level>100)throw Error('Invalid level');return 0;}
const retiredOptions=['warriorEvolutionWeapon','warriorLowHPArmor','paladinHammerRefund','paladinBlessingRelic','uniqueRelic','berserkerFinisherRelic','berserkerTackleRelic'];function retire(s){for(const k of retiredOptions)s.config[k]=false;return s;}
function create(config={},seed){
 const unarmed=config.noEquipment!==false;
 const level=config.level??1;config={...config,power:0,focus:0,ruin:0};const investment=[0,0,0];
 if(investment.some(n=>!Number.isSafeInteger(n)||n<0)||investment.reduce((a,b)=>a+b,0)>budget(level))throw Error('Invalid candidate allocation');
 config={...config,enableBerserkerFrenzy:config.enableBerserkerFrenzy??true,skillTuning:config.skillTuning??SKILL_TUNING[config.job??'warrior'],ruinPercentPerPoint:config.ruinPercentPerPoint??1,tieredCritical:true};
 if(![1,2].includes(config.ruinPercentPerPoint))throw Error('Invalid critical damage rate');
 config={...config,baseEvasion:config.baseEvasion??10+Math.floor((level-1)/3)};
 config={...config,attackRage:config.attackRage??5,turnRage:config.turnRage??3};
 config={...config,counterChance:config.counterChance??.6};
 if((config.job??'warrior')==='warrior')config={...config,counterCrit:config.counterCrit??true,counterLevelScale:config.counterLevelScale??0,counterAttackRatio:config.counterAttackRatio??.3,counterDefenseRatio:config.counterDefenseRatio??.3};
 if(config.counterBase!==undefined&&(!Number.isSafeInteger(config.counterBase)||config.counterBase<0))throw Error('Invalid counter damage');
 if(!Number.isFinite(config.counterChance)||config.counterChance<0||config.counterChance>1)throw Error('Invalid counter chance');
 if(config.renewalAttack===undefined&&config.renewalPerLevel===undefined)config.renewalAttack=Math.min(25,level);
 if(config.renewalAttack!==undefined&&(!Number.isSafeInteger(config.renewalAttack)||config.renewalAttack<0))throw Error('Invalid renewal attack');
 if(![config.attackRage,config.turnRage].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100))throw Error('Invalid rage gain');
 if(unarmed)config={...config,gear:'starter',gearEvasion:0};
 const b=P.bonuses(config.enhancements),s=R.create({...config,spellbladeCritMultiplier:config.spellbladeCritMultiplier??1.2},seed);
 const g={...R.GEAR[s.config.gear],...(s.config.job==='spellblade'?R.SPELLBLADE_GEAR[s.config.gear]:{})};
 // Reduce basic equipment contributions by25%; class-specific effects stay unchanged.
 for(const k of ['attack','hp','defense'])s.stats[k]-=unarmed?g[k]:g[k]-Math.floor(g[k]*.75);
 for(const k of Object.keys(b))s.stats[k]=(s.stats[k]??0)+b[k];
 const job=s.config.job,n=level-1;
 // Level 1 keeps existing class base DEF and base ATK; growth is shared.
 s.stats.attack=10+n+b.attack+(unarmed?0:Math.floor(g.attack*.75));
 s.stats.hp=300+2*n+b.hp+(unarmed?0:Math.floor(g.hp*.75));
 s.stats.defense=Number((R.JOBS[job].base.defense+n*.2+b.defense+(unarmed?0:Math.floor(g.defense*.75))).toFixed(1));
 s.stats.crit=5+n*.5+b.crit+(unarmed?0:g.crit);
 s.stats.critDamagePercent=b.critDamagePercent;
 s.stats.critFlat=0;
 s.stats.evasion=b.evasion;
 s.hp=s.stats.hp;s.baseHP=s.stats.hp;s.enhancements=P.levels(config.enhancements);s.dailyTier=P.dailyTier(s.config.level);s.loadout=unarmed?'unarmed':s.config.gear;
 return retire(s);
}
function run(config,seed=1){let s=create(config,seed);while(s.status==='active'){if(s.turn>500)throw Error('Diagnostic fuse');s=R.step(s,R.choose(s,'handle'));}return s;}
module.exports={...R,JOBS,SKILL_TUNING,budget,create,run,step:(s,...args)=>R.step(retire(structuredClone(s)),...args)};
