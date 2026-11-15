"use strict";
const boosterBenefits = require('./booster-point-benefits');
// XP acceptance never depends on Discord or booster registration availability.
// Discord server-boost membership only; no roles, boost counts, or point stacks.
function boosterChatXP(member){
 if(!member)return 0;
 if('premiumSinceTimestamp' in member)return member.premiumSinceTimestamp!=null?2:0;
 return member.premium_since!=null?2:0;
}
const levelFromXP=x=>Math.floor(Math.sqrt(x/100));
function reward(from,to){
 if(![from,to].every(x=>Number.isSafeInteger(x)&&x>=0))throw Error('Invalid level');
 const amount=to>from?(to-from)*100+(Math.floor(to/5)-Math.floor(from/5))*500:0;
 if(!Number.isSafeInteger(amount))throw Error('Invalid earned points');
 return amount;
}
function create({mongo,guildId,clock=Date.now,retryIntervalMs=60000}){
 let xp,wallets,events,pendingRewards,ready=false,timer,draining;
 const pending=new Map();
 const error=e=>console.error('[LEVEL REWARD RETRY]',e.code||e.name||'Error');
 async function init(db){
  xp=db.collection('user_xp');wallets=db.collection('community_points');events=db.collection('level_point_rewards');pendingRewards=db.collection('level_point_pending');
  // Only initialize missing baselines. Never turn historical levels into pending grants.
  await xp.updateMany({guildId,levelRewardHighWater:{$exists:false}},[{$set:{levelRewardHighWater:{$ifNull:['$level',0]}}}]);
  ready=true;
  drain().catch(error);
  if(!timer){timer=setInterval(()=>{drain().catch(error);},retryIntervalMs);timer.unref?.();}
 }
 function stop(){if(timer)clearInterval(timer);timer=null;ready=false;}
 async function handleMessage(message){
  if(!ready||message.guildId!==guildId||message.author?.bot||!message.author?.id)return;
  return award(message.author.id,'chat',message.id,boosterChatXP(message.member));
 }
 async function handleVoiceMinute(userId){if(!ready||!userId)return;return award(userId,'voice');}
 function award(userId,source,messageId,chatBonus=0){
  const now=clock();
  const task=(pending.get(userId)||Promise.resolve()).catch(()=>{}).then(()=>awardNow(userId,source,messageId,now,chatBonus));
  pending.set(userId,task);
  task.finally(()=>{if(pending.get(userId)===task)pending.delete(userId)}).catch(()=>{});
  return task.then(completeAward);
 }
 async function awardNow(userId,source,messageId,now,chatBonus){
  const key={guildId,userId},gain=source==='chat'?20+chatBonus:5,lastField=source==='chat'?'levelXPLastAt':'levelXPVoiceLastAt';
  const accepted=await mongo.withSession(session=>session.withTransaction(async()=>{
   const old=await xp.findOne(key,{session});
   if(source==='chat'&&old?.levelXPMessageId===messageId||old?.[lastField]!=null&&now-old[lastField]<60000)return;
   const previous=old?.level||0,total=(old?.xp||0)+gain,level=Math.max(previous,levelFromXP(total));
   if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid XP');
   const high=old?.levelRewardHighWater??previous,from=Math.max(previous,high),baseAmount=reward(from,level);
   if(!Number.isSafeInteger(high)||high<0)throw Error('Invalid level');
   const eventId=guildId+':'+userId+':'+level;
   if(baseAmount)await pendingRewards.insertOne({_id:eventId,guildId,userId,from,to:level,baseAmount,source,...(messageId?{messageId}:{}),at:new Date(now)},{session});
   await xp.updateOne(old?{_id:old._id}:{...key,_id:guildId+':'+userId},{$set:{level,xp:total,levelRewardHighWater:high,[lastField]:now,...(source==='chat'?{levelXPMessageId:messageId}:{})}},{upsert:true,session});
   return {level,baseAmount,eventId};
  }));
  return accepted;
 }
 function completeAward(accepted){
  if(!accepted)return;
  // Public XP handlers acknowledge the durable acceptance only. In particular,
  // voice-xp must not wait for Discord before processing the next voice member.
  drain().catch(error);
  if(!accepted.baseAmount)return {level:accepted.level,amount:0,rewardPending:false};
  return {level:accepted.level,amount:null,baseAmount:accepted.baseAmount,rewardPending:true,eventId:accepted.eventId};
 }
 async function settle(row){
  if(reward(row.from,row.to)!==row.baseAmount)throw Error('Invalid pending reward');
  // Bonus uses the first successfully verified payout-time status, not historical
  // acceptance-time status. Freeze it before any wallet mutation. Competing
  // workers may look up status, but only the first stored snapshot can be credited.
  if(!row.booster){
   const booster=await boosterBenefits.snapshot(guildId,row.userId,row.baseAmount);
   if(!Number.isSafeInteger(booster.points)||booster.points<row.baseAmount)throw Error('Invalid earned points');
   await pendingRewards.updateOne({_id:row._id,booster:{$exists:false}},{$set:{booster}});
  }
  return mongo.withSession(session=>session.withTransaction(async()=>{
   const current=await pendingRewards.findOne({_id:row._id},{session});
   if(!current)return;
   const earlier=await pendingRewards.findOne({guildId,userId:current.userId,to:{$lt:current.to}},{session});
   if(earlier)return;
   const paid=await events.findOne({_id:current._id},{session});
   if(paid){await pendingRewards.deleteOne({_id:current._id},{session});return;}
   if(reward(current.from,current.to)!==current.baseAmount)throw Error('Invalid pending reward');
   const booster=boosterBenefits.validateSnapshot(current.booster,{guildId,userId:current.userId,basePoints:current.baseAmount}),amount=booster.points;
   if(!Number.isSafeInteger(amount)||amount<current.baseAmount)throw Error('Invalid earned points');
   const id=guildId+'_'+current.userId,wallet=await wallets.findOne({_id:id},{session});
   for(const field of ['balance','earned','levelEarned','version']){const value=wallet?.[field]??0,increment=field==='version'?1:amount;if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(value+increment))throw Error('Invalid point balance');}
   await wallets.updateOne({_id:id},{$setOnInsert:{guildId,userId:current.userId,spent:0,visits:0,streak:0,owned:[],theme:null,badge:null},$inc:{balance:amount,earned:amount,version:1,levelEarned:amount}},{upsert:true,session});
   await events.insertOne({...current,amount,creditedAt:new Date(clock())},{session});
   await xp.updateOne({guildId,userId:current.userId},{$max:{levelRewardHighWater:current.to}},{session});
   await pendingRewards.deleteOne({_id:current._id},{session});
   return amount;
  }));
 }
 function drain(){
  if(draining)return draining;
  draining=(async()=>{
   // Rotate failed attempts behind unattempted/older work so poison rows cannot
   // monopolize the bounded batch. settle still enforces per-user level order.
   const rows=await pendingRewards.find({guildId}).sort({lastAttemptAt:1,at:1,to:1}).limit(100).toArray();
   const blocked=new Set();
   for(const row of rows){if(blocked.has(row.userId))continue;try{await pendingRewards.updateOne({_id:row._id},{$set:{lastAttemptAt:clock()}});await settle(row);}catch(e){blocked.add(row.userId);error(e);}}
  })().catch(error).finally(()=>{draining=null;});
  return draining;
 }
 return {init,handleMessage,handleVoiceMinute,drain,stop};
}
module.exports={create,reward,levelFromXP};
