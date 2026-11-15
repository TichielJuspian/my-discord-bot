# Gosu General TV Discord Bot v2.1

Class balance, Succubus battle behavior, skill guides and status presentation for the current v2 runtime.

## Blader

- Deep Thrust unlocks at 20 Hone.
- Perfect Parry chance is 30% plus 1 percentage point per Hone, capped at 70%.
- Thrust no longer grants its former defense buff.
- Failed Parry no longer spends Energy in legacy combat.
- Basic Attack still grants 1 Energy in Succubus v2 combat.

## Paladin

- Divine Smite unlocks at 16 Divine Punishment stacks. Every 8 stacks adds 10% Smite damage, capped at 40%.
- Blessing grants 6% Smite damage and 10 percentage points of critical chance per stack, up to 3 stacks, for 2 v2 rounds. Its 100% defense bonus lasts 3 rounds independently.
- Recasting refreshes active offensive stacks. After the offensive bonus expires, the next cast starts again at 1 stack.
- Heal restores floor(70 + effective DEF × 0.3) HP and costs 2 Energy.
- Divine Grace restores floor(20 + effective DEF × 0.4) HP. Battle feedback shows the icon and healing only when it actually triggers.
- Guard and Magic Guard grant no Energy in Succubus v2 combat. Basic Attack still grants 1 Energy. Legacy Basic Attack and Guard rewards are unchanged.
- Evolution controls, unlock notices and attack artwork use the same 16-stack threshold.

## Berserker

- Enrage grants 50% bonus ATK while retaining its existing mitigation.
- Blood Draw absorbs up to 5 Energy and preserves any excess. It grants 1 Charge stage per 3 Energy spent and 8 percentage points of critical chance per Energy spent on the next Basic or charged attack.
- In Succubus v2, uncharged Basic Attack during Curse or mechanic preparation costs 1 Energy and contributes 1 interruption point. Charged mechanic progress is 1, 2 and 2 points at Charge stages 1, 2 and 3.
- Offensive Ragnarok grants 2 bonus attack openings on its first use and 1 on a recast. Defensive use grants no follow-up openings.
- Legacy interruption and Ragnarok timing are unchanged.

## Guides, battle feedback and Workshop

- Updated class-effect icons, phase information, critical-hit and Charm presentation, and Divine Grace feedback.
- Reworked skill explanations and level-filtered Advanced pages. Workshop guide images use full-width paired cards within Discord's attachment limit.
- All three class skill guides use normal artwork regardless of equipped Legendary gear. Battle and Workshop guide surfaces share the normal-art cache.
- Equipped items, combat portraits and Workshop character portraits are unchanged. The unused new Legendary Heal guide image is not included; no deployed artwork is deleted.
- Workshop Energy capacity and pips match the 5, 6 and 7 Energy values.
- Server Booster attack displays retain the boost count and ATK percentage without the multiplier suffix.

## Text-chat XP

- Eligible text chat grants 20 XP normally or 22 XP for a Server Booster: a flat +2 XP bonus.
- Boost count and point stacks do not multiply this bonus.
- Voice XP remains 5, with eligibility and cooldowns unchanged.

## Scope and verification

This is a 29-file incremental overlay for a compatible, already-deployed v2 installation, not a complete bot distribution. The repository's legacy root and v1.4 source snapshot are not compatible substitutes for that baseline.

The combined offline suite passed 245 tests with no failures and 3 documented skips. The skips cover a superseded layout and two isolated parity checks superseded by the approved cross-class changes. Eight bundle guard checks passed. See README.md and manifest.json for verification boundaries and checksums.

Source publication and matching uploaded-file checksums do not establish that an already-running process has loaded the changes. This release does not imply a runtime restart or completed live Discord testing.
