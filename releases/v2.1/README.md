# Gosu General TV Discord Bot v2.1

This is an incremental source release containing 29 runtime files: 24 JavaScript/CommonJS modules and 5 PNG assets. It requires a compatible, already-deployed v2 installation. It is not a complete bot distribution.

## Contents

- `files/`: the exact reviewed source and selected assets.
- `PUBLIC-CHANGELOG.md`: English change notes.
- `manifest.json`: file scope, required predecessor hashes, output hashes and unchanged dependency checks.
- `SHA256SUMS.txt`: checksums for the published runtime files and release documents.

## Compatibility and installation safety

The repository root and earlier release folders are not a complete current installation baseline. In particular, v1.4 predates the deployed v2 modules and subsequent source changes. Do not copy the legacy root over a current bot or treat this directory as a standalone installation.

Verify every required predecessor and dependency SHA-256 before copying files. New paths must be absent. Stop on any mismatch and reconcile that file with the current installation instead of overwriting it from an older snapshot. After applying the overlay, read back every target and verify its final SHA-256.

Preserve all unlisted source, dependencies, artwork, configuration, environment variables, credentials, databases, player data, logs and journals. This release contains no historical backups, environment files, credentials or player datasets. It performs no database migration, rewards backfill or gear change.

Source-file upload and runtime activation are separate results. Publishing this source does not restart BotKeep or prove that an already-running Node.js process has reloaded changed modules. Live Discord behavior remains a separate verification step.

## Verification

- The final combined offline suite completed 248 tests: 245 passed, 0 failed and 3 skipped.
- Skips: a superseded 50:50 layout test, an isolated Berserker dependency-parity check superseded by the cross-class overlays, and an isolated other-class parity check superseded by the Paladin Energy change.
- Eight bundle guard checks passed.
- All 24 published source modules passed syntax checks.
- All 29 published runtime files were checked against their manifest SHA-256 hashes.
- Guide checks use documented archived portrait sources. Workshop rendering checks include portrait/font test stubs, so they do not establish complete live-art rendering parity.
- These checks do not claim live Discord functional testing, production database execution, runtime restart/activation verification or a byte comparison of persistent player data.

## Repository preservation

This release is added only under `releases/v2.1/`. Repository-root files and earlier release directories are preserved.
