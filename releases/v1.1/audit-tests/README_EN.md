# Gosu General TV Offline Click + Mongo Contract Tests

These **seven tests** run against the sanitized production-backup source files placed one directory above `audit-tests/`.

## What they cover

- Fake `interactionCreate` behavior for raid entry, class-selection ownership, stale/cancelled controls, and private shop message updates.
- In-memory MongoDB-like conditional-update behavior for simultaneous shop purchases, insufficient funds, duplicate raid reward receipts, and damage/rank ties.

## Required environment

- Node.js and source-side dependencies from a **sanitized, isolated** copy of the BotKeep backup.
- No Discord bot token, MongoDB credentials, internet access, or production player data.

```bash
node --test audit-tests/*.test.cjs
```

To run with the existing eight safety-patch regression tests, also copy the `safety-tests/` directory from the original safety patch package into the same project root:

```bash
node --test audit-tests/*.test.cjs safety-tests/*.test.cjs
```

**Mocked means mocked.** These tests do not hit real Discord or MongoDB and are not proof of production network latency, privileged-intent approval, or database transaction semantics. For real integration, use only a separate bot, isolated test guild, and disposable MongoDB replica set. Do not upload secrets.
