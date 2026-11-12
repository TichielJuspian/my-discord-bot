'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../raid-scheduler');
function fixture(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'gosu-scheduler-'));
 let now=1_700_000_000_000;
 const lobbies=new Map(['earth','nameless_succubus'].map(b=>[b,{
  cycle:{active:false,scheduled:false,openedAt:0,id:null,expiresAt:0,settled:false},
  published:0,paid:0,retired:0,closed:0,
  async publish(i,level,{scheduledRaid}){A.equal(i.user.id,'owner');A.equal(scheduledRaid,true);this.published++;this.cycle={active:true,scheduled:true,openedAt:now,id:b+'-'+this.published,expiresAt:now+S.DURATION_MS,settled:false};return true;},
  async settleRewards(){this.paid++;this.cycle.settled=true;},
  async closeUi(){this.closed++;},retire(){this.retired++;this.cycle.active=false;}
 }]));
 const client={guilds:{fetch:async()=>({channels:{fetch:async()=>({send:async()=>{}})}})}};
 const opts={stateFile:path.join(folder,'state.json'),lobbies,guildId:'guild',ownerId:'owner',clock:()=>now,setTimer:(fn,ms)=>({fn,ms,unref(){}}),clearTimer:()=>{},choose:previous=>previous==='earth'?'nameless_succubus':'earth'};
 return {lobbies,client,opts,clock:()=>now,jump:n=>{now+=n},cleanup:()=>fs.rmSync(folder,{force:true,recursive:true})};
}
test('23-hour settlement, one-hour break, alternate boss, persistent resume',async()=>{
 const x=fixture();try{
  const a=S.createRaidScheduler(x.opts);
  const result=await a.enable(x.client,'raid-channel');A.equal(result.started,true);
  A.equal(a.current().boss,'earth');A.equal(x.lobbies.get('earth').published,1);
  x.jump(S.DURATION_MS-1);await a.tick();A.equal(x.lobbies.get('earth').paid,0);
  x.jump(1);await a.tick();A.equal(x.lobbies.get('earth').paid,1);
  A.equal(a.current().phase,'cooldown');A.equal(x.lobbies.get('nameless_succubus').published,0);
  const b=S.createRaidScheduler(x.opts);await b.resume(x.client);
  x.jump(S.BREAK_MS-1);await b.tick();A.equal(x.lobbies.get('nameless_succubus').published,0);
  x.jump(1);await b.tick();A.equal(x.lobbies.get('nameless_succubus').published,1);
  A.equal(b.current().boss,'nameless_succubus');A.equal(x.lobbies.get('earth').retired,1);
  A.equal(x.lobbies.get('earth').closed,1);
 }finally{x.cleanup();}
});
test('settlement failure never creates a replacement boss',async()=>{
 const x=fixture();try{
  const a=S.createRaidScheduler(x.opts);await a.enable(x.client,'raid');
  x.lobbies.get('earth').settleRewards=async()=>{throw Error('database unavailable')};
  x.jump(S.DURATION_MS+S.BREAK_MS+1000);
  await A.rejects(a.tick(),/database unavailable/);
  A.equal(x.lobbies.get('nameless_succubus').published,0);
  A.equal(a.current().phase,'active');
 }finally{x.cleanup();}
});
test('stopping rotation still settles the current raid',async()=>{
 const x=fixture();try{
  const a=S.createRaidScheduler(x.opts);await a.enable(x.client,'raid');
  assertStop(a.stopAfterCurrent());
  x.jump(S.DURATION_MS);await a.tick();
  A.equal(x.lobbies.get('earth').paid,1);
  A.equal(a.current().phase,'idle');A.equal(a.current().enabled,false);
  x.jump(S.BREAK_MS);await a.tick();A.equal(x.lobbies.get('nameless_succubus').published,0);
 }finally{x.cleanup();}
 function assertStop(msg){A.match(msg,/after the current raid has settled/i);}
});
test('ambiguous publishing does not blindly send a second lobby',async()=>{
 const x=fixture();try{
  const lobby=x.lobbies.get('earth'),original=lobby.publish.bind(lobby);
  lobby.publish=async(...args)=>{await original(...args);throw Error('Discord lost response')};
  const a=S.createRaidScheduler(x.opts);
  await A.rejects(a.enable(x.client,'raid'),/lost response/);
  A.equal(a.current().phase,'publishing');A.equal(lobby.published,1);
  const b=S.createRaidScheduler(x.opts);await b.resume(x.client);
  A.equal(b.current().phase,'active');A.equal(lobby.published,1);
 }finally{x.cleanup();}
});
test('existing active beta raid is never overwritten',async()=>{
 const x=fixture();try{
  const c=x.lobbies.get('earth').cycle;
  Object.assign(c,{active:true,settled:false,expiresAt:x.clock()+S.DURATION_MS});
  const a=S.createRaidScheduler(x.opts);
  await A.rejects(a.enable(x.client,'raid'),/existing raid/);
  A.equal(a.current().enabled,false);
 }finally{x.cleanup();}
});

test('permanent paid-class rule persists after /raidsetstop and bot restart',async()=>{
 const x=fixture();try{
  const a=S.createRaidScheduler(x.opts);
  A.equal(a.isProductionActive(),false);
  await a.enable(x.client,'raid');A.equal(a.isProductionActive(),true);
  a.stopAfterCurrent();x.jump(S.DURATION_MS);await a.tick();
  A.equal(a.current().enabled,false);A.equal(a.isProductionActive(),true);
  const recovered=S.createRaidScheduler(x.opts);A.equal(recovered.isProductionActive(),true);
 }finally{x.cleanup();}
});
