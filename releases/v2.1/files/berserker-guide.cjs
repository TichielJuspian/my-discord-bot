'use strict';
const B=require('./raid-engine/berserker-rules.cjs');
const percent=n=>Math.round(n*100);
module.exports=function rows(s,page){
 const level=s.config.level;
 const row=(name,lv,cost,pose,lines,icon='sword')=>({name,lv,cost,pose,lines,icon});
 if(page==='passives')return [
  row('Enrage',1,'AUTOMATIC / NO ENERGY / NO ACTION','enrage-idle',[
   'At HP ≤ min(60, 50 + DEF × 0.1)%:',
   'ATK +'+percent(B.ENRAGE_ATTACK_MULTIPLIER-1)+'% for attacks and Ragnarok.',
   'Direct damage taken -60%.'
  ],'enrage'),
  row('Energy Recovery',1,'AUTOMATIC / NO ACTION','idle',[
   'Recover 1 energy at the end of every 3 turns.',
   'Requires both combatants to remain alive; capped at max energy.'
  ],'energy')];
 if(page==='advanced')return [
  row('Emergency Evade',0,'FREE / '+(level>=100?'1 SUCCUBUS / 2 LEGACY USES':'1 USE PER BATTLE'),'evade-white',[
   'Avoid direct attacks and mechanic-failure damage this turn.',
   'Consumes your action; preserves all charge. No success roll.',
   'Prevents new curse application this turn; existing curses remain.',
   'One use from the start; a second use unlocks at level 100.'
  ],'wind'),
  row('Ragnarok',10,(level>=90?2:1)+' USES PER BATTLE','ultimate-white',[
   'DMG: 550% ATK; consumes all charge.',
   'Cancels the current attack, Curse Cast and Mechanic.',
   'Succubus attack turn: 2 Groggy actions; recast 1.',
   'During Groggy: no boss attack; DMG +50%.',
   'Succubus defense cast: no follow-up actions.',
   'Legacy: Groggy lasts 1 turn.'
  ],'star'),
  row('Improved Recovery',30,'AUTOMATIC / NO ACTION','idle',[
   'Recover 1 energy every 2 turns instead of every 3.',
   'Active automatically from level 30. Energy is capped.'
  ],'energy'),
  row('Last Stand',50,'AUTOMATIC / ONCE PER BATTLE','last_stand',[
   'Survive one lethal hit with exactly 1 HP.',
   '100% activation when eligible; no energy cost or action.',
   'Available from level 50; does not heal afterward.',
   'Cannot activate while class passives are sealed.'
  ],'shield')];
 return [
  row('Basic Attack',1,'NORMAL: FREE / INTERRUPT STRIKE: 1 ENERGY','attack',[
   'DMG: '+percent(B.MULTIPLIERS[0])+'% ATK.',
   'Normal attack: +1 Energy in Succubus.',
   'Succubus Interrupt Strike: consume 1 Energy to interrupt Curse Cast / Mechanic.'
  ]),
  row('Charge',1,'FREE / USES YOUR ACTION','charge-2',[
   'Gain 1 charge stage (Max 3).',
   'Two consecutive normal hits break charge.',
   'Heavy/special hits break charge; Tackle prevents charge loss.'
  ],'energy'),
  row('Charged Attack',1,'FREE / USES YOUR ACTION','charged-attack-3',[
   'Stage 1: '+percent(B.MULTIPLIERS[1])+'% ATK.',
   'Stage 2: '+percent(B.MULTIPLIERS[2])+'% ATK; heal 1% of actual damage.',
   'Stage 3: '+percent(B.MULTIPLIERS[3])+'% ATK; heal 4% of actual damage.',
   'Curse Cast / Mechanic progress: Stage 1 +1; Stages 2/3 +2.'
  ]),
  row('Tackle',1,'FREE / USES YOUR ACTION','tackle-charge-2',[
   '+1 Energy.',
   'Direct damage taken -40% this turn.',
   'Preserves charge against all hits.',
   'Taking a heavy hit grants 1 charge stage.',
   'Does not reduce failed-mechanic damage.'
  ],'shield'),
  row('Blood Draw',1,'ABSORB UP TO '+B.BLOOD_DRAW_MAX_ENERGY+' ENERGY / USES YOUR ACTION','blood-transfusion',[
   'Current HP -25% (nonlethal).',
   'Crit Chance +'+B.BLOOD_DRAW_CRIT_PER_ENERGY+'% per Energy absorbed.',
   'Next Basic Attack or Charged Attack consumes this effect.',
   'Gain 1 charge stage per '+B.BLOOD_DRAW_ENERGY_PER_CHARGE+' Energy absorbed.'
  ],'potion')];
};
