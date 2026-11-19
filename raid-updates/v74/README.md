# Raid update v74

Cumulative source and asset overlay for the deployed Discord bot, including the v55-v74 changes. This folder is not a standalone replacement for the original root-level bot. Keep the existing production dependencies, unchanged assets, environment configuration and account data. Copy only the files listed in MANIFEST.json into the corresponding paths of the deployed bot after backing it up.

## Included behavior

- Berserker: 150/250/400% charged attacks, fixed 500% Ragnarok, no stage critical bonus or charge/tackle defense bonus. Enrage grants +30 critical percentage points and 50% direct mitigation below 45 + DEF*0.1 percent HP. Blood Draw consumes 30% current HP/all energy, immediately adds a charge per two energy, and reserves +5 critical points per energy for the next stage-3 attack only. Tackle protects charge; two consecutive unprotected normal-hit turns break charge.
- Shared raid deadline: 23 hours after opening. Remaining boss HP means failure. Equal damage shares a rank. Only positive recorded damage qualifies. Success ranks settle after admitted battles finish, no later than the deadline. Manual raid replacement before completion does not grant failure rewards.
- Rank points: 1st 500, 2nd 400, 3rd-5th 300, 6th-25th 200, others 100. Add 1,000 on success or 200 on failure. Wallet credits and receipts are written atomically. Retried inventory grants are idempotent; unfinished settlements resume after restart. Previously completed legacy raids are not paid retroactively.
- Success loot: two equipment drops, one permanent stat potion, one normal enhancement scroll. Failure loot: one equipment drop and one normal enhancement scroll. Success rarity weights: Legendary 3%, Epic 20%, Rare 40%, Common 37%; failure: 1%, 10%, 40%, 49%. Each drop is independent and may belong to another class.
- 51 equipment templates and optimized 150x150 icons; randomized Rare/Epic rolls and fixed Legendary stats. Enhancement probabilities, milestones, scroll handling and gauge progression are included.
- Includes intervening Workshop, combat rendering, cache and memory fixes and prebuilt guides. Existing art and layouts are retained except for previously approved changes.

## Validation

In the deployed bot working directory, using its existing dependencies:

    node --test v74-raid-rewards.test.cjs v71-items-enhancement.test.cjs v71-item-integration.test.cjs

15 tests passed before upload. Berserker rules and real-engine integration were also checked for consecutive hits, Tackle protection, recovery gaps, fixed damage and Blood Draw preservation.

No .env files, authentication credentials, account balances, inventories, lobby snapshots, private logs, screenshots or node_modules are included. Some source modules retain existing guild/channel configuration IDs.
