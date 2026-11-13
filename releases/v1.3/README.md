# Gosu Bot v1.3: historical deployment patch

This directory archives the exact 11-file patch verified online on **2026-11-13 at 09:06:59 UTC**. It is not a complete bot distribution, not a cumulative update from the repository root or v1.1, and not the current production build.

Later v1.3.1 and subsequent changes are intentionally excluded. Do not apply this historical patch over newer production files.

## Contents and provenance

- `files/`: original source bytes of the 11 deployed files.
- `manifest.json`: SHA-256 for every file, predecessor hashes, deployment timestamp, and recorded test summary.
- `CHANGELOG_EN.md`: scope of this historical patch.
- `SHA256SUMS.txt`: per-file checksums.

Aggregate source manifest SHA-256: `73dc6fcbc742a25b619936506559f338775e26ddf77766f1af73b2c9d1eaf468`.
This is a digest of sorted `relative-path + NUL + file-sha256 + newline` records, **not a ZIP checksum**. All 11 archived source files were rechecked against both the frozen release and its production readback before publication.

## Compatibility

The patch requires the matching production baseline immediately preceding this deployment. The manifest identifies predecessor hashes for the 10 replaced files; the Colossus director is new. Other runtime modules, dependencies, fonts and artwork must already be present. The files do not constitute a standalone executable release.

No credentials, environment files, database exports, player records, inventories, raid state, backups or private local paths are included. Existing repository files remain unchanged.

## Verification limits

The original release recorded 1,137 passing checks (588 engine, 549 UI), 36 syntax checks, 4,800 full-state actions and 1,676 additional Succubus actions. These are historical recorded results, not a claim that every suite was rerun for this archive. Original deployment readback and application-online verification succeeded. Actual Discord interactive combat testing was not performed for that release.

This GitHub publication does not deploy, restart, or modify the running bot.
