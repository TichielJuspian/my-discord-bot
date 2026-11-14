'use strict';
const R=require('./raid-engine/progression-combat.cjs');
const P=require('./raid-engine/slot-progression.cjs');
const JOBS=['warrior','paladin','berserker'],SLOTS=['weapon','armor','accessory'];
// Stable item IDs replace every previously issued test item with its Epic
// version, including equipped copies, without deleting saved slot progress.
const CLASS_GEAR=Object.fromEntries(JOBS.map(job=>[job,{weapon:job+'_legendary_weapon',armor:job+'_legendary_armor'}]));
const CLASS_NAMES={warrior:['[Warrior] Sword of the Sea','[Warrior] God of the Sea'],paladin:['[Paladin] Hammer of the Sun','[Paladin] God of the Sun'],berserker:['[Berserker] Greatsword of the Sun','[Berserker] God of the Sun']};
CLASS_GEAR.warrior.accessory='warrior_legendary_accessory';
CLASS_GEAR.paladin.accessory='paladin_legendary_accessory';
CLASS_GEAR.berserker.accessory='berserker_legendary_accessory';
const ITEMS=require('./raid-item-catalog').catalog({
 normal_enhance_scroll:{name:'Normal Enhancement Scroll',rarity:'Rare',slot:'consumable',type:'consumable',artId:'focus_ring'},
 warrior_legendary_accessory:{name:'[Warrior] Ocean Sigil',rarity:'Legendary',job:'warrior',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 paladin_legendary_accessory:{name:'[Paladin] Solar Benediction',rarity:'Legendary',job:'paladin',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 berserker_legendary_accessory:{name:'[Berserker] Solar Warcrest',rarity:'Legendary',job:'berserker',slot:'accessory',artId:'unique_relic',crit:35,attack:50},
 stat_potion:{name:'Permanent Stat Potion',rarity:'Epic',slot:'consumable',type:'consumable'},
 ...Object.fromEntries(JOBS.flatMap(job=>[['weapon',{attack:120,crit:30}],['armor',{hp:200,defense:40,critDamagePercent:30}]].map(([slot,stats],i)=>[CLASS_GEAR[job][slot],{name:CLASS_NAMES[job][i],rarity:'Legendary',job,slot,...stats,...(job==='warrior'?(slot==='weapon'?{attack:220,crit:0,critDamagePercent:50}:{hp:200,defense:60,critDamagePercent:0}):{}),...(job==='paladin'?(slot==='weapon'?{attack:220,crit:0,critDamagePercent:40}:{hp:240,defense:74,critDamagePercent:0}):{}),...(job==='berserker'?(slot==='weapon'?{attack:190}:{hp:240,defense:74}):{})}]))),
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
function fresh(level){return {schema:6,revision:0,job:'warrior',allocation:{power:0,focus:0,ruin:0},slots:P.levels(),equipped:{weapon:"epic_sword",armor:"epic_armor",accessory:"epic_ring"},inventory:{epic_sword:1,epic_armor:1,epic_ring:1,legendary_sword:1,legendary_armor:1,unique_relic:1},tickets:{},receipts:[]};}
function migrate(w,level){
 // Only untouched legacy records can be proven to contain automatic allocation.
 // Any prior action receipt preserves the user's saved build.
 if(w.schema>=12)return w;
 if(w.schema===11){const next=structuredClone(w);delete next.inventory.unique_relic;if(next.equipped.accessory==='unique_relic')next.equipped.accessory=null;next.schema=12;next.revision++;return next;}
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
 if(w.schema===5){const next=structuredClone(w);for(const id of ['epic_sword','epic_armor','epic_ring'])next.inventory[id]=Math.max(1,next.inventory[id]||0);next.schema=6;next.revision++;return migrate(next,level);}
 if(w.schema===4){
  const next=structuredClone(w),retired=['training_sword','iron_guard','focus_ring'];
  next.retiredTestEquipmentV29={inventory:{},equipped:{...next.equipped}};
  for(const id of retired){if(next.inventory[id])next.retiredTestEquipmentV29.inventory[id]=next.inventory[id];delete next.inventory[id];}
  for(const slot of SLOTS)if(retired.includes(next.equipped[slot]))next.equipped[slot]=null;
  for(const id of ['epic_sword','epic_armor','epic_ring'])next.inventory[id]=Math.max(1,next.inventory[id]||0);
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
function grantClassGear(a){for(const id of Object.values(CLASS_GEAR[a.job]))a.inventory[id]=Math.max(1,a.inventory[id]||0);return a;}
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
 }else if(request.action==='testkit'){for(const id of ['epic_sword','epic_armor','epic_ring','unique_relic'])a.inventory[id]=Math.max(1,a.inventory[id]||0);grantClassGear(a);}
 else if(request.action==='reset')a.allocation={power:0,focus:0,ruin:0};
 else if(request.action==='job'){if(!JOBS.includes(x))throw Error('Invalid class');if(x===a.job)throw Error('This class is already selected.');a.lastClassPotionRefund=refundPotions(a);a.job=x;for(const slot of SLOTS){const item=ITEMS[a.equipped[slot]];if(item?.job&&item.job!==x)a.equipped[slot]=null;}grantClassGear(a);}
 else if(request.action==='equip'){
  if(ITEMS[x]?.type==='consumable')throw Error('Use this item directly from inventory.');
  if(!ITEMS[x]||!(a.inventory[x]>0))throw Error('You do not own this item.');
  if(ITEMS[x].job&&ITEMS[x].job!==a.job)throw Error('This equipment is exclusive to '+ITEMS[x].job+'.');
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
 const c={...require('./raid-test-build').config(a.job,level,0,boss),...a.allocation,enhancements:{...a.slots},warriorEvolutionWeapon:a.job==='warrior'&&a.equipped.weapon==='warrior_legendary_weapon',warriorLowHPArmor:a.job==='warrior'&&a.equipped.armor==='warrior_legendary_armor',paladinHammerRefund:a.job==='paladin'&&a.equipped.weapon==='paladin_legendary_weapon',paladinBlessingRelic:false,uniqueRelic:a.equipped.accessory==='unique_relic',berserkerFinisherRelic:a.job==='berserker'&&['unique_relic','berserker_legendary_accessory'].includes(a.equipped.accessory)};
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
