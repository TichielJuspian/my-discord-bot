const test=require('node:test'),assert=require('node:assert/strict');
const {finishBattle}=require('./raid-finish-battle');
for(const status of ['retreated','exhausted','victory'])test('close and refresh once: '+status,async()=>{
 let closed=0,refreshed=0;const a={state:{status,totals:{damage:1690}}};
 const i={deleteReply:async()=>{closed++}};
 await Promise.all([finishBattle(i,a,async()=>{refreshed++}),finishBattle(i,a,async()=>{refreshed++})]);
 assert.equal(closed,1);assert.equal(refreshed,1);assert.equal(a.finished,true);
});
test('delete failure replaces battle with result without buttons or attachments',async()=>{
 let body;await finishBattle({deleteReply:async()=>{throw Error('network')},editReply:async b=>{body=b}}, {state:{totals:{damage:42}}});
 assert.deepEqual(body.attachments,[]);assert.equal(body.components.length,1);assert.match(body.components[0].content,/42/);
});
test('ranking display failure does not leave battle open',async()=>{
 let closed=false;const r=await finishBattle({deleteReply:async()=>{closed=true}}, {state:{totals:{damage:42}}},async()=>{throw Error('offline')});assert.equal(closed,true);assert.equal(r[1].status,'rejected');
});
