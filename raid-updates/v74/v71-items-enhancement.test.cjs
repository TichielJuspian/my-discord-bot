'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('./raid-workshop-model'),C=require('./raid-item-catalog'),P=require('./raid-engine/slot-progression.cjs');
function fresh(){return M.migrate(M.fresh(50),50);}
function enhance(a,roll=.999,useScroll=false){return M.change(a,{id:'enh-'+a.revision,revision:a.revision,action:'enhance',value:'weapon',useScroll},50,roll);}
test('51 droppable templates, requested rarity/slot counts and unchanged fixed legendary stats',()=>{
 for(const [rarity,count]of [['Common',5],['Rare',6],['Epic',3],['Legendary',3]])for(const slot of M.SLOTS){const ids=Object.keys(M.ITEMS).filter(id=>M.ITEMS[id].rarity===rarity&&M.ITEMS[id].slot===slot&&(rarity!=='Legendary'||/^(warrior|paladin|berserker)_legendary_/.test(id)));assert.equal(ids.length,count,rarity+slot);}
 assert.equal(M.ITEMS.paladin_legendary_weapon.attack,220);assert.equal(M.ITEMS.paladin_legendary_weapon.critDamagePercent,40);assert.equal(M.ITEMS.berserker_legendary_armor.defense,74);
});
test('rolls remain bounded, deterministic after JSON reload; unknown/unsafe IDs rejected',()=>{
 const count=Object.keys(M.ITEMS).length;
 for(const [id,template]of Object.entries(M.ITEMS))if(['Rare','Epic'].includes(template.rarity)&&M.SLOTS.includes(template.slot))for(let r=0;r<=100;r++){
 const rolled='rolled:'+id+':'+r,item=M.ITEMS[rolled];assert.equal(item.quality,C.quality(r));assert.ok(item.artId);for(const k of C.STAT_KEYS)if(template[k]!=null){assert.ok(item[k]>=template[k]*.9-.051);assert.ok(item[k]<=template[k]*1.1+.051);}
 assert.deepEqual(M.ITEMS[JSON.parse(JSON.stringify(rolled))],item);
 }
 assert.equal(Object.keys(M.ITEMS).length,count);for(const id of ['__proto__','constructor','rolled:epic_sword:101','rolled:epic_sword:001','rolled:warrior_legendary_weapon:50'])assert.equal(M.ITEMS[id],undefined);
});
test('different rolls stay separate, matching rolls stack, cross-class drops visible but cannot equip',()=>{
 const a=fresh(),lo='rolled:epic_sword:0',hi='rolled:epic_sword:100';a.inventory[lo]=2;a.inventory[hi]=1;a.inventory.paladin_legendary_weapon=1;
 const I=require('./raid-workshop-inventory');let ids=[];for(let i=0;i<10;i++)ids.push(...I.page(a,'all',i).items.map(x=>x[0]));assert.ok(ids.includes(lo)&&ids.includes(hi)&&ids.includes('paladin_legendary_weapon'));
 const next=M.change(a,{id:'equip',revision:a.revision,action:'equip',value:hi},50);assert.equal(M.battle(next,50).stats.attack-M.battle(a,50).stats.attack,8);assert.equal(next.inventory[lo],2);
 assert.throws(()=>M.change(a,{id:'bad',revision:a.revision,action:'equip',value:'paladin_legendary_weapon'},50),/exclusive/);
});
test('success awards two direct drops plus potion/scroll atomically, never twice after reopening store',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),dir=fs.mkdtempSync(path.join(__dirname,'v71-test-data-')),file=path.join(dir,'test.json');try{
 let store=require('./raid-characters').createStore({file});store.workshopRead('g','u',50,true);assert.equal(store.grantRaidPotion('g','u','earth:one'),true);store=require('./raid-characters').createStore({file});assert.equal(store.grantRaidPotion('g','u','earth:one'),false);const a=store.workshopRead('g','u',50);assert.equal(a.lastRaidLoot.items.length,2);assert.equal(a.potions,1);assert.equal(a.inventory.normal_enhance_scroll,1);
 }finally{for(const name of ['test.json','test.json.tmp'])fs.rmSync(path.join(dir,name),{force:true});fs.rmdirSync(dir);}
});
test('loot rarity boundaries and foreign legendary are not class filtered',()=>{
 const seq=[.0,.99];assert.equal(C.drop(M.ITEMS,true,()=>seq.shift()),'berserker_legendary_armor');
 for(const [roll,rarity]of [[.03,'Epic'],[.23,'Rare'],[.63,'Common']]){const seq=[roll,0,.5];assert.equal(M.ITEMS[C.drop(M.ITEMS,true,()=>seq.shift())].rarity,rarity);}
});
test('probability cost/guarantee boundaries and gauge have no random shortcut',()=>{
 assert.equal(P.quote(20).cost,100);assert.equal(P.quote(21).cost,200);assert.equal(P.quote(30).cost,200);assert.equal(P.quote(31).cost,300);
 for(const [target,base,n]of [[19,1,60],[20,1,60],[21,.5,100],[25,.5,100],[26,.2,150],[30,.2,150]]){assert.equal(P.quote(target).chance,base);assert.equal(P.quote(target,n-1).chance,100);assert.ok(P.quote(target,n-2).chance<100);}
 let a=fresh();a.slots.weapon=30;for(let i=0;i<149;i++)a=enhance(a,0);assert.equal(a.slots.weapon,30);assert.equal(a.enhancementFailures.weapon,149);a=enhance(a,.99999);assert.equal(a.slots.weapon,31);assert.equal(a.enhancementFailures.weapon,0);
 assert.equal(P.quote(36,298).chance,0);assert.equal(P.quote(36,299).chance,100);
});
test('normal scroll applies +10 percentage points once with idempotent request; cannot use beyond 20',()=>{
 let a=fresh();a.slots.weapon=3;a.inventory.normal_enhance_scroll=2;const id='enh-'+a.revision;a=enhance(a,.5,true);assert.equal(a.slots.weapon,4);assert.equal(a.inventory.normal_enhance_scroll,1);assert.equal(a.lastEnhancement.chance,55);assert.equal(M.change(a,{id,action:'enhance',value:'weapon',useScroll:true},50,0),a);
 a.slots.weapon=20;assert.throws(()=>enhance(a,0,true),/through \+20/);assert.equal(a.inventory.normal_enhance_scroll,1);
});
test('every milestone is cumulative; no change to previously saved item/enhancement records',()=>{
 for(const slot of M.SLOTS)for(const [level,bonus]of Object.entries(P.MILESTONES[slot])){const a=P.bonuses({[slot]:Number(level)-1}),b=P.bonuses({[slot]:Number(level)});for(const [key,value]of Object.entries(bonus)){const per=slot==='weapon'&&key==='attack'?2:slot==='armor'&&key==='defense'?1:slot==='accessory'&&key==='evasion'?.5:0;assert.equal(Math.round((b[key]-a[key]-per)*10)/10,value);}}
 const a=fresh();a.slots.armor=23;assert.deepEqual(M.migrate(structuredClone(a),50),a);
});
test('damage-percent gear changes actual damage without changing attack/heal stat',()=>{
 const R=require('./raid-engine/progression-combat.cjs'),a=fresh();a.equipped.weapon=null;const s=M.battle(a,50,'earth',123),t=structuredClone(s);t.stats.damagePercent=20;const n=R.step(s,'attack'),m=R.step(t,'attack');const d=s.bossHP-n.bossHP,e=t.bossHP-m.bossHP;assert.ok(d>0);assert.equal(e,Math.floor(d*1.2));assert.equal(m.stats.attack,n.stats.attack);
});
test('UI renders rolled art, quality, gauge, six milestones, and scroll controls',()=>{
 const a=fresh(),id='rolled:epic_sword:100';a.inventory[id]=1;a.inventory.normal_enhance_scroll=1;const D=require('./raid-workshop-detail');assert.match(D.svg({account:a,level:50,view:'equipment',pending:{action:'equip',value:id}}),/HIGH ROLL/);
 const F=require('./raid-workshop-forge'),s={id:'123456abcdef',account:a,level:50,view:'enhance',pending:{action:'enhance',value:'weapon'},pointsBalance:20000};a.slots.weapon=30;const svg=F.svg(s);assert.match(svg,/ENHANCEMENT PROGRESS/);assert.doesNotMatch(svg,/0% Success/);assert.match(F.footerSVG(s),/\+35/);assert.match(F.footerSVG(s),/\+40/);
 const V=require('./raid-workshop-view'),buttons=V.payload(s,{render:false}).components.flatMap(c=>c.components||[]);assert.equal(buttons.find(b=>b.custom_id?.endsWith(':confirm')).label,'Progress - 300 P');
});
