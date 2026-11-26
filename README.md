# Gosu RAID v4.6 — Mobile combat status

Compared with the 4.5.2 MongoDB Activation r1 runtime:

- BUFFS and DEBUFFS sit below the battle controls, with exactly three logical lines each. Short names show the current combat values, and +N counts effects that do not fit.
- Battle action rows hold at most three buttons. Existing action order, button IDs, and actions are preserved.
- GUIDE and BACK behave as before. The status panel uses native Discord components and adds no battle image uploads.
- This release names the already-running 4.5.2 mobile status r3 code. The release does not change the Pella deployment.

## Public source-reading edition

This snapshot follows the v4.4.0 public battle and balance scope. It includes combat mechanics, battle components and Workshop presentation for review. Server integration, databases, runtime assets, production custom emoji identifiers, and player data are excluded. The public source is for reading and is not a server installation.

- [Native battle status](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/status-panels.cjs)
- [Battle component view](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/%ED%9D%90%EB%A6%84/view.cjs)
- [Three-button row layout](raid/%EB%B3%B4%EC%8A%A4/%EC%A0%84%ED%88%AC/raid-button-icons.js)
