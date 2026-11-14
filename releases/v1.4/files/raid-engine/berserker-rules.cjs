'use strict';

// Standalone class rules. The host engine owns boss balance, turns and RNG.
const MULTIPLIERS = Object.freeze([1, 1.5, 2.5, 5]);
const isBerserker = s => s.config?.job === 'berserker';
const stage = s => Math.max(0, Math.min(3, Math.floor(s.berserkerCharge || 0)));
const enrageThreshold = s => Math.min(60, 50 + defense(s) * .1);
const enraged = s => isBerserker(s) && !s.config.disableClassPassives && s.hp > 0 && s.hp * 100 <= s.stats.hp * enrageThreshold(s);
const names = ['Attack', 'Charged Attack', 'Charged Heavy Attack', 'Grand Attack'];

function actions(s) {
  if (s.status !== 'active') return [];
  const out = ['blood_transfusion', 'shoulder_tackle', 'retreat'];
  if(s.energy>=cost('attack',s))out.unshift('attack');
  if (stage(s) < 3 && s.energy>=cost('charge',s)) out.push('charge');
  if ((s.emergencyUses ?? Number(!!s.emergencyUsed)) < (s.config.level >= 100 ? 2 : 1)) out.push('emergency_evade');
  if (s.config.level >= 10 && (s.ultimateUses ?? Number(!!s.ultimateUsed)) < (s.config.level >= 90 ? 2 : 1)) out.push('berserker_ultimate');
  return out;
}
function cost(action,s) {
  return 0;
}
function begin(s, action) {
  const charge = stage(s), rage = enraged(s); delete s.tackleDefenseTurns; delete s.berserkerNextChargeBonus;
  // Retire pre-rework persistent effects from restored battles.
  delete s.bloodDrawTurns; delete s.bloodDrawBonus;
  s.berserkerCurseDamage ??= Array(s.marks || 0).fill(3);
  const event = {action, chargeBefore: charge, enrage: rage, released: 0, selfDamage: 0, energyGain: 0, bloodBonusDamage: 0};
  if (action === 'charge') { s.berserkerCharge=Math.min(3,charge+1); }
  else if (action === 'berserker_ultimate') { s.berserkerCharge = 0; }
  else if (action === 'attack') { event.released = charge; s.berserkerCharge = 0; }
  else if (action === 'blood_transfusion') {
    event.selfDamage=Math.min(Math.max(0,s.hp-1),Math.ceil(s.hp*.25));
    event.absorbedEnergy=Math.max(0,s.energy);
    s.energy=0;
    // Recasting replaces the pending bonus; it never stacks.
    s.berserkerBloodEnergy=event.absorbedEnergy;
    s.berserkerCharge=Math.min(3,charge+Math.floor(event.absorbedEnergy/2));
    event.chargeGained=stage(s)-charge;
  } else if (!['shoulder_tackle','emergency_evade','charmed'].includes(action)) s.berserkerCharge=0;
  event.finisher=action==='berserker_ultimate'||(action==='attack'&&event.released===3);
  if(action==='attack'&&event.released===3){event.bloodEnergyUsed=s.berserkerBloodEnergy||0;s.berserkerBloodEnergy=0;}
  s.berserkerEvent = event;
  return event;
}
function afterAttack(s){}
function outgoing(s, damage) {
  const e = s.berserkerEvent;
  if (!e || damage <= 0) return damage;
  e.enrage = enraged(s);
  e.bloodBonusDamage=0;
  return Math.floor(damage);
}
// Keep base ATK unchanged; round only when the existing damage pipeline does.
function effectiveAttack(s) { return s.stats.attack * (enraged(s) ? 1.8 : 1); }
function attackMultiplier(s) {
  const e = s.berserkerEvent;
  return e?.action === 'berserker_ultimate' ? 5.5 : MULTIPLIERS[e?.released || 0];
}
function bloodIncoming(s, amount) {
  return amount;
}
function incoming(s, amount, {physical = false, curseSnapshot = false, blood = true} = {}) {
  const e = s.berserkerEvent;
  if (!e || curseSnapshot || amount <= 0) return amount;
  // Re-evaluate after HP costs or lifesteal instead of retaining turn-start HP.
  let numerator = enraged(s)?40:100, denominator=100;
  if (e.action === 'shoulder_tackle') { numerator *= 60; denominator *= 100; }
  return Math.ceil(amount * numerator / denominator);
}
function interruptWeight(s) {
  const e = s.berserkerEvent;
  return e?.action === 'berserker_ultimate' ? 2 : e?.released >= 2 ? 2 : e?.released === 1 ? 1 : 0;
}
function finish(s, {damage = 0, dealtDamage = damage, incomingDamage = 0, heavyOrSpecial = false, normalHit = false} = {}) {
  const e = s.berserkerEvent;
  if (!e) return null;
  const turn=s.turn;
  if(e.action==='shoulder_tackle'||!normalHit||incomingDamage<=0||!stage(s))delete s.berserkerNormalHitTurn;
  else {
    if(s.berserkerNormalHitTurn===turn-1){s.berserkerCharge=0;e.chargeBroken=true;delete s.berserkerNormalHitTurn;}
    else s.berserkerNormalHitTurn=turn;
  }
  if (heavyOrSpecial && incomingDamage > 0 && e.action !== 'shoulder_tackle') {e.chargeBroken=stage(s)>0;s.berserkerCharge = 0;delete s.berserkerNormalHitTurn;}
  if (e.action==='shoulder_tackle' && s.log.at(-1)?.phase==='heavy' && incomingDamage>0 && s.hp>0 && !s.log.at(-1)?.lastStandTriggered) s.berserkerCharge=Math.min(3,stage(s)+1);
  if(e.finisher && (s.config.berserkerFinisherRelic||s.config.berserkerTackleRelic) && s.hp>0){const before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+2);e.relicEnergyGain=s.energy-before;}
  if(s.log.at(-1)?.lastStandTriggered)s.berserkerCharge=0;
  let lifesteal = 0;
  if (e.released >= 2 && damage > 0 && s.hp > 0) {
    lifesteal = Math.min(healCapacity(s), Math.floor(damage * (e.released === 3 ? .04 : .01)));
    s.hp += lifesteal;
    s.totals.healing += lifesteal;
  }
  const bloodBonusDamage = Math.min(e.bloodBonusDamage || 0, Math.max(0, dealtDamage - (e.bloodScaledDamage || 0)));
  return {...e, bloodBonusDamage, chargeAfter: stage(s), lifesteal, attackName: names[e.released || 0]};
}
function pose(s) {
  const l = s.log.at(-1) || {}, e = l.berserker || s.berserkerEvent || {};
  if (s.hp <= 0) return 'exhausted';
  if (l.emergencyEvaded) return 'evade-white';
  if (e.action === 'berserker_ultimate') return 'ultimate-white';
  const prefix = enraged(s) ? 'enrage-' : '';
  if (e.chargeBroken) return prefix+'hit';
  if (e.action === 'shoulder_tackle') return prefix + (e.chargeBefore ? 'tackle-charge-' + e.chargeBefore : 'tackle');
  if (e.action === 'blood_transfusion') return prefix + 'blood-transfusion';
  if (e.action === 'charge') return prefix + (stage(s) ? 'charge-' + stage(s) : 'hit');
  if (e.action === 'attack') return prefix + (e.released ? 'charged-attack-' + e.released : 'attack');
  if (l.incoming > 0 || l.mechanicDamage > 0) return prefix + 'hit';
  return prefix + 'idle';
}
function healCapacity(s){return Math.max(0,s.stats.hp-s.hp);}
function defense(s){return s.stats.defense;}
// Blood Draw is a separate guaranteed-critical proc, not a raw chance bonus.
function critBonus(s){return 0;}
function bloodCritChance(s){const e=s.berserkerEvent;return e?.action==='attack'&&e.released===3?Math.min(100,(e.bloodEnergyUsed||0)*10):0;}
module.exports = {enrageThreshold,bloodCritChance,afterAttack,healCapacity,defense,critBonus,MULTIPLIERS, isBerserker, stage, enraged, names, actions, cost, begin, outgoing, effectiveAttack, attackMultiplier, incoming, bloodIncoming, interruptWeight, finish, pose};
