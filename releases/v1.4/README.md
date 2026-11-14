# Gosu Bot RAID v1.4

This is the incremental source release deployed on 2026-11-14. It contains 25 source files: 23 replacements and two new modules. It is not a complete bot distribution. The repository root and earlier release folders are not a complete current installation baseline.

## Scope

This release updates critical-hit calculation, Blader/Paladin/Berserker balance, Legendary equipment base stats, equipment labels and test-inventory cleanup support. See PUBLIC-CHANGELOG.md for the English change notes.

Existing item IDs, class restrictions, enhancements and appearances are preserved. The test-only class-switch cleanup feature is disabled by default and requires RAID_TEST_CLASS_GEAR_CLEANUP=1 to enable. This release does not enable it automatically.

## Source and installation safety

- files/ contains the exact 25 source files verified against the deployed production files.
- manifest.json records the required predecessor hashes for existing files and the deployed hashes for all files.
- SHA256SUMS.txt covers the source files and release documents.
- Apply only to a matching, complete production baseline. Do not replace a running bot with this directory or deploy the repository root as a complete current bot.
- Preserve configuration, environment variables, credentials, player data, databases, logs and all files outside the manifest.
- A controlled stop, source backup, exact-file replacement, readback verification and restart are required for a deployment. A restart clears in-memory sessions.

## Verification

- 69 focused offline tests passed: 34 deterministic balance tests, 26 test-inventory tests and nine existing item/enhancement/payment-journal tests. The inventory tests include 300 mixed class-switch/drop sequences.
- 1,440 seeded current-engine simulations completed across 24 level/boss/class cells with 30 paired seeds per cell.
- All 25 production source files passed syntax checks.
- All 25 files downloaded from production after deployment matched their manifest SHA-256 hashes.
- Production started at 2026-11-14 00:40:39 UTC. A fresh COMMANDS REGISTERED message and Running status were verified at 00:42:13 UTC.

These checks do not claim real-user Discord functional testing, raster-render validation, or a byte comparison of persistent player data. No secrets, configuration files, database exports, backups or player datasets are included.
