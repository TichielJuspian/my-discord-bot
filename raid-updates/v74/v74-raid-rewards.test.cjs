'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const P=require('./raid-point-rewards');
test('point tiers, success/failure bonuses and ties',()=>{
 for(const [r,p]of [[1,500],[2,400],[3,300],[5,300],[6,200],[25,200],[26,100]])A.equal(P.rankPoints(r),p);
 const rows=[{id:'a',damage:100},{id:'b',damage:100},{id:'c',damage:90},{id:'z',damage:0}];
 A.deepEqual(P.rewards(rows,true).map(x=>[x.rank,x.points]),[[1,1500],[1,1500],[3,1300]]);
 A.deepEqual(P.rewards(rows,false).map(x=>x.points),[700,700,500]);
});
function dbFake(){const docs=new Map();return {docs,collection(){return {async updateOne(q,u){let d=docs.get(q._id);if(!d){d={...u.$setOnInsert};docs.set(q._id,d);}for(const [k,v]of Object.entries(q))if(k!=='_id'&&v.$exists===false&&d[k]!==undefined)return {modifiedCount:0};for(const[k,v]of Object.entries(u.$inc||{}))d[k]=(d[k]||0)+v;Object.assign(d,u.$set);return {modifiedCount:1};},async findOne(q){return docs.get(q._id)||null;}};}};}
test('atomic point receipts survive retry; inventory and failed rewards once',async()=>{
 const db=dbFake(),C=require('./raid-characters').createStore(),S=require('./raid-workshop-store');S.bindDatabase(db);const store=S.createStore(C);
 await Promise.all(Array.from({length:8},()=>store.grantRaidReward('g','u','raid1',1500,true)));
 A.equal(db.docs.get('g_u').balance,1500);let w=C.workshopRead('g','u',1);A.equal(w.potions,1);A.equal(w.lastRaidLoot.items.length,2);
 await store.grantRaidReward('g','u','raid2',700,false);await store.grantRaidReward('g','u','raid2',700,false);
 A.equal(db.docs.get('g_u').balance,2200);w=C.workshopRead('g','u',1);A.equal(w.potions,1);A.equal(w.lastRaidLoot.items.length,1);A.equal(w.inventory.normal_enhance_scroll,2);
});
test('public deadline, immutable rankings, restart/retry and reset',async()=>{
 const S=require('./raid-workshop-store'),calls=[];let fail=false;const original=S.grantRaidReward;S.grantRaidReward=async(...args)=>{if(fail){fail=false;throw Error('temporary');}calls.push(args);};
 const {createLobby}=require('./raid-lobby');let now=1700000000000;const folder=fs.mkdtempSync(path.join(__dirname,'v74-test-')),file=path.join(folder,'raid.json');
 const msg={id:'m',guildId:'g',url:'mock',edit:async()=>msg,delete:async()=>{}};const ch={id:'c',guildId:'g',send:async()=>msg,messages:{fetch:async()=>msg}};const i={channel:ch,user:{id:'owner'},guildId:'g',deferReply:async()=>{},editReply:async()=>{}};
 let l=createLobby({clock:()=>now,storageFile:file});await l.publish(i,()=>1);
 const record=(u,d)=>l.record({id:u,playerName:u,state:{config:{boss:'earth',job:'warrior',level:1},totals:{damage:d},log:[{action:'attack',turn:1}],turn:2,status:'retreated'}},u,{finalize:true});
 record('a',100);record('b',50);await l.refresh();A.equal(calls.length,0);
 now+=23*3600000-1;A.equal(l.entryCheck('x').allowed,true);now++;A.equal(l.entryCheck('x').allowed,false);
 fail=true;await A.rejects(l.refresh());A.equal(JSON.parse(fs.readFileSync(file)).settlement.done,false);
 const restored=createLobby({clock:()=>now,storageFile:file});await restored.start({channels:{fetch:async()=>ch}});await restored.refresh();A.deepEqual(calls.map(x=>[x[1],x[3],x[4]]),[['a',700,false],['b',600,false]]);A.equal(JSON.parse(fs.readFileSync(file)).settlement.done,true);await restored.refresh();A.equal(calls.length,2);
 restored.retire();l.retire();l=createLobby({clock:()=>now});await l.publish(i,()=>1);const admission=l.admit({status:'active'},'pending','p');A(admission.allowed);record('winner',400000);await l.refresh();A.equal(calls.length,2);l.abandon(admission.state,'pending');await l.refresh();A.equal(calls.at(-1)[3],1500);A.equal(calls.at(-1)[4],true);await l.refresh();A.equal(calls.length,3);l.retire();
 l=createLobby({clock:()=>now});await l.publish(i,()=>1);record('cancelled',20);l.retire();await l.refresh();A.equal(calls.length,3);S.grantRaidReward=original;
});
