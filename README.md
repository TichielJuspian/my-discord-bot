# Gosu RAID v3.4.1: Balance source

A small, text-only reading snapshot of the [public v3.4.1 release](https://github.com/TichielJuspian/my-discord-bot/releases/tag/raid-v3.4.1), for balance review and AI-assisted analysis. Each included runtime file is an unmodified copy from that public release. [SOURCE-SHA256.txt](SOURCE-SHA256.txt) records the exact source bytes.

Use this branch as a review input, not an installer or a live server status report. The full public ZIP is linked above. This snapshot omits art, audio, compiled files, deployment tools, application settings and player/server records. A few files refer to omitted files or images; this snapshot is not intended as a complete executable bot.

## Where to start

| Question | Read these files |
| --- | --- |
| Which rules actually execute for each boss? | [Release runtime selection](raid/보스/전투/raid-v2-session.js), [boss catalog](raid/보스/전투/raid-boss-registry.js), [Succubus turn engine](raid/보스/전투/흐름/engine.cjs), [legacy combat entry](raid/보스/전투/엔진/progression-combat.cjs), [Colossus pattern director](raid/보스/콜로서스/colossus-pattern-director.cjs) |
| What are a class’s base stats, gear and stat scaling? | [Base builds](raid/보스/전투/raid-test-build.js), [Workshop model and equipment contributions](raid/워크샵/raid-workshop-model.js), [item catalog](raid/워크샵/raid-item-catalog.js), [slot progression](raid/보스/전투/엔진/slot-progression.cjs), [critical rules](raid/보스/전투/엔진/critical-rules.cjs) |
| How does Blader attack, parry or build buffs? | [Blader V2 combat](raid/보스/전투/흐름/combat.cjs), [Blader rules](raid/클래스/검사/warrior-rules.cjs), [legacy Blader integration](raid/클래스/검사/warrior-source.cjs) |
| How does Paladin heal, defend and deal damage? | [Paladin combat](raid/클래스/성기사/paladin-combat.cjs), [Paladin rules](raid/클래스/성기사/paladin-rules.cjs), [Purification](raid/클래스/성기사/purification.cjs), [legacy Paladin integration](raid/클래스/성기사/paladin-source.cjs) |
| How do Berserker Charge, Enrage and Ragnarok interact? | [Berserker combat](raid/클래스/광전사/berserker-combat.cjs), [Berserker rules](raid/클래스/광전사/berserker-rules.cjs), [legacy Berserker integration](raid/클래스/광전사/berserker-source.cjs), [V2 turn transitions](raid/보스/전투/흐름/engine.cjs) |
| How do Energy, boss patterns, statuses and shared buffs work? | [V2 rules](raid/보스/전투/흐름/rules.cjs), [legacy rule assembly](raid/보스/전투/엔진/gimmick-trial-engine.cjs), [pattern profiles](raid/보스/전투/엔진/pattern-profiles.cjs), [enrage](raid/보스/전투/엔진/enrage-stages.cjs), [mechanics](raid/보스/전투/엔진/mechanic-rules.cjs), [Devil’s Contract](raid/보스/전투/엔진/devil-offer.cjs), [shared buffs](raid/보스/전투/raid-shared-buffs.js), [boost effects](raid/보스/전투/raid-booster.js) |

## How to compare balance

1. Name the boss and distinguish the Succubus V2 route from Colossus’ legacy route; do not mix their phases or count display cuts as extra turns.
2. State level, equipped items, upgrade levels, stat allocation, boost state, target phase, and whether critical hits, buffs, rage or floors are included. Compare the same setup across classes.
3. Cite the exact rule and its caller. Legacy values may be modified during rule assembly; do not read a number in the base engine as the final value without following the patches.
4. The [guide composition](raid/클래스/selection-reader.cjs) and [guide index](raid/클래스/choice-index-l.json) describe what is shown, not what executes. The images are in the full public release, not here. If guide wording and runnable rules disagree, report the discrepancy and use code for mechanical analysis.
5. This snapshot establishes what v3.4.1 publicly shipped. Do not infer current live settings, hidden balance overrides, player distributions, or real-world response times.
