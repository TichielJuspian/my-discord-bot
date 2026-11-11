# Warrior artwork v1 — DRAFT / NOT DEPLOYED

Presentation-only integration for the final user-approved silver-haired swordsman design. No combat rules, stack calculations, Perfect Parry probability, energy, boss AI, balances or inventories are changed. The normal and legendary sets each contain 13 poses; seven skill-guide icons are included in the accompanying asset package. The existing 128 x 128 portrait rectangle is retained.

## Delivery boundary

**This branch contains implementation, installer, tests and checksums, but NOT the PNG files or `raid-warrior-art-v1.json`.** The complete companion package is the ChatGPT attachment `Warrior_Raid_Art_Update_v1.zip`, 3,130,734 bytes / 44 entries.

Verified ZIP SHA-256:

`165263788524944127bde9b6cb888c1690ba2848b2b543529106dad16613ec94`

Runtime JSON SHA-256:

`421415a57744faab4fcc979e4852af4efb00dffeaa1b32485793ba6bc39f5433`

Unpack the complete package before testing or installing. Cloning this branch alone is not sufficient. The ZIP includes the same JS/CJS files as the initial PR commit, with matching Git blob SHAs, 33 PNG files, runtime JSON, manifests, Korean instructions, test output and two layout previews. It contains no fonts, tokens, environment files or user data.

No production files have been modified and no bot or render worker has been restarted. This is not a deployment-ready PR by itself. The repository does not contain the complete current production runtime.

## Integration

The guarded installer patches only four presentation modules: `raid-portrait-quality.js`, `raid-legendary-motion.js`, `raid-static-card.js`, and `raid-skill-guide.js`. It adds `raid-warrior-art.js` and the runtime asset JSON. Expected source blob hashes are pinned to the reviewed raid v74 modules at commit `21a2250f23b3dec2b6772aef7bd430bf85f378d6`. A different production revision is rejected without changing files; do not bypass this guard or replace production with the repository root.

Normal and Deep Thrust each select A/B from consecutive committed `thrust` log entries. Rendering/reopening does not mutate combat state or change the sequence. A non-thrust turn resets the next display to A. Existing equipment rules still select the legendary appearance. Other classes retain their existing paths. Warrior prebuilt guide images are bypassed so the new portraits and icons are visible. Missing source for class-selection/workshop screens prevents claiming complete integration coverage there. Mechanic text on the concept board is deliberately not imported.

The PNGs were prepared from the approved board, not newly generated as separate high-resolution artwork. The accompanying card preview is a layout mockup, not a live Discord screenshot.

## Validation and installation

From the unpacked complete package:

```sh
node --test warrior-art.test.cjs
node install-warrior-art.cjs --root /actual/bot/runtime
```

The second command is a dry run. After it passes, stop the bot using the normal management procedure, accounting for ongoing battles, then:

```sh
node install-warrior-art.cjs --root /actual/bot/runtime --apply
```

Existing files are backed up under `.warrior-art-backups/`. The installer never restarts services. Restart through the usual deployment procedure and verify both skins, A/B thrusts, guide icons and exceptional states in a test channel. Stop the bot before rollback as well. Rollback refuses to overwrite edits made after installation:

```sh
node install-warrior-art.cjs --root /actual/bot/runtime --rollback /path/to/recorded/backup
```

43 local unit tests passed with the companion assets: PNG/RGBA decoding, portrait boundaries, A/B determinism and state immutability, non-warrior selector preservation, equipment-gate placement, guide-patch fragment syntax, incompatible-runtime refusal, backups and rollback protection. JS/CJS syntax checks passed. Full original-runtime patch application, Discord/MongoDB integration, class-selection screen and live message transport were NOT tested. Preserve all existing production dependencies and user data.
