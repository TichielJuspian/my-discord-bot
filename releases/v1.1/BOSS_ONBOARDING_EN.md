# Adding a New Raid Boss — Developer Guide (English)

## Registration does not equal activation

The new `raid-boss-registry.js` defines stable metadata for every approved boss. `icy_dragon` is intentionally present as a disabled placeholder; it has **no playable combat implementation, memory-seal interaction flow, or image pack**. Do not simply flip `enabled` to `true`.

### 1. Create game content

1. Choose a unique, permanent boss ID (example `icy_dragon`), a display name, a 32-character-or-shorter Discord slash subcommand, and world HP. Never rename an ID after the first raid because journal and payout receipts depend on it.
2. Create and verify entrance/defeated artwork and a dedicated `art(s, resultOnly)` provider that returns the correct file path and description for every boss state. Keep original file dimensions, file sizes and compression unchanged unless the operator separately authorizes changing them.
3. Add a fully functioning combat `R.BOSSES[id]` definition and boss-specific attack pattern logic in the existing combat engine. Review `raid-engine/gimmick-trial-engine.cjs`, `pattern-director.cjs`, `enrage-stages.cjs`, and custom mechanic modules. The registry cannot implement boss behavior merely by naming it.
4. Implement all Discord components for unique mechanics: signed/stale-safe action IDs; per-user/per-raid ownership; expiration; duplicate-click protection; timeouts; and safe restart recovery. For Icy Dragon's proposed memory seal, implement the symbol display, hidden sequence, input-validation and success/failure resolution. Do not expose it in live rotation without testing.
5. Confirm reward tables and timed raid handling need no changes for the new boss. Avoid new receipts or payout rules unless intentionally versioned.

### 2. Add the registry entry

In `raid-boss-registry.js` provide:

- `id`, `name`, `title`, `leaderboardName`, `shortName`
- `enabled: false` while under development; `autoRotation: false` until approved
- `worldHP`, `legacyHP` for the new boss's migration policy
- `storageSuffix` (unique and permanent) and `testCommand` with unique name/description
- `artModule`, optional `readyArt`, `lobbyArt.entrance`, `lobbyArt.defeated`, and `lobbyColors.fog`/`rune`

The shared scheduler, lobby name/card, registration, and rules display will then read these values. **Existing boss-specific mechanics remain in their dedicated modules.** Do not manually patch the scheduler's boss list.

### 3. Safety rollout sequence

1. Keep the boss disabled while building it. Run the existing full suite first (46 tests).
2. Add deterministic unit tests for normal/heavy/special attacks, enrages, status effects, new gimmick, win/loss and 0-HP conditions. Add character-specific interaction tests.
3. Ensure all scene assets exist, every state renders, and the new button handler cannot accept clicks from another user, battle or generation.
4. Set `enabled: true` and `autoRotation: false` only in a staging build after full tests pass. Test `/raidtest` manually with a separate Discord bot and isolated MongoDB; ensure lobbies and journal paths are unique.
5. Verify 23-hour settlement + 1-hour cooldown with a mocked clock; test concurrency, restart recovery, old journal safety, and class-specific rewards with isolated database and Discord API.
6. Only then set `autoRotation: true`. With 3 bosses the next selection is uniformly random among the other 2; it is **not** guaranteed that every boss appears before repeats. Disable again only through a reviewed migration plan if a scheduled raid is already active.

### 4. What not to do

- Do not copy the outdated GitHub `main` `index.js` into BotKeep.
- Do not upload `.env`, credentials, player inventories, ticket transcripts, or wallet data to public GitHub.
- Do not change a boss ID, storage suffix, existing reward journal, or first successful receipt after payouts begin.
- Do not claim that the 46 offline tests provide production integration coverage.
