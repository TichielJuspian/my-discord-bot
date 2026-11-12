'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const {createTicketArchive}=require('../ticket-archive');
const base=()=>({_id:'claim1',guildId:'g',userId:'u',item:'Skin A',status:'fulfilled',closureState:'pending',closureDeleteAt:new Date(0),closureReviewId:'private-review',ticketChannelId:'private-ticket'});
function fixtures({privateReview=true,readContent=true}={}){
 const claim=base(),ticketDoc={_id:'g_u',channelId:'private-ticket',closingClaimId:'claim1'};let deleted=false,archives=0;
 const sent={id:'transcript-message',attachments:new Map([['file',{id:'file'}]])};
 const userMessage={id:'message-1',author:{id:'u',username:'User'},content:'MLBB ID: 1234567',embeds:[],attachments:new Map(),createdTimestamp:Date.now()};
 const page={size:1,values:()=>[userMessage],last:()=>userMessage};
 const ticketChannel={topic:'gift-ticket:g_u',messages:{fetch:async()=>page},async delete(){deleted=true;}};
 const review={messages:{fetch:async()=>null},async send(){archives++;return sent;}};
 const db={collection(name){if(name==='gift_claims')return{
  async findOne(q){return q._id?.$ne?null:structuredClone(claim);},
  async findOneAndUpdate(q,u){if(claim.status!=='fulfilled')return null;Object.assign(claim,u.$set);return structuredClone(claim);},
  async updateOne(q,u){Object.assign(claim,u.$set||{});for(const key of Object.keys(u.$unset||{}))delete claim[key];return {modifiedCount:1};}
 };if(name==='gift_tickets')return{async updateOne(q,u){Object.assign(ticketDoc,u.$set||{});for(const key of Object.keys(u.$unset||{}))delete ticketDoc[key];return {modifiedCount:1};}};throw Error(name);}};
 const client={guilds:{fetch:async()=>({channels:{fetch:async()=>ticketChannel}})},channels:{fetch:async()=>review},user:{id:'bot'}};
 const archive=createTicketArchive({client,validateReview:()=>privateReview,canReadUserContent:()=>readContent});archive.init(db);
 return{archive,claim,get deleted(){return deleted},get archives(){return archives}};
}
test('confirmed delivery: archive first, then delete ticket immediately',async()=>{
 const f=fixtures();A.equal(await f.archive.run('claim1'),true);
 A.equal(f.deleted,true);A.equal(f.archives,1);A.equal(f.claim.closureState,'closed');
});
test('privacy validation failure keeps original ticket',async()=>{
 const f=fixtures({privateReview:false});A.equal(await f.archive.run('claim1'),false);
 A.equal(f.deleted,false);A.equal(f.archives,0);A.equal(f.claim.closureState,'pending');
});
test('unreadable user message keeps ticket; never delete without reliable transcript',async()=>{
 const f=fixtures({readContent:false});A.equal(await f.archive.run('claim1'),false);
 A.equal(f.deleted,false);A.equal(f.archives,0);
});
