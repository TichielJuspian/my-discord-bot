# Gen Bot v3.2: Private raid notices

This public source patch adds 10-second cleanup to explicitly selected, one-time private raid notices, including `Test closed.` from `/closetest` and `Test ended.` after leaving a test battle. It does not start a global timer for private Discord messages. Public lobby messages, logs, and active battle, tutorial, shop, and workshop panels are outside the cleanup.

- `gen-raid-notices.patch`: Gen Bot v3.1.1 → v3.2 raid notice changes.
- `gosu-raid-notices.patch`: companion changes against the Gosu Raid v5.0.2 runtime.
- `private-text-notice.cjs`: shared helper. Place it beside the patched modules on each bot. Apply each patch from its matching source directory with `git apply --unidiff-zero <patch-path>`. An initialized Git repository is not needed to apply the patch.
- `node private-text-notice.test.cjs`: tests the 10-second delay, private target selection, and safeguards against deleting public or interactive panels.

This is the source patch, not a complete deployment or database backup. Hosting configuration, integrity manifests, runtime data, credentials, and production assets are intentionally excluded.
