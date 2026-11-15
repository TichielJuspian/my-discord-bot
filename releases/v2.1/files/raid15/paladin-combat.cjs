'use strict';
const { secondNormalHitDamage } = require('./succubus-second-hit.cjs');

// Isolated v1.5 adapter. The production Paladin rules and progression modules
// are read-only dependencies; this module never imports a player store or DB.
const path = require('node:path');
const { createCombat } = require('./combat.cjs');

const ATTACK_ACTIONS = Object.freeze(['attack', 'smash', 'blessing', 'ultimate']);
const DEFENSE_ACTIONS = Object.freeze(['guard', 'magic_guard', 'attack', 'smash', 'blessing', 'heal', 'ultimate', 'emergency_evade']);
// Explicit owner decision: matching guards reduce 50%; Heal precedes damage.
// Passing null for a field intentionally leaves that action staged/disabled.
const APPROVED_POLICY = Object.freeze({ guardPhysicalReduction: .5, guardMagicReduction: .5, healTiming: 'before_damage' });
// Shared duration contract: offense2 / DEF3 real rounds. Legacy grants one
// extra action tick so its immediate finish preserves the same visible counts.
const BLESSING_DURATION = require('../raid-engine/paladin-rules.cjs').BLESSING_DEFENSE_DURATION;
const HEAL_BASE = 70, HEAL_DEF_RATIO = .3;
const nativeAction = action => action === 'ultimate' ? 'resonant_wave' : action === 'blessing' ? 'prayer' : action;
const isAttackAction = action => ['attack', 'smash', 'ultimate'].includes(action);
const isSupport = action => ['blessing', 'heal'].includes(action);
const defensePhase = state => ['defense', 'gimmick_a', 'gimmick_b'].includes(state.phase);
const healAmount = defense => {
  if (!Number.isFinite(defense) || defense < 0) throw new RangeError('Nonnegative effective DEF required');
  return Math.floor(HEAL_BASE + defense * HEAL_DEF_RATIO);
};

