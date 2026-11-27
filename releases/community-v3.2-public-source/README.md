# Gen Bot v3.2: Final public source patch

- The existing **Reward** button shows each participant their own confirmed point payout without crediting them again. Nonparticipants can still claim 100 P once.
- Selected one-time private raid notices, including the Reward response, `Test closed.`, and `Entry cancelled.`, dismiss after 10 seconds. Public lobbies, raid logs, and active battle, tutorial, shop, and workshop screens are unchanged.
- Removed `/level` from registration and help. On startup, Gen Bot also removes its legacy global `/level` if it still exists. `/setlevel`, automatic XP, and existing player data are unchanged.

This revision is for **Gen Bot only**. It does not require a Gosu Raid or Pella update.

Apply `gen-raid-notices.patch` from the Gen Bot v3.1.1 source root with `git apply --unidiff-zero <patch-path>`, then copy `private-text-notice.cjs` to that root. Run `node private-text-notice.test.cjs` with the test beside the helper to check the 10-second cleanup and protected message types.

This is a source patch, not a production deployment package. Hosting configuration, integrity manifests, runtime data, credentials, and production assets are excluded.
