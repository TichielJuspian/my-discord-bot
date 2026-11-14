'use strict';
// Quantity provenance, never rarity/name inference. No account scan or file writes.
// Existing unknown copies stay unknown. Every inventory-consuming path must
// account for this ledger before it is enabled in a future release.
const KEY='testGearProvenanceV1';
const enabled=()=>process.env.RAID_TEST_CLASS_GEAR_CLEANUP==='1';
const count=n=>Number.isSafeInteger(n)&&n>=0;
function ledger(a,create=false){
 if(a[KEY]===undefined&&create)a[KEY]={version:1,items:{}};
 const l=a[KEY];return l?.version===1&&l.items&&typeof l.items==='object'&&!Array.isArray(l.items)?l:null;
}
function valid(e){
 return e&&count(e.expected)&&count(e.protected)&&count(e.remaining)&&
 e.expected===e.protected+e.remaining&&Array.isArray(e.events)&&!e.quarantined;
}
function grantMinimum(a,id,item,context={}){
 const before=a.inventory[id]??0;if(!count(before))throw Error('Invalid equipment quantity');
 if(before>=1)return a; // Do not relabel previously owned or earned equipment.
 a.inventory[id]=1;
 if(!item||!['Epic','Legendary'].includes(item.rarity))return a;
 const l=ledger(a,true);if(!l)return a; // Malformed metadata cannot authorize reclamation.
 let e=l.items[id];
 if(e!==undefined&&(!valid(e)||e.expected!==before||e.job!==(item.job||null)||e.rarity!==item.rarity)){if(e&&typeof e==='object')e.quarantined=true;return a;}
 if(!e)e=l.items[id]={job:item.job||null,rarity:item.rarity,expected:before,protected:before,remaining:0,events:[]};
 e.expected++;e.remaining++;
 e.events.push({type:'grant',source:context.source||'automatic_class_test_gear',quantity:1,revision:a.revision,requestId:context.requestId||null});
 return a;
}
function recordEarned(a,id,before,quantity,receipt){
 const e=ledger(a)?.items[id];if(!e)return;
 if(!valid(e)||!count(before)||!count(quantity)||quantity<1||e.expected!==before||a.inventory[id]!==before+quantity){if(typeof e==='object')e.quarantined=true;return;}
 e.expected+=quantity;e.protected+=quantity;
 e.events.push({type:'earned',source:'raid_drop',quantity,receipt});
}
function removePreviousClass(a,oldJob,ids,items,requestId){
 if(!enabled())return [];
 const l=ledger(a),removed=[];if(!l)return removed;
 for(const id of ids){
  const item=items[id],e=l.items[id],owned=a.inventory[id]??0;
  if(!item||item.job!==oldJob||item.rarity!=='Legendary'||!e)continue;
  if(!valid(e)||e.job!==oldJob||e.rarity!=='Legendary'||!count(owned)||e.expected!==owned){if(e&&typeof e==='object')e.quarantined=true;continue;}
  if(!e.remaining)continue;
  const quantity=e.remaining,after=owned-quantity;
  if(after<e.protected)continue;
  if(after===0)delete a.inventory[id];else a.inventory[id]=after;
  if(after===0)for(const slot of Object.keys(a.equipped))if(a.equipped[slot]===id)a.equipped[slot]=null;
  e.expected=after;e.remaining=0;
  e.events.push({type:'reclaimed',source:'test_class_change',quantity,revision:a.revision,requestId});
  removed.push({id,quantity});
 }
 return removed;
}
function changeNotice(){return enabled()?'Level and earned equipment are kept. Only tracked test Legendary gear from the previous class is reclaimed; unverified legacy gear is kept.':'Level and equipment are kept.';}
module.exports={KEY,enabled,grantMinimum,recordEarned,removePreviousClass,changeNotice};
