'use strict';
function remaining(s){const p=s.director?.phase;return s.config?.boss==='earth'?(p==='struggle'||p==='struggle_start'?2:1):(p==='struggle_start'?2:1);}
function failureDamage(s,turn=s.turn){return ['earth','nameless_succubus'].includes(s.config.boss)?(require('./enrage-stages.cjs').values(s).mechanicDamage??Math.ceil(Math.max(s.hp,s.stats.hp))):(s.director?.specialFailureDamage??80+Math.max(0,turn-12)*10);}
function previewDamage(s){return failureDamage(s,s.turn+remaining(s)-1);}
function failureLabel(s){return ['earth','nameless_succubus'].includes(s.config.boss)&&require('./enrage-stages.cjs').level(s)===3?'Instant defeat (Last Stand eligible)':'-'+previewDamage(s)+' HP / ignores mitigation';}
module.exports={remaining,failureDamage,previewDamage,failureLabel};
