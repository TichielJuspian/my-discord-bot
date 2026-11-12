'use strict';
// Simulates atomic MongoDB single-document wallet operations; no live database access.
const test=require('node:test'),A=require('node:assert/strict');
const chars=require('../raid-characters'),storage=require('../raid-workshop-store');
const clone=x=>x==null?x:structuredClone(x);
const get=(d,p)=>p.split('.').reduce((x,k)=>x?.[k],d);
function set(d,p,v){const a=p.split('.');let o=d;for(const k of a.slice(0,-1))o=o[k]??={};o[a.at(-1)]=clone(v);}
function unset(d,p){const a=p.split('.');let o=d;for(const k of a.slice(0,-1))o=o?.[k];if(o)delete o[a.at(-1)];}
function matches(d,q){return Object.entries(q).every(([key,v])=>{const actual=get(d,key);if(v&&typeof v==='object'&&!Array.isArray(v)){if('$exists'in v&&((actual!==undefined)!==v.$exists))return false;if('$gte'in v&&!(actual>=v.$gte))return false;if('$ne'in v&&actual===v.$ne)return false;return true;}return actual===v;});}
function apply(d,u){for(const[k,v]of Object.entries(u.$setOnInsert||{}))if(get(d,k)===undefined)set(d,k,v);for(const[k,v]of Object.entries(u.$inc||{}))set(d,k,(get(d,k)||0)+v);for(const[k,v]of Object.entries(u.$set||{}))set(d,k,v);for(const p of Object.keys(u.$unset||{}))unset(d,p);}
function fakeDB(){const cols=new Map();return{collection(name){if(!cols.has(name)){const docs=new Map();cols.set(name,{docs,async findOne(q){const d=docs.get(q._id);return d&&matches(d,q)?clone(d):null;},async updateOne(q,u,o={}){let d=docs.get(q._id);if(!d){if(!o.upsert)return {modifiedCount:0};d={_id:q._id};docs.set(q._id,d);}if(!matches(d,q))return {modifiedCount:0};apply(d,u);return {modifiedCount:1};},async findOneAndUpdate(q,u,o={}){let d=docs.get(q._id);if(!d){if(!o.upsert)return null;d={_id:q._id};docs.set(q._id,d);}if(!matches(d,q))return null;apply(d,u);return clone(d);}});}return cols.get(name);}};}
test('initial class is free; later change costs exactly 1000 P, with duplicate click protection',async()=>{
 const db=fakeDB(),characters=chars.createStore(),store=storage.createStore(characters,{productionActive:()=>true});storage.bindDatabase(db);
 const wallets=db.collection('community_points');wallets.docs.set('g_u',{_id:'g_u',guildId:'g',userId:'u',balance:3000,spent:0,earned:3000,version:0});
 let a=await store.read('g','u',10,true);A.equal(characters.get('g','u').job,null);A.equal(await store.classCost('g','u'),0);
 a=await store.apply('g','u',10,{action:'job',value:'paladin',revision:a.revision,id:'initial-free'},0);
 A.equal(a.job,'paladin');A.equal(await store.classCost('g','u'),1000);
 A.equal((await wallets.findOne({_id:'g_u'})).balance,3000);
 const job={action:'job',value:'berserker',revision:a.revision,id:'confirmed-class-change'};
 const results=await Promise.all(Array.from({length:10},()=>store.apply('g','u',10,job,0)));
 A(results.every(x=>x.job==='berserker'));
 A.equal((await wallets.findOne({_id:'g_u'})).balance,2000);
 A.equal((await wallets.findOne({_id:'g_u'})).spent,1000);
 A.equal((await store.read('g','u',10,true)).job,'berserker');
});
test('insufficient balance never changes class',async()=>{
 const db=fakeDB(),characters=chars.createStore(),store=storage.createStore(characters,{productionActive:()=>true});storage.bindDatabase(db);
 const wallets=db.collection('community_points');wallets.docs.set('g_u',{_id:'g_u',balance:999,spent:0,earned:999,version:0});
 let a=await store.read('g','u',10,true);a=await store.apply('g','u',10,{action:'job',value:'paladin',revision:a.revision,id:'start'},0);
 await A.rejects(store.apply('g','u',10,{action:'job',value:'berserker',revision:a.revision,id:'costly'},0),/Not enough points/);
 A.equal((await store.read('g','u',10,true)).job,'paladin');A.equal((await wallets.findOne({_id:'g_u'})).balance,999);
});
test('charged class change can be recovered after a character-write interruption',async()=>{
 const db=fakeDB(),characters=chars.createStore(),store=storage.createStore(characters,{productionActive:()=>true});storage.bindDatabase(db);
 const wallets=db.collection('community_points');wallets.docs.set('g_u',{_id:'g_u',balance:2000,spent:0,earned:2000,version:0});
 let a=await store.read('g','u',10,true);a=await store.apply('g','u',10,{action:'job',value:'paladin',revision:a.revision,id:'free'},0);
 const real=characters.workshopCommit;let fail=true;characters.workshopCommit=(...args)=>{if(fail){fail=false;throw Error('simulated interrupted write');}return real(...args);};
 await A.rejects(store.apply('g','u',10,{action:'job',value:'warrior',revision:a.revision,id:'paid-retry'},0),/interrupted write/);
 A.equal((await wallets.findOne({_id:'g_u'})).balance,1000);
 A.equal((await wallets.findOne({_id:'g_u'})).raidPendingEnhancement.id,'paid-retry');
 const recovered=await store.read('g','u',10,true);
 A.equal(recovered.job,'warrior');
 A.equal((await wallets.findOne({_id:'g_u'})).balance,1000);
 A.equal((await wallets.findOne({_id:'g_u'})).raidPendingEnhancement,undefined);
});
