'use strict';
function tier(l){return Math.max(0,Math.floor(Number(l.criticalTier??(l.critical?1:0))||0));}
function counterTier(l,s){return Math.max(0,Math.floor(Number(l.counterCritTier??s?.lastCounterCritTier??0)||0));}
function label(n){return 'Critical';}
function color(n,fallback='#ffd578'){return fallback;}
module.exports={tier,counterTier,label,color};
