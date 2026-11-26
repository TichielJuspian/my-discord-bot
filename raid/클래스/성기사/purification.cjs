'use strict';
// Remove debuff components only: beneficial contract modifiers survive.
function removable(s){const e=s.offerEffects??s.offer;return !!(s.charmTurns>0||s.marks>0||s.sandstormTurns>0||s.contractPenalty||(e?.remaining>0&&((e.outgoing||0)<0||(e.incoming||0)>0||(e.attack||0)<0||(e.defense||0)<0||e.energyMultiplier>1)));}
function apply(s){const removed=[];if(s.charmTurns>0){removed.push('Charm');s.charmTurns=0;s.roundCharm=0;}if(s.marks>0||s.sandstormTurns>0){removed.push('Sandstorm');s.marks=0;s.sandstormTurns=0;s.berserkerCurseDamage=[];}if(s.contractPenalty){removed.push('Contract penalty');s.contractPenalty=null;s.roundPenalty=0;}
 for(const key of ['offerEffects','offer']){const e=s[key];if(!e||!(e.remaining>0))continue;if((e.outgoing||0)<0){e.outgoing=0;removed.push('Contract attack reduction');}if((e.incoming||0)>0){e.incoming=0;removed.push('Contract vulnerability');}if(e.attack<0){e.attack=0;removed.push('Contract ATK reduction');}if(e.defense<0){e.defense=0;removed.push('Contract DEF reduction');}if(e.energyMultiplier>1){e.energyMultiplier=1;removed.push('Contract energy surcharge');}if(!e.outgoing&&!e.incoming&&!e.lifesteal&&!e.attack&&!e.defense&&!(e.energyMultiplier>1))e.remaining=0;}
 return [...new Set(removed)];}
module.exports={removable,apply};
