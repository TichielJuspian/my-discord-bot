'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const registry=require('../raid-boss-registry');
const scheduler=require('../raid-scheduler');
const health=require('../raid-boss-health');
const R=require('../raid-engine/progression-combat.cjs');
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const enabled=['earth','nameless_succubus'];

test('only the two existing, fully ready bosses appear in production rotation',()=>{
 assert.deepEqual(registry.enabledBosses().map(b=>b.id),enabled);
 assert.deepEqual(registry.rotationBosses().map(b=>b.id),enabled);
 assert.deepEqual([...scheduler.BOSS_POOL],enabled);
 assert.deepEqual(registry.assertRuntimeReady({combatBosses:R.BOSSES}),enabled);
 assert.equal(Object.isFrozen(registry.bosses),true);
 assert.equal(Object.isFrozen(registry.get('earth').lobbyArt),true);
});

test('Icy Dragon is metadata-only, does not register buttons, and cannot start a battle',()=>{
 const dragon=registry.get('icy_dragon');
 assert.equal(dragon.name,'Icy Dragon');
 assert.equal(dragon.enabled,false);
 assert.equal(dragon.autoRotation,false);
 assert.equal(registry.byTestCommand('icy_dragon'),null);
 assert.throws(()=>registry.requireEnabled('icy_dragon'),/not enabled/);
 assert.throws(()=>registry.lobbyVisual('icy_dragon'),/not enabled/);
 assert.throws(()=>health.maximum('icy_dragon'),/not enabled/);
 assert.throws(()=>require('../raid-lobby').createLobby({boss:'icy_dragon'}),/not enabled/);
 assert.throws(()=>health.maximum('not_a_boss'),/not enabled/);
});

test('legacy boss identifiers, private data filenames, and command schema are preserved',()=>{
 assert.equal(registry.storageFile('/data/raid-beta-lobby.json','earth'),'/data/raid-beta-lobby.json');
 assert.equal(registry.storageFile('/data/raid-beta-lobby.json','nameless_succubus'),'/data/raid-beta-lobby-succubus.json');
 assert.equal(registry.storageFile(null,'earth'),null);
 assert.equal(registry.byTestCommand('colossus').id,'earth');
 assert.equal(registry.byTestCommand('succubus').id,'nameless_succubus');
 assert.deepEqual(registry.enabledBosses().map(b=>({type:1,...b.testCommand})),[
  {type:1,name:'colossus',description:'Reset all beta raids and create a fresh Colossus lobby'},
  {type:1,name:'succubus',description:'Reset all beta raids and create a fresh Succubus lobby'},
 ]);
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'gosu-boss-command-'));
 try{
  const controller=require('../raid-test').createRaidTest({guildId:'g',ownerId:'o',renderBattle:false,lobbyStorageFile:path.join(cwd,'lobby.json'),characterStorageFile:path.join(cwd,'characters.json'),schedulerStorageFile:path.join(cwd,'schedule.json')});
  const command=controller.commands.find(c=>c.toJSON().name==='raidtest').toJSON();
  assert.deepEqual(command.options,[
   {type:1,name:'colossus',description:'Reset all beta raids and create a fresh Colossus lobby'},
   {type:1,name:'succubus',description:'Reset all beta raids and create a fresh Succubus lobby'}]);
 }finally{fs.rmSync(cwd,{recursive:true,force:true});}
});

test('legacy health migration matches the original 50k and 60k boss baselines',()=>{
 assert.equal(health.maximum('earth'),400000);
 assert.equal(health.maximum('nameless_succubus'),400000);
 assert.equal(health.restoreRemaining({hp:25000},'earth'),375000);
 assert.equal(health.restoreRemaining({hp:30000},'nameless_succubus'),370000);
 assert.equal(health.restoreRemaining({hp:0},'earth'),0);
 assert.equal(health.restoreRemaining({hp:200000,maxHP:400000},'earth'),200000);
});

