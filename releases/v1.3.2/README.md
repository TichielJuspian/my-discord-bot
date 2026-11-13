# Gosu Bot v1.3.2: Shared Maximum Attack Growth

This is a two-file incremental production patch, not a complete bot distribution. It was deployed after the coordinated v1.3.1 update. Match the predecessor hashes in manifest.json before using it; earlier historical archive directories are not a complete installation baseline.

Maximum growth is now applied once in the shared direct-hit loop before mitigation. Current Colossus and Succubus normal/heavy damage remains unchanged. Future bosses using this loop inherit the growth at enrage level 3; their base attacks and stage progression must still be implemented.

## Deployment verification
The entire 19-file production engine was downloaded and matched the tested baseline before replacement. Exactly two files were replaced while the bot was stopped. A fresh complete engine download matched the candidate: both new files exact, other 17 unchanged. All 19 syntax checks passed. One subsequent Start reached fresh Running status and the bot's commands-online startup message.

No database commands, raid resets, player-data file edits, class changes, artwork changes or other source uploads were performed. A normal restart clears in-memory personal sessions. This is not a claim that persistent data was byte-compared or that actual Discord combat was tested.

See CHANGELOG_EN.md for the rule and offline test results. No secrets or player datasets are included. This patch retains existing rounding and mitigation behavior.
