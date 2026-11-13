# Gosu Bot v1.3.1: verified coordinated change patch

This directory preserves the exact **25 files** in the final coordinated deployment completed on 2026-11-13 (15:35 UTC). Each archived file was rechecked against the frozen release and its production readback before publication.

**This is a historical incremental patch, not a complete bot and not a cumulative upgrade from v1.3 or v1.1.** Intermediate production updates are required. Do not install it over a newer production build or use the repository root as its runtime baseline.

See [CHANGELOG_EN.md](CHANGELOG_EN.md) for scope and verification limits. `manifest.json` records SHA-256 before/after values. `SHA256SUMS.txt` lists the published file hashes. `files/` preserves original deployed source and map bytes.

The canonical artwork map depends on separately installed artwork. No image binaries, credentials, environment files, database exports, player records, inventories, live raid state or private backup paths are included. The unchanged owner/guild/role configuration IDs already published in v1.1 remain in the original source; these are identifiers, not credentials.

Successful curse interruption is verified in engine/full-panel fixtures to show Hit with no boss attack, then enrage on the following action. Actual Discord interactive reproduction has not been completed. This archive must not be interpreted as that live playtest.

Publication only adds an archive directory; it does not change existing repository source, deploy or restart the bot.
