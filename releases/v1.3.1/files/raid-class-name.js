'use strict';
// Display labels only. Saved class IDs and legacy leaderboard records stay unchanged.
function name(value){const s=String(value??'');return /^(warrior|blader)$/i.test(s)?'Blader':s;}
function upper(value){return name(value).toUpperCase();}
function title(value){const s=name(value);return s.charAt(0).toUpperCase()+s.slice(1);}
module.exports={name,upper,title};
