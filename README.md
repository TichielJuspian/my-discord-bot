# Gosu RAID v3.5.2: public battle and balance source

A source-reading snapshot of Gosu RAID v3.5.2 for balance review. It includes the battle engine, class mechanics, boss patterns, scaling, buffs, equipment and Workshop formulas. It is not a deployable package or a live server status report.

## Reading map

| Question | Source files |
| --- | --- |
| Runtime routing and boss selection | [raid-v2-session.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-v2-session.js), [raid-boss-registry.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-boss-registry.js), [engine.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/engine.cjs), [progression-combat.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/progression-combat.cjs), [colossus-pattern-director.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%BD%9C%EB%A1%9C%EC%84%9C%EC%8A%A4/colossus-pattern-director.cjs) |
| Energy, state, patterns and boss mechanics | [rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/rules.cjs), [state-runtime.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/state-runtime.cjs), [pattern-profiles.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/pattern-profiles.cjs), [enrage-stages.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/enrage-stages.cjs), [mechanic-rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/mechanic-rules.cjs), [devil-offer.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/devil-offer.cjs) |
| Blader | [combat.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/combat.cjs), [warrior-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B2%80%EC%82%AC/warrior-rules.cjs), [warrior-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B2%80%EC%82%AC/warrior-source.cjs) |
| Paladin | [paladin-combat.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-combat.cjs), [paladin-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-rules.cjs), [purification.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/purification.cjs), [paladin-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EC%84%B1%EA%B8%B0%EC%82%AC/paladin-source.cjs) |
| Berserker | [berserker-combat.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-combat.cjs), [berserker-rules.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-rules.cjs), [berserker-source.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/%EA%B4%91%EC%A0%84%EC%82%AC/berserker-source.cjs), [berserker-pose.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/card-v23/berserker-pose.cjs) |
| Workshop, stats and gear | [raid-test-build.js](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-test-build.js), [raid-workshop-model.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-model.js), [raid-item-catalog.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-item-catalog.js), [raid-gear-policy.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-gear-policy.js), [slot-progression.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/slot-progression.cjs), [critical-rules.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%EC%97%94%EC%A7%84/critical-rules.cjs), [raid-equipment.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-equipment.js), [raid-workshop-forge.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-workshop-forge.js) |
| Display vs rules | [selection-reader.cjs](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/selection-reader.cjs), [choice-index-l.json](raid/%ED%81%B4%EB%9E%98%EC%8A%A4/choice-index-l.json), [view.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/view.cjs), [status-panels.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/status-panels.cjs), [log-outcomes.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/log-outcomes.cjs) |

Analyze Succubus V2 and legacy Colossus separately. Follow the action through its caller, phase, class rules and effects. State level, equipment, boost and RNG assumptions. Display frames and guide wording are not authority for mechanics. Later draft designs are not included.

## Scope and privacy

Artwork, editing assets, other bot code, credentials, deployment settings, service addresses, operational IDs, user records, logs, dependencies, backup data and repository history are excluded. References to omitted inputs or integrations can remain because this is a reading edition.

65 source files are exact; three have narrow public-edition transformations without changing damage, resource, phase or stat formulas:
- [보스/전투/흐름/status-panels.cjs](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/status-panels.cjs): Removed 13 instance-specific custom emoji IDs; display fallback remains.
- [워크샵/raid-test-gear.js](raid/%EC%9B%8C%ED%81%AC%EC%83%B5/raid-test-gear.js): Redacted the name of the test-only environment gate; conditional rules kept.
- [file-map.json](raid/file-map.json): Filtered aliases to the published allowlist.

See [SOURCE-SHA256.txt](SOURCE-SHA256.txt) for SHA-256 of each included source file.
