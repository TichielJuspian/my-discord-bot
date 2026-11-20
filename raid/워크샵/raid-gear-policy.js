const runtimePaths = require("../runtime-paths.cjs");
'use strict';
// v2.3 test policy, explicitly requested by the server owner.
// Retain an audit before reclaiming equipment; slot upgrades and receipts never reset.
function reconcile(a,items,classGear,{initial=false,requestId=null}={}){
 const before={inventory:{...a.inventory},equipped:{...a.equipped}},removed=[];
 for(const [id,quantity] of Object.entries(a.inventory)){
  const item=items[id];
  if((initial&&(id==='unique_relic'||item?.rarity==='Legendary'&&item.slot==='accessory'))||(item?.rarity==='Legendary'&&item.job&&item.job!==a.job)){
   if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('Invalid gear quantity');
   if(quantity)removed.push({id,quantity});delete a.inventory[id];
  }
 }
 for(const slot of Object.keys(a.equipped))if(a.equipped[slot]&&!a.inventory[a.equipped[slot]])a.equipped[slot]=null;
 for(const [slot,id] of Object.entries(classGear[a.job]||{})){
  a.inventory[id]=Math.max(1,a.inventory[id]||0);
  // Selected-class test equipment is always issued and equipped together.
  a.equipped[slot]=id;
 }
 if(initial)a.gearReconciliationV13={before,removed,policy:'selected-class-only/no-initial-legendary-accessories'};
 else a.lastClassGearReconciliation={requestId,removed};
 // The older provenance ledger must not authorize a second reclamation.
 if(a.testGearProvenanceV1){a.retiredTestGearProvenanceV13??=a.testGearProvenanceV1;delete a.testGearProvenanceV1;}
 return a;
}
module.exports={reconcile};
