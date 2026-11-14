'use strict';
const R=require('./raid-engine/progression-combat.cjs');
const LEVELS=[1,10,20,30,40,50,60,70,80,90,100];
function config(job,level,upgrade=0,boss='earth'){
 if(!['warrior','paladin','berserker'].includes(job)||!Number.isInteger(level)||level<1||level>100||![0,5,10,20].includes(upgrade)||!Object.hasOwn(R.BOSSES,boss))throw Error('Invalid test build');
 return {job,renewalAttack:0,level,boss,randomPatterns:true,warriorActiveV2:true,warriorParryChance:.95,power:0,focus:0,ruin:0,enhancements:{weapon:upgrade,armor:upgrade,accessory:upgrade}};
}
function preview(job,level,upgrade=0,boss='earth'){const s=R.create(config(job,level,upgrade,boss),1);return {level,attack:s.stats.attack,hp:s.stats.hp,defense:s.stats.defense,crit:s.stats.crit,energy:s.maxEnergy};}
function summary(level,upgrade,boss){return ['warrior','paladin','berserker'].map(job=>{const p=preview(job,level,upgrade,boss);return '**'+(job==='berserker'?'Berserker':job==='paladin'?'Paladin':'Blader')+'** · ATK '+p.attack+' · HP '+p.hp+' · DEF '+p.defense+' · Crit '+Math.min(100,p.crit)+'% · Energy '+p.energy;}).join('\n');}
module.exports={LEVELS,config,preview,summary};
