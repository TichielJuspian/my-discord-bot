'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const {createLobby}=require('../raid-lobby');
function makeInteraction(id){return{guildId:'guild',user:{id},deferred:false,edits:[],async deferReply(){this.deferred=true;},async editReply(value){this.edits.push(value);}};}
function score(id,damage,attemptId='a') {return {id:attemptId,playerName:id,state:{config:{boss:'earth',job:'warrior',level:1},totals:{damage},log:[{action:'attack',turn:1}],turn:2,status:'victory'}};}
function fixture(){let now=1_700_000_000_000,payouts=new Set();const msg={id:'message',guildId:'guild',url:'https://discord.invalid/test',async edit(){return msg},async delete(){}};const channel={id:'channel',guildId:'guild',async send(){return msg},messages:{fetch:async()=>msg}};
 const lobby=createLobby({clock:()=>now,boss:'earth',claimCredit:async(g,u,raid)=>{const key=g+':'+u+':'+raid;if(payouts.has(key))return false;payouts.add(key);return true;}});
 const i={guildId:'guild',channel,user:{id:'owner'},deferred:false,async deferReply(){this.deferred=true;},async editReply(){}};
 return {lobby,i,payouts,jump:ms=>{now+=ms},now:()=>now};}
test('spectator Claim only appears at 0 HP and pays once',async()=>{
 const x=fixture();await x.lobby.publish(x.i,async()=>1,{scheduledRaid:true});
 const before=x.lobby.body();A.equal(JSON.stringify(before).includes('Claim 100 P'),false);
 x.lobby.record(score('challenger',400000),'challenger',{finalize:true});
 A.equal(x.lobby.cycle.success,true);A.equal(x.lobby.cycle.settled,false);
 const after=x.lobby.body();A.match(JSON.stringify(after),/Claim 100 P/);
 const a=makeInteraction('spectator');A.equal(await x.lobby.claim(a),true);A.match(a.edits.at(-1).content,/100 P claimed/);
 const b=makeInteraction('spectator');A.equal(await x.lobby.claim(b),false);A.match(b.edits.at(-1).content,/already claimed/);
 A.equal(x.payouts.size,1);
 const participant=makeInteraction('challenger');A.equal(await x.lobby.claim(participant),false);A.match(participant.edits.at(-1).content,/participated/i);
});
test('any admitted user cannot take the spectator reward, even if damage is zero',async()=>{
 const x=fixture();await x.lobby.publish(x.i,async()=>1,{scheduledRaid:true});
 const admitted=x.lobby.admit({status:'active'},'zero-damage','attempt');A.equal(admitted.allowed,true);
 x.lobby.abandon(admitted.state,'zero-damage');
 x.lobby.record(score('challenger',400000),'challenger',{finalize:true});
 const clicked=makeInteraction('zero-damage');A.equal(await x.lobby.claim(clicked),false);
 A.match(clicked.edits.at(-1).content,/participated/i);
});
test('spectator claim is disabled after the 24-hour rotation boundary',async()=>{
 const x=fixture();await x.lobby.publish(x.i,async()=>1,{scheduledRaid:true});x.lobby.record(score('challenger',400000),'challenger',{finalize:true});
 x.jump(24*60*60*1000);
 const clicked=makeInteraction('spectator');A.equal(await x.lobby.claim(clicked),false);A.match(clicked.edits.at(-1).content,/expired/i);
});
