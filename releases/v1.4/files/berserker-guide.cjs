'use strict';
module.exports=function rows(s,page){
 const level=s.config.level;
 const row=(name,lv,cost,pose,lines,icon='sword')=>({name,lv,cost,pose,lines,icon});
 if(page==='passives')return [
  row('Enrage',1,'AUTOMATIC / NO ENERGY / NO ACTION','enrage-idle',[
   'While HP percentage is at or below min(60, 50 + current DEF x 0.1):',
   'ATK +80% (x1.8) for attacks and Ragnarok. Base ATK display is unchanged.',
   'Direct Damage Taken: -60%. No CRIT bonus.',
   '[Exception] Failed mechanics bypass mitigation.'
  ],'enrage'),
  row('Energy Recovery',1,'AUTOMATIC / NO ACTION','idle',[
   'Recover 1 energy at the end of every 3 turns.',
   'Requires both combatants to remain alive; capped at max energy.'
  ],'energy')];
 if(page==='advanced')return [
  row('Emergency Evade',0,'FREE / '+(level>=100?2:1)+' USES PER BATTLE','evade-white',[
   'Avoid direct attacks and mechanic-failure damage this turn.',
   'Consumes your action; preserves all charge. No success roll.',
   'Prevents new curse application this turn; existing curses remain.',
   'One use from the start; a second use unlocks at level 100.'
  ],'wind'),
  row('Ragnarok',10,(level>=90?2:1)+' USES PER BATTLE','ultimate-white',[
   'Base damage: 550% ATK. Charge does not increase damage.',
   'Can critically hit; vulnerability affects final damage.',
   'Cancels the current attack and mechanic resolution; consumes the current charge.',
   'Boss enters Groggy for the next 1 turn. Recasting refreshes to 1.',
   'Groggy: no boss attack and +50% damage taken for 1 turn.',
   'Then 1 Recovery turn: no boss attack, normal damage taken.',
   'Groggy and Recovery finish before the next boss transformation.',
   'Does not cleanse existing curses.',
   'One use; a second unlocks at level 90.'
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
  row('Charge',1,'ALL STAGES FREE / USES YOUR ACTION','charge-2',[
   'Builds 1 charge stage per use (Max: Stage 3).',
   'Taking normal attacks on 2 consecutive turns breaks your charge. Tackle prevents this.',
   '[Disrupt] Taking a heavy/special hit breaks your charge. Can be prevented via Tackle.'
  ],'energy'),
  row('Charged Attack',1,'ALL STAGES FREE','charged-attack-3',[
   '[Scaling] Damage scales by stage:',
   'No Charge: 100% ATK',
   'Stage 1: 150% ATK',
   'Stage 2: 250% ATK',
   'Stage 3: 500% ATK',
   'Critical chance caps at 100%; excess chance adds equal percentage points of critical damage once.',
   'Can interrupt curse casting and counts toward boss mechanics.',
   'Stage 1 counts as 1 special hit; Stage 2 or 3 provides 2 hits for special mechanics.',
   'Stage 2 heals 1%; Stage 3 heals 4% of actual damage dealt.'
  ]),
  row('Tackle',1,'FREE / +1 ENERGY / USES YOUR ACTION','tackle-charge-2',[
   'Gain: +1 Energy.',
   'Reduces direct damage taken by 40% this turn.',
   'Preserves charge against all hits, including normal, heavy and special attacks.',
   '[Exception] Does not reduce failed-mechanic damage.',
   '[Counter] Taking a heavy hit during Tackle adds +1 charge (Capped at Stage 3).'
  ],'shield'),
  row('Blood Draw',1,'CURRENT HP -25% / ABSORB ALL ENERGY','blood-transfusion',[
   'Pay 25% of current HP (rounded up). This cost cannot kill you.',
   'Consumes all remaining energy: 10% guaranteed-critical proc chance per energy (max 100%).',
   '[Limit] Applies only to the next Grand Attack (Stage 3), then the effect is consumed.',
   'Immediately gains 1 charge stage per 2 energy absorbed (Max: Stage 3).',
   'Separate proc: on failure, use normal critical chance. Recasting replaces this effect.'
  ],'potion')];
};
