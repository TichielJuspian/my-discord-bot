const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// v2.0 Playtest-only owner adjustment: exactly +3 on Succubus's second
// normal-combo position. Apply after stage scaling and before any defenses.
const SECOND_NORMAL_HIT_BONUS = 3;
function secondNormalHitDamage(state, kind, hitIndex, scaledDamage) {
  return scaledDamage + (state.config?.boss === 'nameless_succubus' &&
    kind === 'N' && hitIndex === 1 ? SECOND_NORMAL_HIT_BONUS : 0);
}
module.exports = { SECOND_NORMAL_HIT_BONUS, secondNormalHitDamage };
