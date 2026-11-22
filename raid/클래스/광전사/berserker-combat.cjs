const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
const { secondNormalHitDamage } = require('../../보스/서큐버스/succubus-second-hit.cjs');
// Isolated RAID v1.5 adapter. Imports pure v1.4 calculations, never player storage.
const path = require('node:path');
const { ultimateReaction } = require('../../보스/전투/흐름/rules.cjs');
const ATTACK_ACTIONS = Object.freeze(['attack', 'charge', 'blood_transfusion', 'ultimate']);
const DEFENSE_ACTIONS = Object.freeze(['shoulder_tackle', ...ATTACK_ACTIONS, 'emergency_evade']);
const native = action => action === 'ultimate' ? 'berserker_ultimate' : action;
const offensive = action => ['attack', 'ultimate', 'berserker_ultimate'].includes(action);
const supportAction = action => ['charge', 'blood_transfusion', 'shoulder_tackle'].includes(action);

function createBerserkerCombat({root = runtimePaths.join(runtimePaths.directory("raid15"), '..'), random = null, policy = {}} = {}) {
  const load = name => require(runtimePaths.join(root, name));
  const Legacy = load('raid-engine/progression-combat.cjs');
  const Build = load('raid-test-build.js');
  const B = load('raid-engine/berserker-rules.cjs');
  const Crit = load('raid-engine/critical-rules.cjs');
  const Coop = load('raid-engine/cooperation.js');
  const Offer = load('raid-engine/devil-offer.cjs');
  const Stages = load('raid-engine/enrage-stages.cjs');
  const Profiles = load('raid-engine/pattern-profiles.cjs');
  const Mechanic = load('raid-engine/mechanic-rules.cjs');
  // This core supplies the same single same-turn Stagger opening in both
  // contexts. Defense cancels its pattern; neither route adds legacy turns.
  const groggyPolicy = policy.groggy || 'engine_openings';
  if (groggyPolicy !== 'engine_openings') throw new TypeError('Ragnarok openings must be owned by the v1.5 engine');
  function roll(s) {
    if (random) return random();
    let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0; return s.rng / 4294967296;
  }
  function create({level = 1, enhancement = 0, seed = 1} = {}) {
    const s = Legacy.create(Build.config('berserker', level, enhancement, 'nameless_succubus'), seed);
    s.maxEnergy = 5 + (s.maxEnergy - 3); s.energy = s.maxEnergy;
    s.energyRecoveryInterval = 2;
    s.turn = 0; s.phase = 'new'; s.director.phase = 'idle'; s.director.queue = [];
    s.director.combatActions = 0; s.director.patternReadyAt = {};
    s.offer = null; s.offerEffects = null; s.raidId = 'raid15-isolated'; s.buffs = [];
    s.berserkerCharge = 0; s.berserkerBloodEnergy = 0; s.berserkerGroggy = 0;
    s.unguardedNormalHits = 0; s.tackleRound = null; s.tackleActive = false;
    s.berserkerGroggyPolicy = groggyPolicy;
    return s;
  }
  const gimmickPhase = s => ['gimmick_a', 'gimmick_b'].includes(s.phase);
  const cursePhase = s => s.phase === 'defense' && s.pattern?.kind === 'C';
  const paidInterrupt = (s,action) => action==='attack'&&B.stage(s)===0&&(gimmickPhase(s)||cursePhase(s));
  function gimmickProgress(action, log) {
    if (action !== 'attack' || log.charmBlocked || !(log.damage > 0)) return 0;
    return log.berserker?.released >= 2 ? 2 : 1;
  }
  function available(s, action) {
    if (s.status !== 'active') return false;
    if (action === 'emergency_evade') return Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses??Number(!!s.emergencyUsed)))>0;
    if (paidInterrupt(s, action) && s.energy < 1) return false;
    return [...ATTACK_ACTIONS, 'shoulder_tackle'].includes(action) && B.actions(s).includes(native(action));
  }
  function syncSupport(s) {
    const support = Coop.effects(s.buffs || [], s.raidId, s.now);
    const maxHP = Math.floor(s.baseHP * (1 + support.hpBonus));
    if (maxHP !== s.stats.hp) { s.hp = Math.min(maxHP, Math.floor(s.hp * maxHP / s.stats.hp)); s.stats.hp = maxHP; }
    s.blessingBonus = support.hpBonus;
    return support;
  }
  function withPassives(s, fn) {
    const old = s.config.disableClassPassives;
    if (s.roundCharm > 0) s.config.disableClassPassives = true;
    try { return fn(); } finally { s.config.disableClassPassives = old; }
  }
  function status(s) {
    if (s.bossHP <= 0) s.status = 'victory'; else if (s.hp <= 0) s.status = 'defeated';
  }
  function resetStreak(s, reason) { s.unguardedNormalHits = 0; s.normalHitResetReason = reason; }
  function breakCharge(s, event, reason) {
    if (B.stage(s) > 0) { s.berserkerCharge = 0; event.chargeBroken = true; event.chargeBreakReason = reason; }
  }
  function finishLog(s, log, event) {
    log.berserker = {...event, chargeAfter: B.stage(s)};
    log.chargeBroken = !!event.chargeBroken;
    if (event.chargeBroken) {
      log.chargeBreakReason = event.chargeBreakReason;
      log.chargeBreakText = event.chargeBreakReason === 'two_unguarded_normal_hits'
        ? 'CHARGE BROKEN! Two consecutive unguarded normal hits reset your Charge.' : 'CHARGE BROKEN!';
    }
    s.berserkerEvent = event;
    log.energyEnd = s.energy; log.hp = s.hp;
    s.log.push(log); log.playerPose = B.pose(s); status(s);
    return {state: s, log};
  }
  function attack(original, action, {reaction = 'hit', opening = false, gimmick = gimmickPhase(original)} = {}) {
    if (!available(original, action)) throw new Error('Unavailable Berserker action');
    if (!['hit', 'guard', 'evade'].includes(reaction)) throw new Error('Invalid boss reaction');
    const interruptStrike = paidInterrupt(original, action, gimmick);
    if (interruptStrike && original.energy < 1) throw new Error('Insufficient energy for Interrupt Strike');
    const s = structuredClone(original), a = native(action), energyStart = s.energy;
    const support = syncSupport(s);
    return withPassives(s, () => {
      const charmed = s.roundCharm > 0 && offensive(action) && roll(s) < .3;
      // Ordinary Basic during Curse/Mechanic is a paid attempt, including Evade/Charm failures.
      const actual = charmed ? 'charmed' : a, cost = interruptStrike ? 1 : Legacy.resourceCost(actual, s);
      reaction = ultimateReaction(reaction, actual === 'berserker_ultimate');
      s.energy -= cost;
      const event = B.begin(s, actual), energyEntries = cost ? [{reason: interruptStrike ? 'interrupt_strike' : actual, requested: -cost, applied: -cost}] : [];
      if (actual === 'blood_transfusion') {
        s.hp -= event.selfDamage; s.totals.selfDamage += event.selfDamage;
        energyEntries.push({reason: 'blood_absorb', requested: -event.absorbedEnergy, applied: -event.absorbedEnergy});
      }
      if (actual === 'shoulder_tackle') {
        event.energyGain=0;
        s.tackleRound = s.turn; s.tackleActive = true;
      }
      let damage = ['attack', 'berserker_ultimate'].includes(actual) ? B.effectiveAttack(s) * B.attackMultiplier(s) : 0;
      let crit = null;
      if (damage > 0) {
        if (s.holyTurns > 0) { damage += 20 + 3 * s.config.level; s.holyTurns--; }
        damage += Math.floor(B.effectiveAttack(s) * support.attackBonus + (s.weaponTurns > 0 ? 50 : 0) * (1 + support.attackBonus));
        if (s.weaponTurns > 0) s.weaponTurns--;
        crit = Crit.roll(s.stats.crit + B.critBonus(s), (s.config.ruinPercentPerPoint || 0) * s.config.ruin + (s.stats.critDamagePercent || 0), () => roll(s));
        event.bloodCriticalProc = false; event.bloodCritChance = B.critBonus(s);
        if (crit.critical) damage = Math.floor(damage * crit.damageMultiplier) + s.stats.critFlat;
        if (s.config.elements && Legacy.BOSSES[s.config.boss].favored === s.config.job) damage = Math.floor(damage * 1.1);
      }
      if (opening) damage = Math.floor(damage * 1.5);
      const offer = Offer.effects(s);
      if (offer) damage = Math.floor(damage * (1 + (offer.outgoing || 0)));
      damage = B.outgoing(s, damage);
      damage = Math.floor(damage * (1 + (s.stats.damagePercent || 0) / 100));
      damage = reaction === 'evade' ? 0 : reaction === 'guard' ? Math.floor(damage * .7) : damage;
      damage = Math.min(damage, s.bossHP);
      const classHeal = event.released >= 2 ? Math.floor(damage * (event.released === 3 ? .04 : .01)) : 0;
      const heal = Math.min(B.healCapacity(s), classHeal + (offer ? Math.floor(damage * (offer.lifesteal || 0)) : 0));
      s.hp += heal; s.totals.healing += heal; s.bossHP -= damage; s.totals.damage += damage;
      event.lifesteal = Math.min(heal, classHeal); event.attackName = interruptStrike?'Power Attack':B.names[event.released || 0];
      if (event.finisher && (s.config.berserkerFinisherRelic || s.config.berserkerTackleRelic) && s.hp > 0) {
        const before = s.energy; s.energy = Math.min(s.maxEnergy, s.energy + 2); event.relicEnergyGain = s.energy - before;
        energyEntries.push({reason: 'finisher_relic', requested: 2, applied: event.relicEnergyGain});
      }
      if (actual === 'attack') {
        if (!interruptStrike) {
          const gain=event.released===1?2:event.released===2?1:0,before=s.energy;s.energy=Math.min(s.maxEnergy,s.energy+gain);
          if(gain)energyEntries.push({reason:'charged_attack',requested:gain,applied:s.energy-before});
        }
        if (!s.config.disableClassPassives && s.hp > 0 && s.bossHP > 0) s.rage = Math.min(100, s.rage + (s.config.attackRage || 0));
      }
      if (actual === 'berserker_ultimate') {
        s.ultimateUses = (s.ultimateUses || 0) + 1; s.ultimateUsed = s.ultimateUses >= (s.config.level >= 90 ? 2 : 1);
        s.berserkerGroggy = 0;
      }
      const log = {turn: s.turn, phase: s.phase, action: actual, requestedAction: a, damage, incoming: 0, heal, selfDamage: event.selfDamage || 0,
        critical: !!crit?.critical, criticalTier: crit?.tier || 0, crit, charmBlocked: charmed, energyStart, energyEnd: s.energy, energyEntries,
        reaction, gimmick, interruptStrike, groggy: opening, ultimate: actual === 'berserker_ultimate', support};
      const result = finishLog(s, log, event);
      log.gimmickProgress = gimmick ? gimmickProgress(action, log) : 0;
      return {...result, executed: actual};
    });
  }
  function defense(original, action, pattern) {
    const s = structuredClone(original), energyStart = s.energy;
    const support = syncSupport(s);
    return withPassives(s, () => {
      // Never call begin('attack'/'charge') here: a defensive strike executes later.
      const event = B.begin(s, 'charmed');
      event.action = action === 'shoulder_tackle' || s.tackleActive && s.tackleRound === s.turn ? 'shoulder_tackle' : 'wait';
      const tackle = event.action === 'shoulder_tackle';
      const energyEntries = [];
      if (action === 'shoulder_tackle' && !(s.tackleActive && s.tackleRound === s.turn)) {
        event.energyGain=0;
        s.tackleActive = true; s.tackleRound = s.turn;
      }
      const base = Stages.baseValues(s);
      const raw = pattern.kind === 'N' ? base.normal : pattern.kind === 'H' ? base.heavy : pattern.kind === 'G' ? Mechanic.failureDamage(s) : 0;
      // A descriptor list permits physical/magic mixed combos without reselecting Tackle.
      const attacks = pattern.attacks || Array.from({length: raw > 0 ? pattern.kind === 'N' ? pattern.hits || 1 : 1 : 0}, () => ({kind: pattern.kind, type: pattern.type, raw}));
      let incoming = 0, hits = 0, evades = 0, blocked = 0, direct = 0, mechanic = 0;
      const hitResults = [];
      for (const [hitIndex, hit] of attacks.entries()) {
        const kind = hit.kind || pattern.kind, mechanicHit = kind === 'G';
        const value = hit.raw ?? (kind === 'N' ? base.normal : kind === 'H' ? base.heavy : Mechanic.failureDamage(s));
        if (!(value > 0)) continue;
        if (tackle) resetStreak(s, 'tackle'); else if (kind !== 'N') resetStreak(s, 'other_attack');
        const scaled = secondNormalHitDamage(s, kind, hitIndex, mechanicHit ? value : Stages.scaleAttack(s, value));
        const mitigated = mechanicHit ? value : Math.max(1, Math.floor(scaled * (1 - support.damageReduction) * 100 / (100 + Math.max(0, B.defense(s)))) - s.stats.mitigation);
        // Failed mechanics are unavoidable and bypass class/DEF mitigation in v1.4.
        if (!mechanicHit && roll(s) < s.stats.evasion / 100) { if(kind==='N')resetStreak(s,'evade'); evades++; hitResults.push({kind, type: hit.type, evaded: true, incoming: 0, tackle}); continue; }
        hits++;
        if (mechanicHit) mechanic += mitigated; else direct += mitigated;
        if (!tackle && kind === 'N' && mitigated > 0) {
          s.unguardedNormalHits = (s.unguardedNormalHits || 0) + 1;
          if (s.unguardedNormalHits >= 2) { breakCharge(s, event, 'two_unguarded_normal_hits'); resetStreak(s, 'two_unguarded_normal_hits'); }
        } else if (!tackle && ['H', 'G'].includes(kind) && mitigated > 0) breakCharge(s, event, 'legacy_heavy_or_special');
        hitResults.push({kind, type: hit.type, evaded: false, incoming: mitigated, tackle});
      }
      const offer = Offer.effects(s), penalty = s.contractPenalty && s.turn >= s.contractPenalty.startTurn ? s.contractPenalty : null;
      if (penalty?.interaction === 'replace') direct = Math.ceil(direct * penalty.multiplier);
      else { if (offer) direct = Math.ceil(direct * (1 + (offer.incoming || 0))); if (penalty) direct = Math.ceil(direct * penalty.multiplier); }
      const afterClass = B.incoming(s, direct); blocked = direct - afterClass;
      // Contract refusal is a v1.5 whole-pattern penalty; legacy offer ignores mechanic failure.
      if (penalty) mechanic = Math.ceil(mechanic * penalty.multiplier);
      // Display-only prefix allocation at the same pre-HP snapshot as B.incoming.
      // That rule is pure; mechanic damage retains its separate bypass and penalty.
      let directPrefix = 0, mechanicPrefix = 0, previous = 0;
      const presentation = {basis: 'resolved-prefix-allocation', hits: hitResults.map((hit, index) => {
        if (hit.kind === 'G') mechanicPrefix += hit.incoming; else directPrefix += hit.incoming;
        let d = directPrefix;
        if (penalty?.interaction === 'replace') d = Math.ceil(d * penalty.multiplier);
        else { if (offer) d = Math.ceil(d * (1 + (offer.incoming || 0))); if (penalty) d = Math.ceil(d * penalty.multiplier); }
        const total = B.incoming(s, d) + (penalty ? Math.ceil(mechanicPrefix * penalty.multiplier) : mechanicPrefix);
        const allocated = {index: index + 1, kind: hit.kind, type: hit.type, evaded: hit.evaded, incoming: total - previous};
        previous = total; return allocated;
      })};
      incoming = afterClass + mechanic; s.hp = Math.max(0, s.hp - incoming);
      let lastStandTriggered = false;
      if (!s.config.disableLastStand && !s.config.disableClassPassives && s.hp === 0 && s.config.level >= 50 && !s.lastStand) {
        s.hp = 1; s.lastStand = true; lastStandTriggered = true; breakCharge(s, event, 'last_stand');
      }
      if (tackle && hitResults.some(hit => hit.kind === 'H' && (hit.evaded || hit.incoming > 0)) && s.hp > 0 && !lastStandTriggered) s.berserkerCharge = Math.min(3, B.stage(s) + 1);
      if (!s.config.disableClassPassives && s.hp > 0) s.rage = Math.min(100, s.rage + Math.min(30, hits * s.stats.rageGain));
      s.totals.evades += evades; s.totals.blocked += blocked;
      const log = {turn: s.turn, phase: s.phase, action, damage: 0, incoming, mechanicDamage: mechanic, hits, evades, blocked,
        tackle, hitResults, unguardedNormalHits: s.unguardedNormalHits, lastStandTriggered, energyStart, energyEnd: s.energy, energyEntries};
      return {...finishLog(s, log, event), presentation};
    });
  }
  function resolveDefenseAction(original, action, pattern, {release = true} = {}) {
    if (!supportAction(action)) throw new Error('Not a Berserker support action');
    const used = attack(original, action, {reaction: 'hit'});
    if (!release || used.state.status !== 'active') return {...used, presentation: {basis: 'resolved-prefix-allocation', hits: []}};
    const resolved = defense(used.state, action, pattern);
    resolved.log.supportAction = used.log;
    resolved.log.selfDamage = used.log.selfDamage;
    resolved.log.berserker = {...used.log.berserker, chargeAfter: B.stage(resolved.state),
      chargeBroken: resolved.log.chargeBroken, chargeBreakReason: resolved.log.chargeBreakReason};
    resolved.state.berserkerEvent = {...resolved.log.berserker};
    resolved.log.playerPose = B.pose(resolved.state);
    resolved.log.energyStart = used.log.energyStart;
    resolved.log.energyEntries = [...used.log.energyEntries, ...resolved.log.energyEntries];
    return {...resolved, executed: used.executed};
  }
  function beginRound(s) {
    s.roundCharm = s.charmTurns || 0; s.roundOffer = Offer.effects(s)?.remaining || 0; s.offerGrantedThisRound = false;
    s.roundPenalty = s.contractPenalty && s.turn >= s.contractPenalty.startTurn ? s.contractPenalty.turns || 0 : 0;
    s.tackleActive = false; s.tackleRound = null;
    // No streak reset: Idle, round changes and contract screens are not attacks.
  }
  function endRound(s) {
    if (s.roundCharm > 0) s.charmTurns = Math.max(0, (s.charmTurns || 0) - 1);
    if (s.roundOffer > 0 && s.offerEffects && !s.offerGrantedThisRound) s.offerEffects.remaining = Math.max(0, s.offerEffects.remaining - 1);
    if (s.roundPenalty > 0 && s.contractPenalty?.duration === 'turns' && --s.contractPenalty.turns <= 0) s.contractPenalty = null;
    if (!s.config.disableClassPassives && !s.roundCharm && s.hp > 0 && s.bossHP > 0) s.rage = Math.min(100, s.rage + (s.config.turnRage || 0));
    s.tackleActive = false; s.tackleRound = null;
  }
  function contract(original, choice) {
    const s = structuredClone(original); s.offer = {screen: 'choice', stage: Stages.level(s), guaranteed: !!s.pendingGuarantee};
    const resolved = Offer.resolve(s, choice === 'yes' ? 'offer_yes' : 'offer_no');
    resolved.turn = s.turn; resolved.phase = s.phase; resolved.offerGrantedThisRound = true; return resolved;
  }
  return {attackActions: ATTACK_ACTIONS, defenseActions: DEFENSE_ACTIONS, interruptionSkills: ['attack'],
    isAttackAction: offensive, isSupport: supportAction,
    presentationBuffs: s => ({enrage:Number(B.enraged(s))}),
    interruptionWeight: (_action, log) => !log.charmBlocked && log.damage > 0 ? log.berserker?.released >= 2 ? 2 : 1 : 0,
    onEmergencyEvade: s => { resetStreak(s, 'emergency_evade'); s.tackleActive = false; s.tackleRound = null; },
    gimmickProgress,
    actionLabel: (s, action) => paidInterrupt(s, action) ? 'Power Attack' : null,
    disabledReason: (s, action) => paidInterrupt(s, action) && s.energy < 1 ? 'Insufficient Energy: requires 1 Energy' : null,
    cost: (s, action) => paidInterrupt(s, action) ? 1 : action === 'blood_transfusion' ? B.bloodDrawEnergy(s) : B.cost(native(action), s),
    create, attack, defense, available, resolveDefenseAction, beginRound, endRound, contract, roll,
    weights: s => Profiles.weights(s), cooldown: (s, key) => Profiles.cooldown(s, key), due: s => Stages.due(s), enter: s => Stages.enter(s), stage: s => Stages.level(s),
    unresolvedPolicies: []};
}
module.exports = {createBerserkerCombat, ATTACK_ACTIONS, DEFENSE_ACTIONS};
