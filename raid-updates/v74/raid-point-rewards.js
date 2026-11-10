'use strict';
const crypto=require('node:crypto');
function rankPoints(rank){if(!Number.isSafeInteger(rank)||rank<1)throw Error('Invalid raid rank');return rank===1?500:rank===2?400:rank<=5?300:rank<=25?200:100;}
function rewards(rows,success){let previous=null,rank=0;return rows.filter(x=>Number.isSafeInteger(x.damage)&&x.damage>0).sort((a,b)=>b.damage-a.damage).map((x,i)=>{if(x.damage!==previous)rank=i+1;previous=x.damage;return {userId:x.id,rank,points:rankPoints(rank)+(success?1000:200)};});}
async function credit(db,g,u,raidId,amount){
 if(!db)throw Error('Raid points database unavailable');
 if(!Number.isSafeInteger(amount)||amount<1||amount>1500)throw Error('Invalid raid points');
 const wallets=db.collection('community_points'),id=g+'_'+u;
 await wallets.updateOne({_id:id},{$setOnInsert:{guildId:g,userId:u,balance:0,earned:0,spent:0,visits:0,streak:0,version:0,owned:[],theme:null,badge:null}},{upsert:true});
 const key='raidRewardReceipts.'+crypto.createHash('sha256').update(raidId).digest('hex');
 const result=await wallets.updateOne({_id:id,[key]:{$exists:false}},{$inc:{balance:amount,earned:amount,version:1,raidEarned:amount},$set:{[key]:amount}});
 return result.modifiedCount===1;
}
module.exports={rankPoints,rewards,credit};