function createPaladinCombat({ root = path.join(__dirname, '..'), random = null, policy = {} } = {}) {
  const settings = { ...APPROVED_POLICY, ...policy };
  for (const key of ['guardPhysicalReduction', 'guardMagicReduction']) {
    if (settings[key] !== null && (!Number.isFinite(settings[key]) || settings[key] < 0 || settings[key] > 1)) throw new RangeError('Guard reduction must be null or 0..1');
  }
  if (![null, 'before_damage', 'after_damage_if_alive'].includes(settings.healTiming)) throw new RangeError('Explicit Heal timing required');
  const load = file => require(path.join(root, file));
  const Legacy = load('raid-engine/progression-combat.cjs');
  const Build = load('raid-test-build.js');
  const P = load('raid-engine/paladin-rules.cjs');
  const Crit = load('raid-engine/critical-rules.cjs');
  const Offer = load('raid-engine/devil-offer.cjs');
  const Stages = load('raid-engine/enrage-stages.cjs');
  const Mechanic = load('raid-engine/mechanic-rules.cjs');
  const common = createCombat({ root, random });
  const roll = common.roll;
  const cost = (s, action) => action === 'heal' ? 2 : Legacy.resourceCost(action === 'magic_guard' ? 'guard' : nativeAction(action), s);

  function create({ level = 40, enhancement = 0, seed = 1 } = {}) {
    const s = Legacy.create(Build.config('paladin', level, enhancement, 'nameless_succubus'), seed);
    s.maxEnergy = 5 + (s.maxEnergy - 3);
    s.energy = s.maxEnergy;
    s.energyRecoveryInterval = level >= 30 ? 1 : 2;
    s.turn = 0;
    s.phase = 'new';
    s.director.phase = 'idle';
    s.director.queue = [];
    s.director.combatActions = 0;
    s.director.patternReadyAt = {};
    s.offer = null;
    s.offerEffects = null;
    s.raidId = 'raid15-isolated';
    s.buffs = [];
    return s;
  }

  function disabledReason(s, action) {
    if (s.status !== 'active' || s.config.job !== 'paladin') return 'Battle is not active';
    if (!DEFENSE_ACTIONS.includes(action)) return 'Unsupported Paladin action';
    if (action === 'emergency_evade') return s.emergencyUsed || s.emergencyUses > 0 ? 'Used this battle' : null;
    if (action === 'guard' || action === 'magic_guard') {
      const key = action === 'guard' ? 'guardPhysicalReduction' : 'guardMagicReduction';
      return settings[key] === null ? 'Guard rate awaiting approval' : null;
    }
    if (action === 'heal') {
      if (!defensePhase(s)) return 'Defense turn only';
      if (settings.healTiming === null) return 'Heal timing awaiting approval';
      return s.energy < 2 ? 'Needs 2 energy' : null;
    }
    if (action === 'ultimate') {
      if (s.config.level < 10) return 'Unlocks at level 10';
      if ((s.ultimateUses ?? Number(!!s.ultimateUsed)) >= (s.config.level >= 90 ? 2 : 1)) return 'No Ultimate uses remaining';
    }
    const cost = Legacy.resourceCost(nativeAction(action), s);
    if (s.energy < cost) return 'Needs ' + cost + ' energy';
    return Legacy.actions(s).includes(nativeAction(action)) ? null : 'Skill is unavailable';
  }
  const available = (s, action) => disabledReason(s, action) === null;

  function begin(s, action) {
    P.begin(s, action, () => roll(s));
    if (action === 'prayer') { s.protectionTurns = P.BLESSING_DEFENSE_DURATION; s.smiteBlessingTurns = P.BLESSING_OFFENSE_DURATION; }
  }

  function finish(s, action, damage) {
    // P.finish restores temporary stats and writes the verified Paladin event.
    // Its v1.4 action tick is restored here; only endRound may decay duration.
    const protection = s.protectionTurns || 0;
    const offense = P.offensiveTurns(s);
    const stacks = s.smiteBlessingStacks || 0;
    P.finish(s, action, damage);
    s.protectionTurns = protection;
    s.smiteBlessingTurns = offense;
    s.smiteBlessingStacks = stacks;
    Object.assign(s.log.at(-1).paladin, { protectionTurns: protection, smiteBlessingTurns: offense, smiteBlessingStacks: P.stacks(s) });
    if (s.hp <= 0) s.status = 'defeated';
    else if (s.bossHP <= 0) s.status = 'victory';
  }

  function attack(original, action, { reaction = 'hit', opening = false } = {}) {
    if (!ATTACK_ACTIONS.includes(action) || !available(original, action)) throw new Error('Unavailable Paladin attack');
    if (!['hit', 'guard', 'evade'].includes(reaction)) throw new RangeError('Unknown boss reaction');
    const s = structuredClone(original);
    const requested = nativeAction(action);
    // Blessing is a utility cast, not one of the legacy Charm-blockable attacks.
    const charmed = (s.roundCharm || 0) > 0 && isAttackAction(action) && roll(s) < .3;
    const actual = charmed ? 'charmed' : requested;
    const beforePassives = s.config.disableClassPassives;
    if (s.roundCharm > 0) s.config.disableClassPassives = true;
    const energyStart = s.energy;
    const cost = Legacy.resourceCost(actual, s);
    s.energy -= cost;
    begin(s, actual);
    if (actual === 'resonant_wave') {
      s.ultimateUses = (s.ultimateUses ?? Number(!!s.ultimateUsed)) + 1;
      s.ultimateUsed = s.ultimateUses >= (s.config.level >= 90 ? 2 : 1);
    }
    let damage = actual === 'attack' ? s.stats.attack
      : actual === 'smash' ? Math.floor(s.stats.attack * 2.2 * (1 + P.blessingBonus(s) / 100) * (1 + P.protectionBonus(s) / 100))
      : actual === 'resonant_wave' ? Math.floor(s.stats.attack * 9) : 0;
    let crit = null;
    if (damage > 0) {
      // Preserve the v1.4 floor of the flat attack component before criticals.
      damage += Math.floor(s.stats.attack) - s.stats.attack;
      crit = Crit.roll(s.stats.crit + (actual === 'smash' ? P.smiteCrit(s) : 0),
        (s.config.ruinPercentPerPoint || 0) * s.config.ruin + (s.stats.critDamagePercent || 0), () => roll(s));
      if (crit.critical) damage = Math.floor(damage * crit.damageMultiplier) + s.stats.critFlat;
    }
    if (opening) damage = Math.floor(damage * 1.5);
    const offer = Offer.effects(s);
    if (offer) damage = Math.floor(damage * (1 + (offer.outgoing || 0)));
    damage = Math.floor(damage * (1 + (s.stats.damagePercent || 0) / 100));
    damage = reaction === 'evade' ? 0 : reaction === 'guard' ? Math.floor(damage * .7) : damage;
    damage = Math.min(damage, s.bossHP);
    P.lifesteal(s, actual, damage);
    const offerHeal = offer ? Math.min(s.stats.hp - s.hp, Math.floor(damage * (offer.lifesteal || 0))) : 0;
    s.hp += offerHeal;
    s.totals.healing += offerHeal;
    s.bossHP -= damage;
    s.totals.damage += damage;
    const energyEntries = cost ? [{ reason: requested, requested: -cost, applied: -cost }] : [];
    if (s.paladinEvent.refund) energyEntries.push({ reason: 'hammer_refund', requested: 1, applied: s.paladinEvent.refund });
    if (actual === 'attack') {
      const before = s.energy;
      s.energy = Math.min(s.maxEnergy, s.energy + 1);
      energyEntries.push({ reason: 'basic_attack', requested: 1, applied: s.energy - before });
    }
    const log = { turn: s.turn, phase: s.phase, action: actual, requestedAction: requested,
      damage, incoming: 0, critical: !!crit?.critical, criticalTier: crit?.tier || 0, crit,
      charmBlocked: charmed, energyStart, energyEnd: s.energy, energyEntries,
      reaction: isAttackAction(action) ? reaction : null, ultimate: actual === 'resonant_wave',
      heal: offerHeal, supportAction: actual === 'prayer' };
    s.log.push(log);
    finish(s, actual, damage);
    s.config.disableClassPassives = beforePassives;
    return { state: s, log: s.log.at(-1), executed: actual };
  }

  function resolveIncoming(original, action, pattern, { release = true } = {}) {
    if (!DEFENSE_ACTIONS.includes(action) || original.status !== 'active' || original.config.job !== 'paladin') throw new Error('Unavailable Paladin defense');
    // An offensive action can already have spent its last energy in a mechanic
    // substep. Incoming resolution must not charge or revalidate that cast.
    if (!isAttackAction(action) && !available(original, action)) throw new Error('Unavailable Paladin defense');
    if (action === 'emergency_evade') throw new Error('Cancellation must be resolved by the phase engine');
    const s = structuredClone(original);
    const energyStart = s.energy;
    const energyEntries = [];
    const actual = action === 'blessing' ? 'prayer' : action === 'heal' ? 'heal' : action === 'guard' || action === 'magic_guard' ? 'guard' : 'wait';
    const beforePassives = s.config.disableClassPassives;
    if (s.roundCharm > 0) s.config.disableClassPassives = true;
    const cost = action === 'heal' ? 2 : action === 'blessing' ? Legacy.resourceCost('prayer', s) : 0;
    s.energy -= cost;
    if (cost) energyEntries.push({ reason: action, requested: -cost, applied: -cost });
    begin(s, actual);
    s.divineGraceProc = false;
    const effectiveDefense = s.stats.defense;
    let healed = 0;
    let requestedHeal = 0;
    const applyHeal = () => {
      requestedHeal = healAmount(effectiveDefense);
      healed = Math.min(Math.max(0, s.stats.hp - s.hp), requestedHeal);
      s.hp += healed;
      s.totals.healing += healed;
    };
    if (action === 'heal' && settings.healTiming === 'before_damage') applyHeal();
    const matched = (action === 'guard' && pattern.type === 'physical') || (action === 'magic_guard' && pattern.type === 'magic');
    const reduction = matched ? settings[action === 'guard' ? 'guardPhysicalReduction' : 'guardMagicReduction'] : 0;
    const base = Stages.baseValues(s);
    const raw = !release ? 0 : pattern.kind === 'N' ? base.normal : pattern.kind === 'H' ? base.heavy : pattern.kind === 'G' ? Mechanic.failureDamage(s) : 0;
    const count = raw <= 0 ? 0 : pattern.kind === 'N' ? pattern.hits : 1;
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Pattern hit count required');
    const resolvedHits = [];
    let incoming = 0, hits = 0, evades = 0, blocked = 0;
    for (let n = 0; n < count; n++) {
      const scaled = secondNormalHitDamage(s, pattern.kind, n, pattern.kind === 'G' ? raw : Stages.scaleAttack(s, raw));
      let damage = Math.max(1, Math.floor(scaled * 100 / (100 + Math.max(0, effectiveDefense))) - s.stats.mitigation);
      // Match v1.4 per-hit rounding (ceil), not one rounded combined combo.
      if (matched) {
        const before = damage;
        damage = Math.ceil(damage * (1 - reduction));
        blocked += before - damage;
      }
      if (roll(s) < s.stats.evasion / 100) { evades++; resolvedHits.push({index: n + 1, kind: pattern.kind, type: pattern.type, evaded: true, incoming: 0}); continue; }
      resolvedHits.push({index: n + 1, kind: pattern.kind, type: pattern.type, evaded: false, incoming: damage});
      incoming += damage;
      if (damage > 0) hits++;
    }
    const offer = Offer.effects(s);
    const penalty = s.contractPenalty && s.turn >= s.contractPenalty.startTurn ? s.contractPenalty : null;
    if (penalty?.interaction === 'replace') incoming = Math.ceil(incoming * penalty.multiplier);
    else {
      if (offer) incoming = Math.ceil(incoming * (1 + (offer.incoming || 0)));
      if (penalty) incoming = Math.ceil(incoming * penalty.multiplier);
    }
    // Guard was already rounded per hit above. Only aggregate transforms remain.
    let prefix = 0, previous = 0;
    const presentation = {basis: 'resolved-prefix-allocation', hits: resolvedHits.map(hit => {
      prefix += hit.incoming; let total = prefix;
      if (penalty?.interaction === 'replace') total = Math.ceil(total * penalty.multiplier);
      else {
        if (offer) total = Math.ceil(total * (1 + (offer.incoming || 0)));
        if (penalty) total = Math.ceil(total * penalty.multiplier);
      }
      const allocated = {...hit, incoming: total - previous}; previous = total; return allocated;
    })};
    s.hp = Math.max(0, s.hp - incoming);
    if (!s.config.disableLastStand && !s.config.disableClassPassives && s.hp === 0 && s.config.level >= 50 && !s.lastStand) { s.hp = 1; s.lastStand = true; }
    if (action === 'heal' && settings.healTiming === 'after_damage_if_alive' && s.hp > 0) applyHeal();
    // Guard and Magic Guard do not restore Energy. Keep the zero-valued
    // receipt field for compatibility; Basic Attack owns its separate reward.
    const guardEnergy = 0;
    // Divine Grace triggers once after surviving direct damage, never the
    // legacy mechanic-failure damage or a non-damaging curse/support choice.
    P.struck(s, pattern.kind === 'G' ? 0 : incoming, () => roll(s));
    s.totals.evades += evades;
    s.totals.blocked += blocked;
    s.log.push({ turn: s.turn, phase: s.phase, action: nativeAction(action), requestedAction: nativeAction(action),
      damage: 0, incoming, hits, evades, blocked, matched, guardReduction: reduction,
      guardEnergy, energyStart, energyEnd: s.energy, energyEntries, heal: healed,
      requestedHeal, healTiming: action === 'heal' ? settings.healTiming : null,
      effectiveDefense, supportAction: isSupport(action), graceProc: !!s.divineGraceProc });
    finish(s, actual, 0);
    s.config.disableClassPassives = beforePassives;
    return { state: s, log: s.log.at(-1), executed: nativeAction(action), presentation };
  }

  function defense(s, action, pattern) {
    if (isSupport(action)) throw new Error('Use resolveDefenseAction for support');
    return resolveIncoming(s, action, pattern);
  }
  function resolveDefenseAction(s, action, pattern, options = {}) {
    if (!isSupport(action)) throw new Error('Support action required');
    if (!defensePhase(s)) throw new Error('Defense turn only');
    return resolveIncoming(s, action, pattern, options);
  }
  function beginRound(s) { common.beginRound(s); }
  function endRound(s) {
    common.endRound(s);
    P.tick(s);
  }
  return { ...common, create, attack, defense, available, disabledReason, cost, beginRound, endRound,
    attackActions: ATTACK_ACTIONS, defenseActions: DEFENSE_ACTIONS,
    interruptionSkills: Object.freeze(['smash']), nativeAction, isAttackAction, isSupport,
    isInterrupt: (action, log) => action === 'smash' && log.damage > 0 && !log.charmBlocked,
    resolveDefenseAction, policy: Object.freeze(settings), healAmount };
}

module.exports = { createPaladinCombat, ATTACK_ACTIONS, DEFENSE_ACTIONS, APPROVED_POLICY, BLESSING_DURATION, HEAL_BASE, HEAL_DEF_RATIO, healAmount };
