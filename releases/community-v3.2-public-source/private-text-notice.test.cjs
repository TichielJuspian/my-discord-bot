'use strict';
const assert=require('node:assert/strict');
const {editNotice,replyNotice,followNotice}=require('./private-text-notice.cjs');
(async()=>{
 const orig=global.setTimeout, tasks=[], calls=[];
 global.setTimeout=(fn,ms)=>{assert.equal(ms,10000);tasks.push(fn);return {unref(){}};};
 try {
  const mark=(name,flags=64)=>({id:name,flags:{has:n=>(flags&n)===n}});
  const edit=(msg,otherwise={})=>({editReply:async()=>msg,deleteReply:async(...args)=>calls.push(args),...otherwise});
  await editNotice(edit(mark('private')),'Test closed.');
  assert.equal(calls.length,0);await tasks.shift()();assert.deepEqual(calls.splice(0),[[]]);
  await editNotice(edit(mark('public',0)),'Public');
  await editNotice(edit(mark('mismatch'),{message:mark('old')}),'No',{component:true});
  await editNotice(edit(mark('public',0),{message:mark('public',0)}),'No',{component:true});
  await editNotice(edit(mark('combat')),{components:[{type:1,components:[{type:2}]}]});
  await editNotice(edit(mark('shop')),{content:'Shop',files:['card.png']});
  assert.equal(tasks.length,0);
  await editNotice(edit(mark('battle'),{message:mark('battle'),deleteReply:async()=>{throw Object.assign(Error(),{code:10008})}}),'Test ended.',{component:true,original:{id:'battle',i:{deleteReply:async()=>calls.push(['original'])}}});
  await tasks.shift()();assert.deepEqual(calls.splice(0),[['original']]);
  await replyNotice({ephemeral:true,reply:async()=>undefined,deleteReply:async()=>calls.push(['reply'])},{flags:64,content:'Private'});
  await tasks.shift()();assert.deepEqual(calls.splice(0),[['reply']]);
  await followNotice({followUp:async()=>mark('notice'),deleteReply:async id=>calls.push([id])},{flags:64,content:'Reward'});
  await tasks.shift()();assert.deepEqual(calls.splice(0),[['notice']]);
  console.log('PASS: private notices use 10 seconds; public and mismatched panels are untouched.');
 }finally{global.setTimeout=orig;}
})().catch(e=>{console.error(e);process.exitCode=1;});
