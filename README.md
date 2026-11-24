# Gosu RAID v4.4.0: public battle and balance source

A source-reading snapshot of Gosu RAID v4.4.0 for balance and Workshop UI review. It contains the battle engine, class mechanics, boss patterns, scaling, buffs, equipment and Workshop enhancement formulas. It is neither deployable nor a live-server status report.

## Changes through v4.4.0

Workshop equipment keeps existing slot visuals with a fixed enhancement summary or selected-item detail region and one placement for Unequip. The Workshop profile uses the current shared idle artwork resolver and larger gold level numerals without changing battle-card rendering. Enhance renders real points, outcomes, next chance and milestones from the unchanged rules, and has one separate probability guide. Slot and enhance/scroll controls retain their existing behavior. The separate Workshop banner remains unchanged. User artwork, fonts and guide images are intentionally omitted here.

- [Workshop component layout](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-view.js)
- [Dynamic Enhance view](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-forge.js)
- [Authoritative enhancement and milestone rules](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/slot-progression.cjs)
- [Workshop gear and inventory rendering](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-detail.js) / [image rendering and cache](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-render.js)
- [Shared selection art resolver](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/raid-selection-assets.js) (source only)

## Earlier changes in v4.1.2

Acknowledged Ultimate scenes now stay visible for at least 800 ms before the next queued cut. The separate Ragnarok follow-up hit stays at 500 ms, and the Succubus dodge cut stays at 320 ms. Timing does not change the attack, damage, Energy or turn rules. In the full runtime, private character selection and inactive battles also close after five minutes; production-specific message and lobby handlers are outside this public source-reading edition. The snapshot does not indicate live deployment status.

## Devil’s Contract in v4.1.1

The Succubus contract changes the acceptance/refusal outcome table, applies the listed ATK/DEF modifiers to combat calculations, and can double paid skill energy costs. One refusal outcome drains all remaining Energy, or removes 10% of maximum HP at zero Energy without dropping HP below 1. See the [resolver](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/devil-offer.cjs), [display model](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/raid-two-piece-model.cjs) and [overlay](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/raid-two-piece-overlay.cjs). The older standalone offer view and all artwork remain outside this reading edition.

## Reading map

| Question | Source files |
| --- | --- |
| Runtime routing and boss selection | [raid-v2-session.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-v2-session.js), [raid-boss-registry.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-boss-registry.js), [engine.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/engine.cjs), [progression-combat.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/progression-combat.cjs), [colossus-pattern-director.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%BD%9C%EB%A1%9C%EC%84%9C%EC%8A%A4/colossus-pattern-director.cjs) |
| Energy, state, patterns and boss mechanics | [rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/rules.cjs), [state-runtime.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/state-runtime.cjs), [pattern-profiles.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/pattern-profiles.cjs), [enrage-stages.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/enrage-stages.cjs), [mechanic-rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/mechanic-rules.cjs), [devil-offer.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/devil-offer.cjs) |
| Blader | [combat.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/combat.cjs), [warrior-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B2%80%EC%82%AC/warrior-rules.cjs), [warrior-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B2%80%EC%82%AC/warrior-source.cjs), [warrior-rework.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B2%80%EC%82%AC/warrior-rework.cjs) |
| Paladin | [paladin-combat.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-combat.cjs), [paladin-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-rules.cjs), [purification.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/purification.cjs), [paladin-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-source.cjs) |
| Berserker | [berserker-combat.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-combat.cjs), [berserker-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-rules.cjs), [berserker-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-source.cjs), [berserker-pose.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/card-v23/berserker-pose.cjs) |
| Workshop, stats and gear | [raid-test-build.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-test-build.js), [raid-workshop-model.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-model.js), [raid-item-catalog.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-item-catalog.js), [raid-gear-policy.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-gear-policy.js), [slot-progression.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/slot-progression.cjs), [critical-rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/critical-rules.cjs), [raid-equipment.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-equipment.js), [raid-workshop-forge.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-forge.js) |
| Renderers (source only; artwork omitted) | [renderer.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/card-v23/renderer.cjs), [battle-hud-v351.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/card-v23/battle-hud-v351.cjs), [battle-log-render.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/battle-log-render.cjs), [stamp-log-render.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/stamp-log-render.cjs), [raid-static-card.js](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/raid-static-card.js), [raid-berserker-art.js](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/raid-berserker-art.js) |
| Display vs rules | [selection-reader.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/selection-reader.cjs), [choice-index-l.json](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/choice-index-l.json), [view.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/view.cjs), [status-panels.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/status-panels.cjs), [log-outcomes.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/log-outcomes.cjs), [raid-compact-effects.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-compact-effects.js), [raid-battle-feed.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-battle-feed.js), [raid-combat-copy.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-combat-copy.js), [runtime-paths.cjs](raid/runtime-paths.cjs) |

Blader Focus and Berserker Charge share authored badge lookups across the combat card and raster log; native Discord rows use the built-in fallback in this sanitized reading edition. Contract Vulnerability and active detrimental Contract results share the existing icon. Berserker released attacks are named Burst, Rupture and Cataclysm without changing their gameplay formulas. Old portrait slots and source art are omitted.

Analyze Succubus V2 and legacy Colossus separately. Follow the action through its caller, phase, class rules and effects. State level, equipment, boost and RNG assumptions. Display frames and guide wording are not authority for mechanics. Later draft designs are not included.

## Scope and privacy

Artwork, editing assets, other bot code, credentials, deployment settings, service addresses, operational IDs, user records, logs, dependencies, backup data and repository history are excluded. References to omitted inputs or integrations can remain because this is a reading edition.

81 source files are exact; three have narrow public-edition transformations without changing damage, resource, phase or stat formulas:
- [보스/서큐버스/succubus-presentation.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%84%9C%ED%81%90%EB%B2%84%EC%8A%A4/succubus-presentation.cjs): Removed the instance-specific status emoji bindings; render fallback remains.
- [워크샵/raid-test-gear.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-test-gear.js): Redacted the name of the test-only environment gate; conditional rules kept.
- [file-map.json](raid/file-map.json): Filtered aliases to the published allowlist.

The v4.1.1 display changes reconnect authorized raid members without requiring a fresh attempt, split some Skill Guide and growth pages, and refine battle status/HUD presentation. This edition retains the previously approved balance/source paths and adds the presentation-only Workshop and selection sources above; it omits artwork and operational integration. Existing battle formulas are not redefined by these display refinements. See [SOURCE-SHA256.txt](SOURCE-SHA256.txt) for the included verification inventory.
