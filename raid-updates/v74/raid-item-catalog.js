'use strict';
// Immutable templates; rolled identity lives in the inventory, never in a global cache.
const templates={};
const specs={
 weapon:[['Balanced Blade',{attack:15,crit:10}],['Iron Cleaver',{attack:30}],['Keen Edge',{crit:30}],['Fury Blade',{damagePercent:20}],['Ruin Blade',{attack:10,critDamagePercent:30}],['Swift Blade',{attack:18,evasion:3}]],
 armor:[['Iron Plate',{hp:40,defense:12}],['Vital Guard',{hp:100}],['Bulwark',{defense:24}],['Scout Coat',{hp:25,evasion:5}],['Battle Coat',{hp:40,attack:10}],['Resolute Plate',{hp:60,defense:10,critDamagePercent:10}]],
 accessory:[['Keen Ring',{crit:15}],['Power Ring',{attack:15}],['Ruin Ring',{critDamagePercent:25}],['Vital Ring',{hp:70}],['Wind Ring',{evasion:5}],['Battle Seal',{attack:8,crit:10,critDamagePercent:10}]]
};
const art={weapon:'training_sword',armor:'iron_guard',accessory:'focus_ring'};
for(const rarity of ['Common','Rare'])for(const [slot,rows]of Object.entries(specs))rows.slice(0,rarity==='Common'?5:6).forEach(([name,stats],i)=>{
 const id=rarity.toLowerCase()+'_'+slot+'_'+(i+1),scale=rarity==='Rare'?1.8:1;
 const base=Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,k==='evasion'?Math.round(v*(rarity==='Rare'?1.3:1)*10)/10:Math.round(v*scale)]));
 templates[id]={name:(rarity==='Rare'?'Tempered ':'')+name,rarity,slot,artId:art[slot],...base};
});
Object.assign(templates,{
 epic_sword:{name:'Amethyst Blade',rarity:'Epic',slot:'weapon',artId:'epic_sword',attack:80},
 epic_weapon_2:{name:'Amethyst Fang',rarity:'Epic',slot:'weapon',artId:'epic_sword',attack:55,crit:20},
 epic_weapon_3:{name:'Amethyst Ruin',rarity:'Epic',slot:'weapon',artId:'epic_sword',attack:60,critDamagePercent:35},
 epic_armor:{name:'Amethyst Guard',rarity:'Epic',slot:'armor',artId:'epic_armor',hp:60,defense:20},
 epic_armor_2:{name:'Amethyst Bulwark',rarity:'Epic',slot:'armor',artId:'epic_armor',hp:40,defense:35},
 epic_armor_3:{name:'Amethyst Heart',rarity:'Epic',slot:'armor',artId:'epic_armor',hp:130,defense:12},
 epic_ring:{name:'Amethyst Ring',rarity:'Epic',slot:'accessory',artId:'epic_ring',crit:30,critDamagePercent:10},
 epic_accessory_2:{name:'Amethyst Seal',rarity:'Epic',slot:'accessory',artId:'epic_ring',attack:30,critDamagePercent:20},
 epic_accessory_3:{name:'Amethyst Breeze',rarity:'Epic',slot:'accessory',artId:'epic_ring',crit:15,evasion:8}
});
const STAT_KEYS=['attack','hp','defense','crit','critDamagePercent','evasion','damagePercent'];
function quality(roll){return roll<34?'Low':roll<67?'Mid':'High';}
function resolve(base,id){
 if(typeof id!=='string')return undefined;
 if(Object.hasOwn(base,id))return base[id];
 const m=/^rolled:([a-z0-9_]+):(\d{1,3})$/.exec(id);if(!m)return undefined;
 const item=base[m[1]],roll=Number(m[2]);if(!item||!['Rare','Epic'].includes(item.rarity)||roll>100||String(roll)!==m[2])return undefined;
 const out={...item,artId:item.artId||m[1],templateId:m[1],quality:quality(roll),roll};
 // One persisted quality roll; all stats remain within 90% to 110% of the template.
 for(const key of STAT_KEYS)if(item[key]!=null)out[key]=Math.round(item[key]*(.9+.002*roll)*10)/10;
 return Object.freeze(out);
}
function catalog(existing){const base={...templates,...existing};for(const [id,item]of Object.entries(base)){if(['weapon','armor','accessory'].includes(item.slot)&&!['legendary_sword','legendary_armor'].includes(id))item.artId=id+'-v72';Object.freeze(item);}return new Proxy(Object.freeze(base),{get:(target,key)=>resolve(target,key)});}
function randomUnit(rng){const x=rng();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Invalid loot roll');return x;}
function drop(items,success=true,rng=Math.random){
 const n=randomUnit(rng)*100,rarity=success?(n<3?'Legendary':n<23?'Epic':n<63?'Rare':'Common'):(n<1?'Legendary':n<11?'Epic':n<51?'Rare':'Common');
 const pool=Object.keys(items).filter(id=>items[id].rarity===rarity&&['weapon','armor','accessory'].includes(items[id].slot)&&(rarity!=='Legendary'||/^(warrior|paladin|berserker)_legendary_/.test(id)));
 const id=pool[Math.floor(randomUnit(rng)*pool.length)];if(!id)throw Error('Empty loot pool');
 return ['Rare','Epic'].includes(rarity)?'rolled:'+id+':'+Math.floor(randomUnit(rng)*101):id;
}
function award(account,receipt,items,success=true,rng=Math.random){
 if(typeof receipt!=='string'||!receipt||receipt.length>200)throw Error('Invalid raid receipt');
 if((account.itemRewardReceipts||[]).includes(receipt))return account;
 const next=structuredClone(account),ids=Array.from({length:success?2:1},()=>drop(items,success,rng));
 for(const id of ids)next.inventory[id]=(next.inventory[id]||0)+1;
 next.inventory.normal_enhance_scroll=(next.inventory.normal_enhance_scroll||0)+1;
 next.itemRewardReceipts=[...(next.itemRewardReceipts||[]),receipt];next.lastRaidLoot={receipt,success,items:ids,scrolls:1};return next;
}
module.exports={templates,STAT_KEYS,resolve,catalog,drop,award,quality};