test('scheduled alternative selection never repeats the previous boss (2 or 3 candidates)',()=>{
 assert.equal(scheduler.chooseDifferent('earth',enabled,()=>0),'nameless_succubus');
 assert.equal(scheduler.chooseDifferent('nameless_succubus',enabled,()=>0),'earth');
 const future=['earth','nameless_succubus','icy_dragon'];
 assert.equal(scheduler.chooseDifferent('earth',future,()=>0),'nameless_succubus');
 assert.equal(scheduler.chooseDifferent('earth',future,()=>1),'icy_dragon');
 assert.equal(scheduler.chooseDifferent('icy_dragon',future,()=>0),'earth');
 assert.throws(()=>scheduler.chooseDifferent('earth',['earth'],()=>0),/No alternative/);
 assert.throws(()=>scheduler.chooseDifferent('earth',enabled,()=>42),/Invalid boss selection/);
});

test('scheduler fails closed when a configured active boss lobby is missing',()=>{
 assert.throws(()=>scheduler.createRaidScheduler({stateFile:'/tmp/gosu-unused-schedule.json',lobbies:new Map([['earth',{}]]),guildId:'g',ownerId:'o'}),/missing an enabled boss lobby/);
});

test('startup validation refuses a missing combat implementation or missing artwork',()=>{
 assert.throws(()=>registry.assertRuntimeReady({combatBosses:{earth:R.BOSSES.earth}}),/combat engine/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'gosu-boss-asset-check-'));
 try {assert.throws(()=>registry.assertRuntimeReady({combatBosses:R.BOSSES,rootDir:root}),/asset missing/);} finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('raid lobby attachment names, boss names and existing click ids remain unchanged',()=>{
 for(const boss of enabled){
  const lobby=require('../raid-lobby').createLobby({boss,clock:()=>1700000000000,storageFile:null});
  const b=lobby.body(true),visual=registry.lobbyVisual(boss);
  assert.deepEqual(b.components[0],{type:12,items:[{media:{url:'attachment://'+visual.uploadName},description:visual.description}]});
  assert.deepEqual(b.files.map(f=>f.name),['raid-rankings-0.png','raid-rankings-1.png','raid-rankings-2.png','raid-rankings-3.png','raid-rankings-4.png','raid-lobby-status.png','raid-recent-battles.png',visual.uploadName]);
  const components=JSON.stringify(b.components);
  assert.match(components,/raidtest:lobby:1700000000000:join/);
  assert.match(components,/raidtest:lobby:1700000000000:count/);
  assert.equal(path.basename(b.files.at(-1).attachment),path.basename(visual.file));
  assert.equal(fs.existsSync(b.files.at(-1).attachment),true);
 }
 assert.equal(registry.lobbyVisual('earth',true).file,'boss-defeated-v5-discord.jpg');
 assert.equal(registry.lobbyVisual('nameless_succubus',true).file,'nameless-succubus-assets-v1/reaction-defeated.jpg');
 assert.equal(registry.lobbyVisual('earth',true).uploadName,'boss-surrendered.jpg');
});

test('existing lobby health images and neutral rules cards retain their exact baseline bytes',()=>{
 const expected={
  earth:{card:'eacdc019aefa4773d3c2e481a5c3c7b7915aca130f247877d189e46aab77adf4',rules:'3be7b0bdfdd0cc25021244569b08645806809c50ea58563aa24e6dc7bcc7e066'},
  nameless_succubus:{card:'170f26d63bd27384c23f20965250478b4e33dafeb452ffae0f5997917fdfb31a',rules:'31eeacf9ad69ca725beb0f91436c62b0f1c5cd76e34e7330cc9265abbe224ee2'},
 };
 for(const boss of enabled){
  const card=require('../raid-lobby-card').asset({boss,hp:200000});
  const rules=require('../raid-rules-card').asset({boss,job:'warrior',neutral:true});
  assert.equal(sha256(card.attachment),expected[boss].card,boss+' lobby art changed');
  assert.equal(sha256(rules.attachment),expected[boss].rules,boss+' rules art changed');
 }
});

test('battle illustration delegates to each existing boss provider without changing its initial image',()=>{
 const build=require('../raid-test-build');
 const panel=require('../raid-panels');
 for(const boss of enabled){
  const s=R.create(build.config('warrior',1,0,boss),1);
  const expected=boss==='earth'?'colossus-ready-v55.jpg':'nameless-succubus-assets-v1/normal-idle.jpg';
  const art=panel.bossArt(s);
  assert.ok(Array.isArray(art));
  assert.equal(art[0],expected);
 }
});
