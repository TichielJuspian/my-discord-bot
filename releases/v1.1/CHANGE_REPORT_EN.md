# Gosu Bot — Boss Registry Refactor: Change Report (English)

**Source baseline:** the user-provided BotKeep backup (November 11, 2026) with SafePatch v1 staged in an isolated working directory. **Deployment:** not performed. No real Discord clicks or production MongoDB writes.

## Why this refactor

The previous implementation had independent hardcoded boss lists and labels in the scheduler, raid controller, lobby, HP migration, UI status card, rules card, and battle art routing. This made adding Icy Dragon or any fourth boss require synchronized edits in many places. The new registry centralizes common metadata but deliberately leaves complex per-boss combat mechanics in their existing engine modules.

## Scope

- **7 edited files + 1 new registry source file**, affecting only boss registration, selection metadata, visual routing, HP lookup, command registration and safety checks. Existing Raidset/VVIP functionality from SafePatch v1 remains unchanged.
- **21 total cumulative patch source files** (SafePatch v1 plus registry changes); this is not an unrelated change to 21 modules in the new refactor.
- Existing `earth` and `nameless_succubus` IDs, command names, ledger IDs, journal filenames, base HP, art, titles, and reward behavior are retained.
- `icy_dragon` is deliberately disabled and has no combat implementation or image assets in this release.

## Exact compatibility checks

- 36 pre-existing automated regression tests: **36/36 PASS**.
- 10 additional tests: **10/10 PASS** (registry readiness, disabled boss guard, legacy migration, dynamic registration, unchanged commands/filenames, rotation semantics, lobby UI, initial battle art, baseline raster hashes).
- Total **46/46 PASS** from the unmodified previous patch staging and new test suite.
- 54 deterministic battle traces remain unchanged.
- HP card SHA-256 baselines: Earth `eacdc019aefa4773d3c2e481a5c3c7b7915aca130f247877d189e46aab77adf4`; Succubus `170f26d63bd27384c23f20965250478b4e33dafeb452ffae0f5997917fdfb31a`.
- Rules card SHA-256 baselines: Earth `3be7b0bdfdd0cc25021244569b08645806809c50ea58563aa24e6dc7bcc7e066`; Succubus `31eeacf9ad69ca725beb0f91436c62b0f1c5cd76e34e7330cc9265abbe224ee2`.
- 241 image files in the staged source: byte-for-byte unchanged; no resizes or re-encodes.

## Key limitations

- Metadata alone will not create new boss attack patterns, the Icy Dragon memory puzzle, mechanics-specific Discord controls or new art packs.
- If a future boss is misconfigured, readiness checks may prevent the raid subsystem from starting. Test in staging before deploying the source changes; do not enable an incomplete boss.
- The original server's Discord privileges, real MongoDB transactions, live click latency, automatic restart behavior and production payout queues were not exercised.
- After the original BotKeep backup date, live files may have changed. The ZIP is safe to *review* but must not be blindly deployed; hash check is required and a mismatch means STOP.

## Next staging milestone

Run real interaction and MongoDB integration tests against separate accounts, followed by a controlled rollout. Build the Icy Dragon puzzle as a distinct, disabled feature branch; do not enable its rotation entry until all expected combat and art assets are implemented.

## v1.1 Operations cleanup

- De-registered `/gift`, `/rank`, `/giftpreview`; profile and VVIP panel buttons remain available.
- Kept administrator-only `/giftsetup`, `/giftpanel`, `/giftqueue`, `/boostinfo`.
- The existing `community:rank` button remains compatible; new guide omits duplicate rank UI.
- The manual and startup VVIP panel flows share a safe upsert with duplicate prevention and channel checks.
- Corrected the booster administration text to 10% attack per stack, sourced from the raid combat constant.
- 56/56 offline regression tests passed; real Discord and isolated MongoDB integration not yet run.
