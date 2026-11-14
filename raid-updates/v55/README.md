# Raid v55: re-entry, reset and results fixes

This is a patch bundle for the separately deployed **v54 raid runtime**. The repository's root bot predates that runtime. These files are not a standalone bot and do not replace the root entrypoint.

## Changes

- Leaving before the first combat turn releases admission. A zero-turn exit does not replace the previous run or create a score.
- Battle closure releases gameplay state before Discord message cleanup. Cleanup requests have bounded waits.
- `/raidtest` resets old controllers, including in-flight turns. Old lobby cleanup runs independently and cannot block a later reset. History-read failures do not prevent creating the next raid; old controls expire even when Discord refuses deletion.
- Colossus's initial, empty-log state explicitly selects the existing idle artwork. `colossus-ready-v55.jpg` is a byte-identical copy of the approved idle image, not new/generated art.
- Paladin legendary weapon base critical damage: +50% to +40%. Enhancement bonuses remain unchanged.
- Displayed Hammer Smash name becomes Smash across buttons, guide and effect text. Internal action IDs remain stable.
- Personal best and previous completed run damage/turns appear automatically in the existing private battle panel. No new button or history browser. The public recent-activity card reflects personal-best updates, not weaker retries.

## Apply

1. Back up the deployed raid source and persistent data. Keep all existing art, configuration, dependencies and account data.
2. Copy `files/` into the v54 runtime root, preserving filenames. Do not copy this repository's older root `index.js` over the running bot.
3. Run the included tests from that runtime root: `node --test v55.test.cjs raid-finish-battle.test.cjs`, then `node v54.test.cjs`.
4. Restart the bot once. Use `/raidtest` to publish the fresh lobby. Existing public messages are refreshed/replaced by the normal lifecycle.

## Validation

12 focused tests pass: zero-turn repeat entry, reset during stalled deletion, reset during an in-flight turn, private results isolation, weaker retries, best-record ordering, initial art, naming, base/enhancement stats, and finish error handling. The v54 regression script also passes.

Tests mock Discord transport; they do not assert real Discord network latency or live click behavior. No credentials or player databases are included.
