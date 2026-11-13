# v1.3.1 changelog

Archive of the verified 25-file coordinated deployment completed on 2026-11-13 (15:35 UTC).

## Changes in this patch

- Rename the player-facing Warrior class to **Blader** across class selection, skill guides, profiles, workshop and ranking displays. Keep internal `warrior` identifiers and combat behavior.
- Restore the original Next Action panel, divider, 17px motion text and Last Turn positioning. Shorten only overlong descriptions while preserving their meaning.
- Restore the historical cyan square-shaped guide marker.
- Show normal-stage warnings and contextual beginner hints for upcoming heavy release and curse launch, not preparation. Remove the Curse Preparation label.
- Keep normal-stage mechanic guidance aligned with actual skill/charged-attack rules; omit tutorial hints in enraged stages.
- Preserve the successful curse-interruption Hit image and zero boss attack before the following enrage action. This behavior was verified through actual engine/full-panel rendering; no speculative curse-engine change was added to this patch.

## Boundaries

This is exactly the final 25-file change set, not a complete bot distribution and not a cumulative v1.3-to-v1.3.1 upgrade. Intermediate deployments are prerequisites. Existing Ragnarok 550%, one-turn gimmick groggy behavior and corrected heavy artwork were already present and are not newly supplied in this patch. The boss-art map is included; image binaries are not.

## Recorded verification

25 deployment files matched their readback; 18 other engine files and three saved data files were unchanged; 42 syntax checks passed. Recorded tests included 31 display cases, 13,237 battle-state comparisons, 398 presentation regressions, 72 hint cases, 20 full-size motion descriptions and six full-panel Hit/enrage frames. These are recorded deployment results, not a claim that all suites were rerun for archival publication. Real Discord interactive combat reproduction remains unverified.

No production restart or operational data change was performed for this GitHub publication.
