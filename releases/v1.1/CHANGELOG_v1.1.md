# Gosu General TV Discord Bot — v1.1 (Staging Review Release)

**Release baseline:** November 11, 2026 BotKeep backup  
**Status:** Code published for review; **NOT deployed to BotKeep**. Live Discord API and isolated real MongoDB integration tests are still pending.  
**Source of truth:** The operator-provided BotKeep backup dated November 11, 2026, **not** the repository's legacy `main/index.js`.

## Operations cleanup (replaces the previously published v1.1 files)

| Feature | Previous bot / previous v1.1 | Updated v1.1 |
| --- | --- | --- |
| `/gift` | Member slash command opened a ticket / checked status | **Removed** from slash registration. Members use `Open my skin ticket` in the VVIP channel. `gift:open` and `gift:status` buttons remain valid. |
| `/rank` | Duplicate public command rendered the same card as `/profile` | **Removed** from slash registration. `/profile` continues showing level, XP, rank, points and cosmetics; existing `community:rank` buttons continue to work. |
| `/giftpreview` | Admin command called the member-status function and could open a real ticket | **Removed**. It was not a safe read-only preview. |
| `/giftsetup`, `/giftpanel`, `/giftqueue` | Admin-only setup, manual panel post, pending-request replay | **Retained as administrator recovery commands.** `giftpanel` now updates an existing bot-authored panel or safely restores it once; concurrent calls cannot post duplicates; channel mismatch/Discord history failure stops the operation. |
| `/boostinfo`, `/setboost`, `/clearboost` | Administrator diagnostic text still advertised 20% attack per stack | **Retained**; all text reads a single 10% constant shared with battle calculations. |
| Community guide and profile panel | Showed duplicate `/rank` advice and an extra `My rank` button | Only `/profile` and `/leaderboard` are promoted. Existing old button interactions are backward-compatible. |

No previously saved VVIP tickets, claim ledgers, shop points, role configuration, raid records, images or battle damage formulas are deleted or migrated by this code-only change. Removing slash commands takes effect only after deployment restarts and Discord guild command registration completes.

## What changed compared with the original BotKeep backup?

| Area | Before v1.1 | v1.1 proposed behavior |
| --- | --- | --- |
| Combat diagnostic AI | Could choose disabled `Guard`/`Cleanse` in some test cases | Chooses only currently legal actions; no combat damage formula changes |
| Workshop maintenance | Concurrent or failed maintenance could leave subsequent operations in an unsafe state | Serialize resets; fail closed after failure until an explicitly successful retry |
| Attack booster | +20% attack per stack | **+10% attack per stack**, reflected in combat and Workshop UI |
| Successful raid payout | Earlier baseline result table | **900 P base + rank bonus** (1st +500, 2nd +400, 3rd–5th +300, 6th–25th +200, remaining +100) |
| Failed raid payout | Earlier baseline result table | **100 P base + the same rank bonus**, for eligible participants |
| 0-HP victory claim | No nonparticipant spectator claim button | **100 P once** for eligible nonparticipants on a successful raid; blocked for contributors; unique receipt prevents duplicate credit |
| Raid scheduling | Admin-created test raids, without the new automated loop | `/raidset`: 23-hour raid; settle after deadline; 1-hour rest; select a different enabled boss; recover scheduled state on restart |
| Class change | Beta class switching was free | First selection free; subsequent changes **cost 1,000 P**, with explicit confirmation and recoverable payment journal; stopping the scheduler does not re-enable free changes |
| VVIP ticket | Discord-managed role gate; requester-visible ticket; delayed deletion after confirmed delivery | Preserve managed VVIP verification and applicant form; notify operator when ticket opens; on **operator-confirmed delivery**, archive and verify before immediate deletion; retain ticket if archive/permissions fail |
| Boss metadata | Names, rotation choices, HP, artwork, UI labels repeated across modules | Central `raid-boss-registry.js`; Earth Colossus and Nameless Succubus enabled; **Icy Dragon disabled** until its combat and art are ready |

### Raid rank payout matrix

| Damage rank | 0-HP victory | Failure after 23 h |
| --- | ---: | ---: |
| 1st | 1,400 P | 600 P |
| 2nd | 1,300 P | 500 P |
| 3rd–5th | 1,200 P | 400 P |
| 6th–25th | 1,100 P | 300 P |
| 26th+ | 1,000 P | 200 P |

Positive recorded damage qualifies for ranking. Ties share rank. The spectator Claim reward is separate, victory-only, and not payable to contributors. Existing ledger receipts are not retroactively rewritten.

## Source files included

The cumulative patch contains **28 source modules** (25 replacements and 3 new files) relative to the November 11 BotKeep baseline. New modules: `raid-scheduler.js`, `raid-boss-registry.js`. It also includes regression tests, SHA-256 compatibility manifest, a read-only target verifier, English documentation, and onboarding guide.

**Never** copy GitHub's legacy root `index.js` over the deployed bot. The ZIP is a file-level *overlay* for the exact matching BotKeep baseline, not a standalone bot. The patch does not include dependencies, runtime settings, original art, user data, or production journals.

## Verification performed

- **56/56 offline tests passed**, verified again before publishing.
- **54 deterministic existing combat scenarios** matched their original traces.
- **4 existing boss lobby/rules images** matched expected SHA-256 raster outputs.
- **241 existing source images** were byte-for-byte unchanged; no resizing or recompression.
- Read-only before/after SHA verification is available as `verify-target.cjs` and `manifest.json` inside the ZIP.
- **Not performed:** live Discord component interaction testing, real MongoDB concurrent transaction testing, production BotKeep restart/deployment, or live payout migration.

## Deployment and rollback warnings

1. Make a **fresh** BotKeep source, MongoDB, and journal backup on deployment day. The original v1.1 source baseline can be stale if BotKeep changed after November 11, 2026.
2. Extract the ZIP into a disposable staging directory. Run the preflight file SHA verifier against an unmodified baseline copy; any mismatch means stop.
3. Apply **only** the `files/` overlay in staging; rerun the postflight SHA verifier and the full test suite.
4. Use a separate Discord test bot/guild and isolated MongoDB database for real integration and reboot tests.
5. Review any active raid payout or pending class transaction before rollout or rollback. Never downgrade live data blindly.
6. Promote to production only after the operator reviews the results. This GitHub update **does not deploy to BotKeep**.

## Security and scope

No `.env` file, bot token, database connection string, personal inventory, player database, tickets, transcripts, original image/font assets, or `node_modules` is published. The v1.1 ZIP contains only reviewed source changes, synthetic tests, manifests, and documentation. Hard-coded public Discord configuration identifiers that already appear in source code are not treated as credentials; server permission checks must still be validated live.

## Follow-on milestone

Build and run real Discord and MongoDB integration tests in an isolated environment. Implement Icy Dragon's symbol memory puzzle and art as a separate disabled feature; activate it only when its logic, artwork, UI, and regression tests are complete.
