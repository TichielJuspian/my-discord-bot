'use strict';
// MongoDB-like single-document atomicity tests. They do not contact a MongoDB server.
const test = require('node:test');
const assert = require('node:assert/strict');
const points = require('../points-store');
const raid = require('../raid-point-rewards');
const clone = x => x == null ? x : structuredClone(x);
function valueAt(o, p) { return p.split('.').reduce((v,k)=>v==null?undefined:v[k],o); }
function match(d,q) { for(const [k,v] of Object.entries(q)){
 const old=valueAt(d,k);
 if(v && typeof v==='object' && !Array.isArray(v)){
  if ('$gte' in v && !(old>=v.$gte))return false;
  if ('$ne' in v && (Array.isArray(old)?old.includes(v.$ne):old===v.$ne))return false;
  if ('$exists' in v && (old!==undefined)!==v.$exists)return false;
 }else if(old!==v)return false;
 }return true; }
function set(o,path,v){const p=path.split('.');let cur=o;for(const key of p.slice(0,-1))cur=cur[key]??={};cur[p.at(-1)]=clone(v);}
function apply(doc,u){for(const [k,v] of Object.entries(u.$setOnInsert||{}))if(doc[k]===undefined)set(doc,k,v);
 for(const [k,v]of Object.entries(u.$inc||{}))set(doc,k,(valueAt(doc,k)||0)+v);
 for(const [k,v]of Object.entries(u.$set||{}))set(doc,k,v);
 for(const [k,v]of Object.entries(u.$addToSet||{})){const a=valueAt(doc,k)||[];const values=v && v.$each ? v.$each:[v];set(doc,k,[...new Set([...a,...values])]);}
}
class FakeMongoCollection {
 constructor(){this.docs=new Map();}
 async findOne(q){return clone(this.docs.get(q._id)||null);}
 async findOneAndUpdate(q,u,opts={}){let doc=this.docs.get(q._id);if(!doc){if(!opts.upsert)return null;doc={_id:q._id};this.docs.set(q._id,doc);}
 if(!match(doc,q))return null;apply(doc,u);return clone(doc);}
 async updateOne(q,u,opts={}){let doc=this.docs.get(q._id);if(!doc){if(!opts.upsert)return {modifiedCount:0};doc={_id:q._id};this.docs.set(q._id,doc);}
 if(!match(doc,q))return {modifiedCount:0};apply(doc,u);return {modifiedCount:1};}
}
function fakeDB(){const map=new Map();return {collection:name=>{if(!map.has(name))map.set(name,new FakeMongoCollection());return map.get(name);}};}

test('point shop: ten simultaneous clicks on the same item charge once',async()=>{
 const db=fakeDB(),store=points.createPointsStore();await store.init(db);
 const item=points.CATALOG.find(x=>x.saleable!==false && x.type==='theme'&&x.price>0);assert.ok(item);
 const wallet=db.collection('community_points');wallet.docs.set('guild_alice',{_id:'guild_alice',guildId:'guild',userId:'alice',balance:item.price*2+1234,earned:item.price*2+1234,spent:0,visits:0,streak:0,version:0,owned:[]});
 const responses=await Promise.all(Array.from({length:10},()=>store.buy('guild','alice',item.id)));
 assert.equal(responses.filter(x=>x.purchased).length,1);
 const doc=await wallet.findOne({_id:'guild_alice'});
 assert.equal(doc.spent,item.price);assert.equal(doc.balance,item.price+1234);assert.equal(doc.owned.filter(x=>x===item.id).length,1);
});

test('point shop: insufficient balance preserves inventory and points',async()=>{
 const db=fakeDB(),store=points.createPointsStore();await store.init(db);
 const item=points.CATALOG.find(x=>x.saleable!==false && x.type==='theme'&&x.price>0);
 const wallet=db.collection('community_points');wallet.docs.set('guild_bob',{_id:'guild_bob',guildId:'guild',userId:'bob',balance:item.price-1,earned:item.price-1,spent:0,visits:0,streak:0,version:0,owned:[]});
 await assert.rejects(()=>store.buy('guild','bob',item.id),/need/i);
 const doc=await wallet.findOne({_id:'guild_bob'});
 assert.equal(doc.balance,item.price-1);assert.deepEqual(doc.owned,[]);
});

test('raid reward receipt: repeated commits credit points only once',async()=>{
 const db=fakeDB();const amount=1000;const results=await Promise.all(Array.from({length:12},()=>raid.credit(db,'guild','alice','raid-one',amount)));
 assert.equal(results.filter(Boolean).length,1);
 const doc=await db.collection('community_points').findOne({_id:'guild_alice'});
 assert.equal(doc.balance,amount);assert.equal(doc.earned,amount);assert.equal(Object.keys(doc.raidRewardReceipts).length,1);
});

test('raid rank: equal damage shares same rank and zero damage is excluded',()=>{
 assert.deepEqual(raid.rewards([{id:'u1',damage:800},{id:'u2',damage:800},{id:'u3',damage:0},{id:'u4',damage:400}],true).map(x=>[x.rank,x.points]),[[1,1400],[1,1400],[3,1200]]);
});
