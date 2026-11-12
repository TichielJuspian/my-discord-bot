'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Fake character storage intentionally prevents reading/writing any actual account or raid file.
function loadWithFakes(characters,db){
  const filename=path.resolve(__dirname,'../raid-workshop-store.js');
  const code=fs.readFileSync(filename,'utf8');
  const box={exports:{}};
  const nativeRequire=require;
  const fakeRequire=id=>id==='./raid-characters'?{createStore:()=>characters}:nativeRequire(id);
  vm.runInNewContext(code,{
    module:box,require:fakeRequire,console,__dirname:path.dirname(filename),
  },{filename,timeout:2000});
  box.exports.bindDatabase(db);
  return box.exports;
}
function fakeDb(onRead=async()=>null){return {collection(name){assert.equal(name,'community_points');return {findOne:onRead};}};}

test('failed maintenance remains fail-closed until an explicit successful retry',async()=>{
  let first=true, reads=0;
  const chars={
    beginTestReset(){if(first){first=false;throw Error('transient reset failure');}return [];},
    finishTestReset(){},
    workshopRead(g,u,level){reads++;return {g,u,level,healthy:true};},
  };
  const api=loadWithFakes(chars,fakeDb());
  await assert.rejects(api.resetTestProgress({}),/transient reset failure/);
  await assert.rejects(api.read('g','u',42),/transient reset failure/,'do not read possibly inconsistent player state');
  assert.equal(reads,0);
  assert.equal((await api.resetTestProgress({})).accounts,0,'an explicit reset retry must be allowed to recover');
  assert.equal((await api.read('g','u',42)).healthy,true,'successful reset retry releases the gate');
  assert.equal(reads,1);
});

test('two test resets cannot execute concurrently',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);let markEntered;
  const entered=new Promise(resolve=>markEntered=resolve);
  let starts=0,done=0,reads=0;
  const chars={beginTestReset(){starts++;return ['g:u'];},resetTestProgress(){return {refund:0,returned:0};},finishTestReset(){done++;}};
  const api=loadWithFakes(chars,fakeDb(async()=>{reads++;if(reads===1){markEntered();await gate;}return null;}));
  const first=api.resetTestProgress({});
  await entered;
  const second=api.resetTestProgress({});
  try{assert.equal(starts,1,'second reset should wait for first to finish');}
  finally{release();}
  const results=await Promise.all([first,second]);
  assert.equal(done,2);
  assert.deepEqual(results.map(x=>x.accounts),[1,1]);
});
