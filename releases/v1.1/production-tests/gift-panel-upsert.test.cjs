'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {upsert}=require('../gift-panel-upsert');

function harness({existing=false,missingHistory=false}={}){
  let data={_id:'g',panelChannelId:'panel',buttonMessageId:existing?'old':null};
  const messages=new Map();let sends=0, edits=0, writes=0, reads=0;
  const make=id=>({id,author:{id:'bot'},components:[{components:[{customId:'gift:open'}]}],edit:async()=>{edits++;return messages.get(id);}});
  if(existing)messages.set('old',make('old'));
  const channel={id:'panel',messages:{async fetch(q){reads++;if(missingHistory)throw Object.assign(Error('no access'),{code:50013});
    if(typeof q==='string'){if(!messages.has(q))throw Object.assign(Error('not found'),{code:10008});return messages.get(q);}
    return {find:fn=>[...messages.values()].find(fn)};
  }},async send(){sends++;await new Promise(r=>setTimeout(r,5));const m=make('new');messages.set(m.id,m);return m;}};
  const settings={findOne:async()=>({...data}),updateOne:async(query,update)=>{writes++;data={...data,...update.$set};}};
  const call=()=>upsert({guildId:'g',channel,botId:'bot',settings,payload:{embeds:[]},allowedChannelId:'panel'});
  return {call,channel,settings, get counts(){return {sends,edits,writes,reads}}, get saved(){return data}};
}

test('double-click or concurrent recovery publishes exactly one panel and stores its ID',async()=>{
  const h=harness();
  const [a,b]=await Promise.all([h.call(),h.call()]);
  assert.equal(h.counts.sends,1);
  assert.equal(h.counts.writes,1);
  assert.equal(a.messageId,b.messageId);
  assert.equal(h.saved.buttonMessageId,'new');
  assert.equal((await h.call()).reused,true);
  assert.equal(h.counts.sends,1);
  assert.equal(h.counts.edits,1);
});

test('existing bot-authored panel is edited rather than posted again',async()=>{
  const h=harness({existing:true});const r=await h.call();
  assert.equal(r.reused,true);assert.equal(h.counts.edits,1);assert.equal(h.counts.sends,0);
});

test('missing stored message is recovered from channel history without duplicate post',async()=>{
  const h=harness({existing:true});
  const old=h.saved.buttonMessageId;
  await h.settings.updateOne({},{$set:{buttonMessageId:'stale'}});
  const r=await h.call();assert.equal(r.messageId,old);assert.equal(h.counts.edits,1);assert.equal(h.counts.sends,0);
});

test('Discord history permission failure never creates an accidental duplicate',async()=>{
  const h=harness({missingHistory:true});
  await assert.rejects(h.call());assert.equal(h.counts.sends,0);
});

test('wrong channel is rejected without publishing a second panel',async()=>{
  const h=harness();h.channel.id='unrelated';
  await assert.rejects(h.call(),/VVIP panel channel/);assert.equal(h.counts.sends,0);
});
