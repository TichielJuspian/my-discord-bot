'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const rewards=require('../raid-point-rewards.js');
const characters=require('../raid-characters.js');
const slots=require('../raid-engine/slot-progression.cjs');

function getAt(doc,key){return key.split('.').reduce((x,part)=>x?.[part],doc);}
function setAt(doc,key,value){const fields=key.split('.');let current=doc;for(const part of fields.slice(0,-1))current=current[part]??={};current[fields.at(-1)]=value;}
class FakeWalletDB{
  constructor(){this.records=new Map();}
  collection(name){assert.equal(name,'community_points');return this;}
  async findOne({ _id }){const item=this.records.get(_id);return item?structuredClone(item):null;}
  async updateOne(filter,change,options={}){
    let doc=this.records.get(filter._id),upserted=false;
    if(!doc&&options.upsert){doc={_id:filter._id,...structuredClone(change.$setOnInsert||{})};this.records.set(filter._id,doc);upserted=true;}
    if(!doc)return {modifiedCount:0,matchedCount:0};
    for(const [key,expected] of Object.entries(filter)){
      if(key==='_id')continue;
      const value=getAt(doc,key);
      if(expected&&typeof expected==='object'&&Object.hasOwn(expected,'$exists')){
        if((value!==undefined)!==expected.$exists)return {modifiedCount:0,matchedCount:0};
      }else if(value!==expected)return {modifiedCount:0,matchedCount:0};
    }
    if(upserted)return {modifiedCount:0,matchedCount:0,upsertedCount:1};
    for(const [key,value] of Object.entries(change.$inc||{}))setAt(doc,key,(getAt(doc,key)||0)+value);
    for(const [key,value] of Object.entries(change.$set||{}))setAt(doc,key,structuredClone(value));
    return {modifiedCount:1,matchedCount:1};
  }
}

test('reward table honors ties, excludes zero damage, and preserves v3 +900/+200',()=>{
  assert.deepEqual([1,2,3,5,6,25,26].map(rewards.rankPoints),[500,400,300,300,200,200,100]);
  const scores=[{id:'a',damage:100},{id:'b',damage:100},{id:'c',damage:90},{id:'z',damage:0}];
  assert.deepEqual(rewards.rewards(scores,true),[
    {userId:'a',rank:1,points:1400}, {userId:'b',rank:1,points:1400}, {userId:'c',rank:3,points:1200},
  ]);
  assert.deepEqual(rewards.rewards(scores,false).map(x=>x.points),[700,700,500]);
});

test('points credit is idempotent under concurrent retries and distinct raid IDs',async()=>{
  const db=new FakeWalletDB();const g='10000000000000000',u='20000000000000000';
  const results=await Promise.all(Array.from({length:8},()=>rewards.credit(db,g,u,'raid-1',1400)));
  assert.equal(results.filter(Boolean).length,1,'one atomic grant must win');
  const key=`${g}_${u}`;
  assert.equal(db.records.get(key).balance,1400);
  assert.equal(db.records.get(key).earned,1400);
  assert.equal(db.records.get(key).raidEarned,1400);
  assert.equal(await rewards.credit(db,g,u,'raid-1',1400),false,'replayed receipt must be ignored');
  assert.equal(await rewards.credit(db,g,u,'raid-2',700),true,'distinct raid pays once');
  assert.equal(db.records.get(key).balance,2100);
  assert.equal(db.records.get(key).version,2);
});

test('inventory loot and potion grant receipts survive retries (isolated temporary account file)',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gosu-test-'));
  try {
    const file=path.join(tmp,'raid-characters.json');
    const store=characters.createStore({file});const g='g',u='test-account';
    assert.equal(store.grantRaidPotion(g,u,'raid-1',true),true);
    const first=store.workshopRead(g,u,1,true);
    assert.equal(first.potions,1);assert.equal(first.lastRaidLoot.items.length,2);
    assert.equal(first.inventory.normal_enhance_scroll,1);
    assert.equal(store.grantRaidPotion(g,u,'raid-1',true),false);
    assert.deepEqual(store.workshopRead(g,u,1,true),first);
    assert.equal(store.grantRaidPotion(g,u,'raid-2',false),true);
    const second=store.workshopRead(g,u,1,true);
    assert.equal(second.potions,1);
    assert.equal(second.lastRaidLoot.items.length,1);
    assert.equal(second.inventory.normal_enhance_scroll,2);
    assert.equal(store.grantRaidPotion(g,u,'raid-2',false),false);
    assert.deepEqual(store.workshopRead(g,u,1,true),second);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('enhancement pricing and guaranteed gauge boundaries remain unchanged',()=>{
  for(const target of [1,3,4,10,20,21,26,30,31,35,36,40]){
    const q=slots.quote(target);
    assert.ok([0,100,200,300].includes(q.cost));
    assert.ok(q.target===target);
    if(q.mode==='chance') assert.ok(q.chance>=0&&q.chance<=100);
    else {assert.equal(q.mode,'gauge');assert.equal(q.chance,0);}
  }
  assert.equal(slots.quote(1).chance,100);
  assert.equal(slots.quote(3).cost,0);
  assert.equal(slots.quote(4).cost,100);
  assert.equal(slots.quote(21).cost,200);
  assert.equal(slots.quote(31).cost,300);
  assert.throws(()=>slots.quote(21,0,true),/through \+20/);
});
