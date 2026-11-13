# v1.3.2 - Shared Maximum Attack Growth

This patch centralizes Maximum growth at the common direct-hit calculation path. It is not a new damage buff for the existing Colossus or Succubus: their latest production readback already applied the same growth to normal and heavy attacks.

## Rule
- Maximum begins at the existing 6x normal-stage attack coefficient.
- Every three displayed turns after Maximum entry, add one normal-stage base coefficient: 6x, 7x, 8x, etc. This is additive, not compound.
- The shared hit loop applies the ramp once before mitigation for any boss at enrage level 3. No boss-ID allowlist gates the growth.
- Stage timing, pending transforms, attacks, cooldowns, recovery, images, class tuning, rewards and stored player data are unchanged.
- Future boss implementations using the common engine inherit the growth. They still require their own valid base attacks and stage progression; this patch does not enable unfinished bosses.

## Files
- raid-engine/enrage-stages.cjs: explicit shared constants, maximumSteps, baseValues and scaleAttack. values remains a fully-scaled inspection API.
- raid-engine/gimmick-trial-engine.cjs: normal/heavy use stage baseValues; all direct hits call scaleAttack before mitigation. This prevents double scaling.

## Offline validation
- 1,232 old/new stage-value equivalence cases for both current bosses.
- 72 actual engine direct-hit tests including normal/heavy for current bosses and non-profiled boss IDs to exercise the generic path.
- 23,789 seeded full battle-state comparisons across Colossus and Succubus, all three active classes: byte-identical old/new states.
- Expected Colossus raw heavy at Maximum offsets 0/3/6/9: 660/770/880/990. Succubus: 540/630/720/810.
- Integer rounding remains in the existing per-hit mitigation path.

Actual Discord testing and deployment are separate from these offline checks. Do not claim them from this report.
