'use strict';
const crypto = require('node:crypto');
const R = require('../raid-engine/progression-combat.cjs');
const {config} = require('../raid-test-build.js');
const JOBS = ['warrior', 'paladin', 'berserker'];
const BOSSES = ['earth', 'nameless_succubus'];
const LEVELS = [1, 30, 70];
const SEEDS = [1, 37, 271];
const ACTIONS = {
  warrior: ['slash','parry','slash','thrust','attack','parry','slash','thrust','emergency_evade','slash','thrust','resonant_wave'],
  paladin: ['prayer','smash','attack','prayer','smash','guard','resonant_wave','smash','emergency_evade','attack'],
  berserker: ['charge','charge','shoulder_tackle','charge','attack','blood_transfusion','charge','attack','berserker_ultimate'],
};
function allCases() {
  const out = [];
  for (const job of JOBS) for (const boss of BOSSES) for (const level of LEVELS) for (const seed of SEEDS)
    out.push({job, boss, level, seed, key:`${job}:${boss}:${level}:${seed}`});
  return out;
}
function manualRun({job,boss,level,seed}) {
  // Direct fixed input stream independent of the diagnostic chooser. This tests the actual combat rules.
  let s = R.create(config(job,level,0,boss),seed);
  const history = [];
  for (let i=0; i<20 && s.status==='active'; i++) {
    const allowed = R.actions(s);
    if (!Array.isArray(allowed) || !allowed.length) throw Error('No actions at turn '+s.turn);
    const wanted = ACTIONS[job][i%ACTIONS[job].length];
    const action = allowed.includes(wanted) ? wanted : allowed.includes('attack') ? 'attack' : (allowed.find(x=>x!=='retreat') || 'retreat');
    const next = R.step(s,action);
    history.push({
      turn:s.turn, action, hp:next.hp, energy:next.energy, bossHP:next.bossHP,
      damage:next.totals.damage, status:next.status,
      enrage:next.director?.enrageLevel??null, charge:next.berserkerCharge??null,
      hone:next.hone??null, blessing:next.paladinBlessing??null,
      last:next.log.at(-1)?{
        phase:next.log.at(-1).phase, damage:next.log.at(-1).damage,
        incoming:next.log.at(-1).incoming, parry:next.log.at(-1).parryResult??null,
      }:null,
    });
    s = next;
  }
  return {
    turns:history.length, finished:s.status, finalDamage:s.totals.damage,
    traceHash:crypto.createHash('sha256').update(JSON.stringify(history)).digest('hex'),
  };
}
module.exports = {allCases, manualRun, R, config};
