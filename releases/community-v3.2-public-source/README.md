# Gen Bot v3.2: Private raid reward receipts

- The existing **Reward** button shows each raid participant their own confirmed point payout. Looking up a payout never credits the participant again. Nonparticipants can still claim 100 P once.
- Selected private raid notices, including the Reward response and `Test closed.`, are set to dismiss after 10 seconds. Public lobbies, raid logs, and active battle, tutorial, shop, and workshop screens are unchanged.
- Removed `/level` and its help entry. `/setlevel`, automatic XP, and existing player data are unchanged.

This revision is for **Gen Bot only**. It does not require a Gosu Raid or Pella update.

Apply `gen-raid-notices.patch` from the Gen Bot v3.1.1 source root with `git apply --unidiff-zero <patch-path>`, then copy `private-text-notice.cjs` to that root. Run `node private-text-notice.test.cjs` with the test beside the helper to check the 10-second cleanup and protected message types.

This is a source patch, not a production deployment package. Hosting configuration, integrity manifests, runtime data, credentials, and production assets are excluded.
