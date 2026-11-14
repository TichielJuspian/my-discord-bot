# Gosu Bot RAID v1.4

## Balance and critical hits

- Critical chance caps at 100%; each excess percentage point adds one percentage point of critical damage. Multi-tier critical hits are removed.
- Legendary weapon/armor/accessory base stats are standardized across Blader, Paladin and Berserker. Enhancement bonuses, item IDs, class restrictions and appearances remain.
- Blader: Slash 160% ATK; Deep Thrust unlocks at Hone 8 with exclusive +10 percentage points critical damage. Perfect Parry depends on Hone, not permanent parry-success growth. Sharp Eye grants Thrust critical chance; Sixth Sense grants +15 percentage points and retains 2% healing.
- Paladin: Blessing critical chance becomes +10 percentage points per stack; Divine Smite adds +10. Existing damage, defense and healing remain.
- Berserker: Enrage threshold is min(60%, 50% + DEF x0.1 percentage points), with 60% direct mitigation and no critical-chance bonus. Blood Draw costs 25% current HP and grants a separate 10% guaranteed-critical proc per absorbed Energy to the next Charge 3 attack. Charge 2 heals 1%; Charge 3 retains 500% ATK/4% healing and costs no Energy. Emergency Evade preserves charge.
- Ragnarok remains 550% ATK with one Groggy turn, existing Recovery, and cancellation of queued attacks.

## Equipment presentation and test inventory

- Corrected rarity labels; Normal/Common names remain unprefixed. Quality remains 90–110% (Q50 = 100%) and is displayed only on the equipment screen.
- Test-only class-switch cleanup can reclaim proven test Legendary grants from the previous class. It preserves Epic comparison gear, earned/unknown legacy items, enhancements and skins; disabled by default.

## Validation

- 34 deterministic balance tests and 26 test-inventory tests passed, including 300 mixed class-switch/drop sequences.
- Nine existing item/enhancement/payment-journal tests and focused UI checks passed.
- Independent review found no blocking critical calculation or healing defect.
- Seeded current-engine simulation results and deployment verification are tracked separately. These checks do not claim live Discord or raster-render validation.
