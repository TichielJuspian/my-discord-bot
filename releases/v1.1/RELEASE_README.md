# v1.1 — Gosu Bot SafePatch (review only)

This directory contains the cumulative, English-documented source patch and tests for **Gosu Bot v1.1** relative to the **November 11, 2026 operator-provided BotKeep backup**.

- [English v1.1 changelog](./CHANGELOG_v1.1.md)
- [Download v1.1 code, tests, SHA verifier and development guide](./GosuBot-v1.1-SafePatch.zip)

**Important:** the repository's root `index.js` and `package.json` describe the older bot; they are NOT a deployable v1.1 build. Do not overwrite BotKeep directly from GitHub. The archive is a **baseline-checked delta** containing 28 code modules, a disabled Icy Dragon registry entry, streamlined member commands, VVIP panel deduplication, tests and documentation. It requires matching pre-existing runtime files and assets. No user data, secrets, or artwork is included.

**Validation:** 56/56 offline tests; real Discord and MongoDB integration remains outstanding. **Deployment:** NOT performed.
