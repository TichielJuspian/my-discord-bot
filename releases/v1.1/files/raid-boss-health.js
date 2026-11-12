'use strict';
const registry=require('./raid-boss-registry');
const maximum=boss=>registry.requireEnabled(boss).worldHP;
function restoreRemaining(saved,boss){
 if(saved.hp<=0)return 0;
 const oldMax=saved.maxHP??registry.requireEnabled(boss).legacyHP;
 return Math.max(0,Math.min(maximum(boss),maximum(boss)-Math.max(0,oldMax-saved.hp)));
}
module.exports={maximum,restoreRemaining};
