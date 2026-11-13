# v1.3 changelog

Historical production patch verified online: 2026-11-13 09:06:59 UTC.

## Combat flow

- Add a dedicated Colossus pattern director and integrate it with the shared dispatcher.
- Update shared and Succubus pattern selection, cooldown/reset behavior and stage-specific profiles.
- Preserve Colossus left/right normal attacks with 60% continuation.
- Include the then-approved Succubus third normal strike. Later removal of attack 3 is not part of this archive.
- Support ultimate cancellation of special patterns. The historical Berserker policy provides two groggy actions followed by the guaranteed special without consuming hidden preparation.

## Presentation

- Align boss result artwork, upcoming intent text, battle feed and visible effects with the historical combat flow.
- Update Colossus and Succubus presentation adapters alongside the engine patch.

## Release boundary

This archive contains exactly 11 changed source files. Later entry-idle fixes, replacement Succubus artwork, new skill labels, Blader naming, Ragnarok 550%/one-groggy/one-recovery behavior and later layout changes are excluded. Refer to later releases for those changes.

## Recorded validation

1,137 checks passed with no failures; 36 syntax checks; 4,800 full-state actions and 1,676 additional Succubus actions. All 11 published files match the preserved production readback. This was not an actual Discord interactive playtest.
