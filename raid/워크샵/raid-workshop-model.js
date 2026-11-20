const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const R=require('../보스/전투/엔진/progression-combat.cjs');
const P=require('../보스/전투/엔진/slot-progression.cjs');
const TestGear=require('./raid-test-gear.js');
const JOBS=['warrior','paladin','berserker'],SLOTS=['weapon','armor','accessory'];
// All three selected-class Legendary slots share the same grant/reclaim policy.
// Slot upgrades belong to the character and survive equipment replacement.
const CLASS_GEAR=Object.fromEntries(JOBS.map(job=>[job,{weapon:job+'_legendary_weapon',armor:job+'_legendary_armor',accessory:job+'_legendary_accessory'}]));
const CLASS_NAMES={warrior:['[Blader] Sword of the Sea','[Blader] God of the Sea'],paladin:['[Paladin] Hammer of the Sun','[Paladin] God of the Sun'],berserker:['[Berserker] Greatsword of the Sun','[Berserker] God of the Sun']};



const ITEMS=require('./raid-item-catalog.js').catalog({
 normal_enhance_scroll:{name:'Normal Enhancement Scroll',rarity:'Rare',slot:'consumable',type:'consumable',artId:'focus_ring'},
 warrior_legendary_accessory:{name:'[Blader] Ocean Sigil',rarity:'Legendary',job:'warrior',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 paladin_legendary_accessory:{name:'[Paladin] Solar Benediction',rarity:'Legendary',job:'paladin',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 berserker_legendary_accessory:{name:'[Berserker] Solar Warcrest',rarity:'Legendary',job:'berserker',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 stat_potion:{name:'Permanent Stat Potion',rarity:'Epic',slot:'consumable',type:'consumable'},
 ...Object.fromEntries(JOBS.flatMap(job=>[['weapon',{attack:220,crit:0,critDamagePercent:40}],['armor',{hp:240,defense:74,critDamagePercent:0}]].map(([slot,stats],i)=>[CLASS_GEAR[job][slot],{name:CLASS_NAMES[job][i],rarity:'Legendary',job,slot,...stats}]))),
 epic_sword:{name:'Amethyst Blade',rarity:'Epic',slot:'weapon',attack:80},
 epic_armor:{name:'Amethyst Guard',rarity:'Epic',slot:'armor',hp:60,defense:20},
 epic_ring:{name:'Amethyst Ring',rarity:'Epic',slot:'accessory',crit:30,critDamagePercent:10},
 legendary_sword:{name:'Solar Sovereign',rarity:'Legendary',slot:'weapon',attack:120,crit:30},
 legendary_armor:{name:'Solar Aegis',rarity:'Legendary',slot:'armor',hp:200,defense:40,critDamagePercent:30},
 
});
const RELIC={warrior:{crit:35,attack:50},paladin:{crit:35,attack:50},berserker:{crit:35,attack:50}};
const RELIC_TEXT={warrior:'CRIT +35% / ATK +50.',paladin:'CRIT +35% / ATK +50.',berserker:'CRIT +35% / ATK +50.'};
function itemStats(id,job){return {...ITEMS[id],...(id==='unique_relic'?RELIC[job]:{})};}
function potionCount(a){const b=a.potionStats||{};const n=(b.attack||0)+(b.hp||0)/2+(b.critDamagePercent||0)+(b.evasion||0)*2;if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid permanent stat record');return n;}
function refundPotions(a){const n=potionCount(a);a.potions=(a.potions||0)+n;a.potionStats={attack:0,hp:0,critDamagePercent:0,evasion:0};delete a.lastPotion;return n;}
function quantity(a,id){return id==='stat_potion'?(a.potions||0):(a.inventory[id]||0);}
function fresh(level,{trackInitialTestGear=false}={}){const a={schema:6,revision:0,job:'warrior',allocation:{power:0,focus:0,ruin:0},slots:P.levels(),equipped:{weapon:"epic_sword",armor:"epic_armor",accessory:"epic_ring"},inventory:{epic_sword:1,epic_armor:1,epic_ring:1,legendary_sword:1,legendary_armor:1,unique_relic:1},tickets:{},receipts:[]};if(trackInitialTestGear)for(const id of ['epic_sword','epic_armor','epic_ring']){a.inventory[id]=0;TestGear.grantMinimum(a,id,ITEMS[id],{source:'initial_test_kit'});}return a;}
function migrate(w,level){
 // Only untouched legacy records can be proven to contain automatic allocation.
 // Any prior action receipt preserves the user's saved build.
 if(w.schema>=16)return w;
 if(w.schema===15){const next=structuredClone(w),before={inventory:{...w.inventory},equipped:{...w.equipped}},removedEpic=[];
  for(const [id,quantity] of Object.entries(next.inventory)){const item=ITEMS[id];if(item?.rarity!=='Epic'||!SLOTS.includes(item.slot))continue;if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('Invalid gear quantity');if(quantity)removedEpic.push({id,quantity});delete next.inventory[id];}
  for(const slot of SLOTS)if(ITEMS[next.equipped[slot]]?.rarity==='Epic')next.equipped[slot]=null;
  grantClassGear(next,{requestId:'gear-v32-epic-retirement'});next.gearReconciliationV16={before,removedEpic,policy:'retire-current-epic-equipment-v32'};next.schema=16;next.revision++;return next;
 }

 if(w.schema===14){
  const next=structuredClone(w),before={inventory:{...next.inventory},equipped:{...next.equipped}},removedEpic=[];
  // One-time retirement of currently held Epic gear, including rolled variants.
  // Consumables, slot upgrades, permanent stats and reward receipts stay intact.
  for(const [id,quantity] of Object.entries(next.inventory)){
   const item=ITEMS[id];
   if(item?.rarity!=='Epic'||!SLOTS.includes(item.slot))continue;
   if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('Invalid gear quantity');
   if(quantity)removedEpic.push({id,quantity});delete next.inventory[id];
  }
  grantClassGear(next,{requestId:'gear-v15-accessory-and-epic-retirement'});
  next.gearReconciliationV15={before,removedEpic,removed:next.lastClassGearReconciliation.removed,policy:'selected-class-legendary-all-slots/retire-current-epic-equipment'};
  next.schema=15;next.revision++;return migrate(next,level);
 }
 if(w.schema===13){const next=structuredClone(w);next.gearReconciliationV14={before:{inventory:{...next.inventory},equipped:{...next.equipped}},policy:'selected-class-only/automatic-weapon-and-armor'};grantClassGear(next,{requestId:'gear-v14-repair'});next.gearReconciliationV14.removed=next.lastClassGearReconciliation.removed;next.schema=14;next.revision++;return migrate(next,level);}
 if(w.schema===12){const next=structuredClone(w);require('./raid-gear-policy.js').reconcile(next,ITEMS,CLASS_GEAR,{initial:true});next.schema=13;next.revision++;return migrate(next,level);}
 if(w.schema===11){const next=structuredClone(w);delete next.inventory.unique_relic;if(next.equipped.accessory==='unique_relic')next.equipped.accessory=null;next.schema=12;next.revision++;return migrate(next,level);}
 if(w.schema===10){const next=structuredClone(w);if(next.job==='warrior'){grantClassGear(next);if(next.equipped.accessory==='unique_relic')next.equipped.accessory='warrior_legendary_accessory';}next.schema=11;return migrate(next,level);}
 if(w.schema===9){const next=structuredClone(w);if(next.job==='paladin'){grantClassGear(next);if(next.equipped.accessory==='unique_relic')next.equipped.accessory='paladin_legendary_accessory';}next.schema=10;return migrate(next,level);}
 if(w.schema===8){const next=structuredClone(w);if(next.job==='berserker'){grantClassGear(next);if(next.equipped.accessory==='unique_relic')next.equipped.accessory='berserker_legendary_accessory';}next.schema=9;return migrate(next,level);}
 if(w.schema===7){const next=structuredClone(w);next.previousAllocationV41={...next.allocation};next.allocation={power:0,focus:0,ruin:0};next.potionStats??={attack:0,hp:0,critDamagePercent:0,evasion:0};next.potions??=0;next.potionRewards??=[];next.enhancementFailures??={weapon:0,armor:0,accessory:0};next.schema=8;next.revision++;return migrate(next,level);}
 if(w.schema===6){
  const next=structuredClone(w);
  next.retiredSharedLegendaryV33={inventory:{},equipped:{...next.equipped}};
  for(const [slot,id] of [['weapon','legendary_sword'],['armor','legendary_armor']]){
   if(next.inventory[id])next.retiredSharedLegendaryV33.inventory[id]=next.inventory[id];
   delete next.inventory[id];
   if(next.equipped[slot]===id)next.equipped[slot]=CLASS_GEAR[next.job][slot];
  }
  grantClassGear(next);next.schema=7;next.revision++;return migrate(next,level);
 }
 if(w.schema===5){const next=structuredClone(w);for(const id of ['epic_sword','epic_armor','epic_ring'])TestGear.grantMinimum(next,id,ITEMS[id],{source:'legacy_migration_topup'});next.schema=6;next.revision++;return migrate(next,level);}
 if(w.schema===4){
  const next=structuredClone(w),retired=['training_sword','iron_guard','focus_ring'];
  next.retiredTestEquipmentV29={inventory:{},equipped:{...next.equipped}};
  for(const id of retired){if(next.inventory[id])next.retiredTestEquipmentV29.inventory[id]=next.inventory[id];delete next.inventory[id];}
  for(const slot of SLOTS)if(retired.includes(next.equipped[slot]))next.equipped[slot]=null;
  for(const id of ['epic_sword','epic_armor','epic_ring'])TestGear.grantMinimum(next,id,ITEMS[id],{source:'legacy_migration_topup'});
  next.schema=6;next.revision++;return migrate(next,level);
 }
 if(w.schema===3){const next=structuredClone(w);for(const id of ['legendary_sword','legendary_armor','unique_relic'])next.inventory[id]=Math.max(1,next.inventory[id]||0);next.schema=4;next.revision++;return migrate(next,level);}
 const next=structuredClone(w),n=used(w),k=Math.floor(n/3);
 if(w.schema<2&&!(w.receipts||[]).length&&w.allocation.power===n-2*k&&w.allocation.focus===k&&w.allocation.ruin===k)next.allocation={power:0,focus:0,ruin:0};
 if(Number.isInteger(level)&&used(next)>R.budget(level)){
  next.previousAllocationV2=structuredClone(next.allocation);
  next.allocation={power:0,focus:0,ruin:0};
 }
 next.schema=3;next.revision++;return migrate(next,level);
}
function grantClassGear(a,context){return require('./raid-gear-policy.js').reconcile(a,ITEMS,CLASS_GEAR,{requestId:context?.requestId});}
function used(a){return Object.values(a.allocation).reduce((x,y)=>x+y,0);}
function remaining(a,level){return R.budget(level)-used(a);}
function validate(a,level){
 if(!JOBS.includes(a.job)||!Number.isSafeInteger(a.revision)||a.revision<0)throw Error('Invalid character');
 for(const k of ['power','focus','ruin'])if(!Number.isSafeInteger(a.allocation[k])||a.allocation[k]<0)throw Error('Invalid allocation');
 if(used(a)>R.budget(level))throw Error('Your saved build exceeds your current level. Reset stats first.');
 P.levels(a.slots);
 for(const slot of SLOTS){const id=a.equipped[slot];if(id&&(!ITEMS[id]||ITEMS[id].slot!==slot||!(a.inventory[id]>0)||(ITEMS[id].job&&ITEMS[id].job!==a.job)))throw Error('Invalid equipped item');}
 return a;
}
function change(original,request,level,roll){
 if(typeof request.id!=='string'||!request.id||request.id.length>100)throw Error('Invalid request identifier');
 if(original.receipts.includes(request.id))return original;
 if(original.revision!==request.revision)throw Error('This panel is out of date. Reopen /workshop.');
 const a=structuredClone(original),x=request.value;
 if(['allocate','reset'].includes(request.action))throw Error('Level-based stat allocation has been retired. Use Stat Potions.');
 if(request.action==='potion'){
  if(!(a.potions>0))throw Error('No Stat Potions available. Defeat a raid boss to earn one.');
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('Invalid potion roll');
  const key=roll<.5?'attack':roll<.75?'hp':roll<.95?'critDamagePercent':'evasion',amount={attack:1,hp:2,critDamagePercent:1,evasion:.5}[key];
  a.potionStats??={attack:0,hp:0,critDamagePercent:0,evasion:0};a.potionStats[key]+=amount;a.potions--;a.lastPotion={key,amount};
 }else if(request.action==='allocate'){
  for(const k of ['power','focus','ruin'])if(!Number.isSafeInteger(x[k])||x[k]<0)throw Error('Use whole, non-negative investment amounts.');
  // Allocation is a complete draft; only reset may refund committed points.
  for(const k of ['power','focus','ruin'])if(x[k]<a.allocation[k])throw Error('Use Reset Stats to refund invested points.');
  a.allocation={power:x.power,focus:x.focus,ruin:x.ruin};
 }else if(request.action==='testkit'){grantClassGear(a,{requestId:request.id});}
 else if(request.action==='reset')a.allocation={power:0,focus:0,ruin:0};
 else if(request.action==='test_class'){if(request.testClassGear!==true||!TestGear.enabled())throw Error('Explicit beta test gear mode required');if(!JOBS.includes(x))throw Error('Invalid class');if(x!==a.job)a.lastClassPotionRefund=refundPotions(a);a.job=x;grantClassGear(a,{requestId:request.id});}
 else if(request.action==='job'){if(!JOBS.includes(x))throw Error('Invalid class');if(x===a.job)throw Error('This class is already selected.');a.lastClassPotionRefund=refundPotions(a);a.job=x;for(const slot of SLOTS){const item=ITEMS[a.equipped[slot]];if(item?.job&&item.job!==x)a.equipped[slot]=null;}grantClassGear(a,{source:'class_change_test_gear',requestId:request.id});}
 else if(request.action==='equip'){
  if(ITEMS[x]?.type==='consumable')throw Error('Use this item directly from inventory.');
  if(!ITEMS[x]||!(a.inventory[x]>0))throw Error('You do not own this item.');
  if(ITEMS[x].job&&ITEMS[x].job!==a.job)throw Error('This equipment is exclusive to '+require('../클래스/raid-class-name.js').name(ITEMS[x].job)+'.');
  a.equipped[ITEMS[x].slot]=x;
 }else if(request.action==='unequip'){if(x==='all'){for(const slot of SLOTS)a.equipped[slot]=null;}else{if(!SLOTS.includes(x))throw Error('Invalid slot');a.equipped[x]=null;}}
 else if(request.action==='enhance'){
  if(!SLOTS.includes(x))throw Error('Invalid slot');
  const q=P.quote(a.slots[x]+1,a.enhancementFailures?.[x]||0,!!request.useScroll);
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('Invalid enhancement roll');
  // The live adapter atomically journals payment before committing this result.
  if(request.useScroll){if(!(a.inventory.normal_enhance_scroll>0))throw Error('No Normal Enhancement Scroll available.');a.inventory.normal_enhance_scroll--;}
  const success=roll<q.chance/100;if(success)a.slots[x]++;
  a.enhancementFailures={weapon:0,armor:0,accessory:0,...a.enhancementFailures};a.enhancementFailures[x]=success?0:(q.target>=10?a.enhancementFailures[x]+1:0);
  a.enhancementAttempts={weapon:0,armor:0,accessory:0,...a.enhancementAttempts};
  a.enhancementAttempts[x]++;
  a.lastEnhancement={slot:x,success,target:q.target,attempt:a.enhancementAttempts[x],cost:q.cost,chance:q.chance,mode:q.mode,progress:q.progress,required:q.required,usedScroll:!!request.useScroll};
 }else throw Error('Unknown workshop action');
 validate(a,level);a.revision++;a.receipts=[...a.receipts.slice(-49),request.id];return a;
}
function bonuses(a){const b={attack:0,hp:0,defense:0,crit:0,critDamagePercent:0,evasion:0,damagePercent:0};for(const id of Object.values(a.equipped)){if(id)for(const k of Object.keys(b))b[k]+=itemStats(id,a.job)[k]||0;}return b;}
function battle(a,level,boss='earth',seed=1){
 validate(a,level);
 const c={...require('../보스/전투/raid-test-build.js').config(a.job,level,0,boss),...a.allocation,enhancements:{...a.slots},warriorEvolutionWeapon:a.job==='warrior'&&a.equipped.weapon==='warrior_legendary_weapon',warriorLowHPArmor:a.job==='warrior'&&a.equipped.armor==='warrior_legendary_armor',paladinHammerRefund:a.job==='paladin'&&a.equipped.weapon==='paladin_legendary_weapon',paladinBlessingRelic:false,uniqueRelic:a.equipped.accessory==='unique_relic',berserkerFinisherRelic:a.job==='berserker'&&['unique_relic','berserker_legendary_accessory'].includes(a.equipped.accessory)};
 const s=R.create(c,seed),b=bonuses(a);
 for(const [k,v]of Object.entries(a.potionStats||{}))if(['attack','hp','critDamagePercent','evasion'].includes(k))b[k]=(b[k]||0)+v;
 for(const k of Object.keys(b))s.stats[k]=Math.round(((s.stats[k]||0)+b[k])*100)/100;
 s.hp=s.stats.hp;s.baseHP=s.stats.hp;
 s.workshop={revision:a.revision,job:a.job,equipped:{...a.equipped},allocation:{...a.allocation},slots:{...a.slots},inventory:{...a.inventory}};
 return s;
}
function ready(a,level){if(!a)return false;try{validate(a,level);return true;}catch{return false;}}
function preparation(a,level){return {flags:32768,attachments:[],components:[{type:10,content:'Prepare your character in /workshop: equip Weapon, Armor and Accessory, then prepare for battle. Join the boss lobby again when ready.'},{type:1,components:[{type:2,style:1,label:'Open Workshop',custom_id:'workshop:open'}]}],allowedMentions:{parse:[]}};}

module.exports={potionCount,refundPotions,quantity,CLASS_GEAR,grantClassGear,ready,preparation,JOBS,SLOTS,ITEMS,RELIC_TEXT,itemStats,fresh,migrate,used,remaining,validate,change,bonuses,battle,budget:R.budget};
