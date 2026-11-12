# Gosu Bot — SafePatch v1.1: Boss Registry + Raidset/VVIP (EN)

**Status: REVIEW CANDIDATE / NOT DEPLOYED.** The user-provided BotKeep backup from November 11, 2026 is the only valid source baseline. The public GitHub `main` is outdated and MUST NOT be deployed or used as the patch target.

This is a **cumulative patch**: it includes all reviewed SafePatch v1 Raidset/VVIP changes **plus** the new Boss Registry refactor. Apply v1.1 to an unmodified copy of the **original BotKeep backup**. **Do not install earlier individual patches on top of this cumulative v1.1 release.** If the server was updated after the backup, STOP and rebase the patch onto a fresh backup instead.

## User-visible behavior

- No changes to active raid duration (23 h), settlement (at the 23-hour deadline), next-boss cooldown (1 h), reward payouts, Claim eligibility, permanent class-switch payment, VVIP workflow, booster percentages, or any character/boss artwork.
- Earth Colossus and Nameless Succubus retain their original IDs, art, commands, HP, reward ledgers, lobby filenames, and rotation behavior.
- Icy Dragon is **NOT implemented or playable**. It has only a disabled metadata entry. It does not appear in `/raidtest`, does not receive a lobby, and cannot appear in automatic raids.

## Changed code locations

- `raid-boss-registry.js`: new single metadata catalog and startup readiness validator
- `raid-scheduler.js`: automatically reads only enabled rotation IDs and display names
- `raid-test.js`: creates enabled boss lobbies and slash subcommands from the registry; preserves all previous IDs and journal filenames
- `raid-lobby.js`, `raid-lobby-card.js`, `raid-rules-card.js`: registry-driven name, HP, lobby art, and theme metadata
- `raid-boss-health.js`: reads HP + legacy recovery limits from the registry
- `raid-panels.js`: dispatches to each registered boss's existing image module; falls back to the prior logic for non-registry diagnostic bosses
- Other files in `files/`: previous Raidset/VVIP/boost/class-switch safety patch, unmodified from its v1 release unless also listed above

## Applying to a disposable test copy (NOT live BotKeep)

1. Make and keep a separate backup of your CURRENT running BotKeep server, MongoDB, player data, and raid journals.
2. Extract the original November 11 BotKeep backup into a disposable test copy. Remove `.env`/real secrets and player data from the test copy; supply isolated test credentials only if running integration tests.
3. Run `node verify-target.cjs /path/to/test-copy before` **from this patch directory**. It must say PASS. Any mismatch means STOP. The checker never edits the target.
4. Copy the entire contents of `files/` to the **root of the disposable test copy**, preserving relative directories and filenames. Do not copy any original user data back from this ZIP; there is none.
5. Run `node verify-target.cjs /path/to/test-copy after` and confirm PASS.
6. Copy `production-tests/`, `safety-tests/`, `audit-tests/` to the test copy. Then execute from its root: `node --test production-tests/*.test.cjs safety-tests/*.test.cjs audit-tests/*.test.cjs`.
7. For deployment sign-off, perform **real Discord component interaction tests and real isolated MongoDB transaction tests** before even considering live migration. Use a separate bot token, test guild, isolated DB and dedicated storage files.
8. Do NOT overwrite running `raid-characters.json`, raid lobby or scheduler journals, wallets, tickets, the database, or `.env`. A code-only rollback while a payout is underway may require ledger reconciliation.

## Safety checks

- Original image bytes, dimensions, and compression remain unchanged; no binary art is in this patch.
- `raid-boss-registry.js` validates required boss engine IDs, entry/defeat images, artwork provider and unique command/storage identifiers at startup; malformed new boss definitions stop the raid subsystem from starting rather than silently creating a wrong boss.
- A registered boss can join rotation only when it is explicitly marked `enabled:true` and `autoRotation:true` **after the engine, art, interactions, and tests have been integrated**.
- Original schedule and settlement receipt formats are unchanged; this release creates no new persistent user data schema.

## Results

- **56/56 offline tests passed** including the previous 36 regression tests and 10 new boss registry checks.
- Existing 54 deterministic combat traces are identical to the pre-refactor fixtures.
- The Colossus and Succubus HP cards + neutral rules cards generated **identical SHA-256 hashes** to the original post-v1 baseline.
- 241 available source image files compared byte-for-byte; 0 differences.
- **Not tested:** real Discord API latency, live interactive button clicks, actual MongoDB concurrency, BotKeep process management, and deployment/restart with production journals.

Read `BOSS_ONBOARDING_EN.md` before adding a new boss. Read `CHANGE_REPORT_EN.md` for the full technical report.

### Operations UI cleanup

Removed `/gift`, `/rank`, and `/giftpreview`. Retained admin recovery commands. Old ticket/rank buttons still work; the panel repair command uses a single-flight idempotent upsert. The `boostinfo` display now uses 10% ATK per stack.
