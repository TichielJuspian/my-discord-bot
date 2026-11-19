'use strict';
// Wallet pending record is a write-ahead journal: a restart replays a paid result,
// never rerolls it or charges it twice. All character writes share the owner queue.
let db;let maintenance=Promise.resolve();const locks=new Map();
function bindDatabase(value){db=value;}
function serial(key,fn){const prior=locks.get(key)||Promise.resolve(),next=prior.catch(()=>{}).then(fn);locks.set(key,next);return next.finally(()=>{if(locks.get(key)===next)locks.delete(key);});}
function createStore(characters){
 characters??=require('./raid-characters').createStore({file:require('node:path').join(__dirname,'raid-characters.json'),testGrant:true});
 async function recover(g,u){if(!db)return;const wallets=db.collection('community_points'),doc=await wallets.findOne({_id:g+'_'+u}),p=doc?.raidPendingEnhancement;if(!p)return;
  characters.workshopCommit(g,u,p.level,p.expected,p.next,p.id);
  await wallets.updateOne({_id:g+'_'+u,'raidPendingEnhancement.id':p.id},{$unset:{raidPendingEnhancement:''}});
 }
 return {
  async resetTestProgress(baselines){
   if(!db)throw Error('Database unavailable for test reset');const owners=characters.beginTestReset();let refund=0,returned=0;
   for(const key of owners){const split=key.indexOf(':'),g=key.slice(0,split),u=key.slice(split+1);await serial(key,async()=>{
    await recover(g,u);const result=characters.resetTestProgress(g,u,baselines[key]||{});
    if(result.refund>0){const wallets=db.collection('community_points'),doc=await wallets.findOne({_id:g+'_'+u});if(!doc)throw Error('Refund wallet missing');
     if(!doc.raidTestResetV42){const paid=await wallets.findOneAndUpdate({_id:g+'_'+u,raidTestResetV42:{$ne:true},spent:{$gte:result.refund}},{$inc:{balance:result.refund,spent:-result.refund,version:1},$set:{raidTestResetV42:true}},{returnDocument:'after'});if(!paid)throw Error('Refund requires review');}
    }refund+=result.refund;returned+=result.returned;
   });}
   characters.finishTestReset();console.info('[TEST RESET V42]',JSON.stringify({accounts:owners.length,refund,returned}));return {accounts:owners.length,refund,returned};
  },
  read(g,u,level,initialize=false){return serial(g+':'+u,async()=>{await recover(g,u);return characters.workshopRead(g,u,level,initialize);});},
  readBalance(g,u){return serial(g+':'+u,async()=>{
   if(!db)return null;
   const wallet=await db.collection('community_points').findOne({_id:g+'_'+u},{projection:{balance:1}});
   const balance=wallet?.balance??0;if(!Number.isSafeInteger(balance)||balance<0)throw Error('The points balance is unavailable.');
   return balance;
  });},
  apply(g,u,level,request,roll){return serial(g+':'+u,async()=>{
   await recover(g,u);
   if(request.action!=='enhance')return characters.workshopApply(g,u,level,request,roll);
   if(!db)throw Error('The points database is unavailable. No enhancement was charged.');
   const current=characters.workshopRead(g,u,level,true),M=require('./raid-workshop-model');
   if(current.receipts.includes(request.id))return current;
   const next=M.change(current,request,level,roll),cost=next.lastEnhancement.cost;
   const wallets=db.collection('community_points');
   await wallets.updateOne({_id:g+'_'+u},{$setOnInsert:{guildId:g,userId:u,balance:0,earned:0,spent:0,visits:0,streak:0,version:0,owned:[],theme:null,badge:null}},{upsert:true});
   const pending={id:request.id,level,expected:current.revision,next};
   const paid=await wallets.findOneAndUpdate({_id:g+'_'+u,balance:{$gte:cost},raidPendingEnhancement:{$exists:false}},{$inc:{balance:-cost,spent:cost,version:1},$set:{raidPendingEnhancement:pending}},{returnDocument:'after'});
   if(!paid)throw Error('Not enough points. This attempt costs '+cost+' P. No enhancement was attempted.');
   // On a failure after this point leave the journal intact for safe recovery.
   const result=characters.workshopCommit(g,u,level,current.revision,next,request.id);
   await wallets.updateOne({_id:g+'_'+u,'raidPendingEnhancement.id':request.id},{$unset:{raidPendingEnhancement:''}});
   return result;
  });},
  grantRaidReward(g,u,raidId,points,success){return serial(g+':'+u,async()=>{await recover(g,u);await require('./raid-point-rewards').credit(db,g,u,raidId,points);return characters.grantRaidPotion(g,u,raidId,success);});},
  grantRaidPotion(g,u,raidId){return serial(g+':'+u,async()=>{await recover(g,u);return characters.grantRaidPotion(g,u,raidId);});}
 };
}
let shared;const get=()=>shared??=createStore();module.exports={createStore,bindDatabase,grantRaidReward:async(...a)=>{await maintenance;return get().grantRaidReward(...a);},resetTestProgress:(baselines)=>{maintenance=get().resetTestProgress(baselines);return maintenance;},read:async(...a)=>{await maintenance;return get().read(...a);},readBalance:async(...a)=>{await maintenance;return get().readBalance(...a);},apply:async(...a)=>{await maintenance;return get().apply(...a);},grantRaidPotion:async(...a)=>{await maintenance;return get().grantRaidPotion(...a);}};
