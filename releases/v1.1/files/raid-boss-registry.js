'use strict';
// Boss catalog is metadata only. Never import Discord, MongoDB, or start jobs here.
// Existing ids and storage suffixes are permanent: changing them can orphan raid journals.
const fs = require('node:fs');
const path = require('node:path');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const bosses = deepFreeze([
  {
    id: 'earth', name: 'Earth Colossus', title: 'EARTH COLOSSUS', leaderboardName: 'Colossus', shortName: 'Colossus',
    enabled: true, autoRotation: true, worldHP: 400000, legacyHP: 50000, storageSuffix: '',
    testCommand: {name:'colossus', description:'Reset all beta raids and create a fresh Colossus lobby'},
    artModule: './raid-colossus-art', readyArt: {file:'colossus-ready-v55.jpg', description:'BATTLE READY / Earth Colossus awaits the challenger'},
    lobbyArt: {entrance:'boss-entrance-static.jpg', defeated:'boss-defeated-v5-discord.jpg'},
    lobbyColors: {fog:'#345660', rune:'#b6a471'},
  },
  {
    id: 'nameless_succubus', name: 'Nameless Succubus', title: 'NAMELESS SUCCUBUS', leaderboardName: 'Nameless Succubus', shortName: 'Succubus',
    enabled: true, autoRotation: true, worldHP: 400000, legacyHP: 60000, storageSuffix: '-succubus',
    testCommand: {name:'succubus', description:'Reset all beta raids and create a fresh Succubus lobby'},
    artModule: './raid-succubus', readyArt: null,
    lobbyArt: {entrance:'succubus-entrance-static.jpg', defeated:'nameless-succubus-assets-v1/reaction-defeated.jpg'},
    lobbyColors: {fog:'#801c3e', rune:'#da688b'},
  },
  {
    // Staged concept only. The memory-seal Discord puzzle, engine, art, and tests are NOT implemented.
    // Never enable until the complete implementation passes validation and live staging tests.
    id: 'icy_dragon', name: 'Icy Dragon', title: 'ICY DRAGON', leaderboardName: 'Icy Dragon', shortName: 'Icy Dragon',
    enabled: false, autoRotation: false, worldHP: null, legacyHP: null, storageSuffix: '-icy-dragon',
    testCommand: {name:'icy_dragon', description:'Reset all beta raids and create a fresh Icy Dragon lobby'},
    artModule: null, readyArt: null,
    lobbyArt: {entrance:null, defeated:null},
    lobbyColors: {fog:'#385c80', rune:'#9ccdeb'},
  },
]);
const byId = new Map(bosses.map(b => [b.id, b]));
function get(id) { return byId.get(id) || null; }
function requireEnabled(id) {
  const boss = get(id);
  if (!boss || !boss.enabled) throw Error(`Raid boss is not enabled: ${String(id)}`);
  return boss;
}
function enabledBosses() { return bosses.filter(b=>b.enabled); }
function rotationBosses() { return enabledBosses().filter(b=>b.autoRotation); }
function byTestCommand(command) { return enabledBosses().find(b=>b.testCommand?.name===command) || null; }
function storageFile(baseFile, bossId) {
  if (!baseFile) return null;
  const suffix=requireEnabled(bossId).storageSuffix;
  return suffix ? baseFile.replace(/\.json$/, '')+suffix+'.json' : baseFile;
}
function lobbyVisual(bossId, defeated=false) {
  const b=requireEnabled(bossId);
  return {
    file: defeated?b.lobbyArt.defeated:b.lobbyArt.entrance,
    uploadName: defeated?'boss-surrendered.jpg':b.lobbyArt.entrance,
    description: (defeated?'BOSS SURRENDERED / RAID COMPLETE / ':'WARNING / BOSS APPEARS / ')+b.title,
  };
}
// Fail-closed readiness check: adding catalog metadata cannot silently activate a broken boss.
function assertRuntimeReady({combatBosses, rootDir=__dirname}={}) {
  const active=enabledBosses();
  if (rotationBosses().length<2) throw Error('Automatic raid rotation requires at least two enabled bosses.');
  const seenTest=new Set(),seenSuffix=new Set();
  for (const b of bosses) {
    if (!/^[a-z][a-z0-9_]*$/.test(b.id)) throw Error('Invalid boss id: '+b.id);
    if (!b.enabled) continue;
    if (!Number.isSafeInteger(b.worldHP)||b.worldHP<1) throw Error('Missing boss HP: '+b.id);
    if (!Number.isSafeInteger(b.legacyHP)||b.legacyHP<1) throw Error('Missing legacy HP: '+b.id);
    if (seenTest.has(b.testCommand.name)||seenSuffix.has(b.storageSuffix))throw Error('Duplicate boss command or storage suffix: '+b.id);
    seenTest.add(b.testCommand.name);seenSuffix.add(b.storageSuffix);
    if (combatBosses && !Object.hasOwn(combatBosses,b.id)) throw Error('Boss missing in combat engine: '+b.id);
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(b.testCommand?.name||''))throw Error('Invalid raid test command: '+b.id);
    if (!b.lobbyArt?.entrance || !b.lobbyArt?.defeated)throw Error('Incomplete boss lobby art: '+b.id);
    const required=[b.lobbyArt.entrance,b.lobbyArt.defeated,b.readyArt?.file];
    for (const file of required.filter(Boolean)) {
      if (!fs.existsSync(path.join(rootDir,file))) throw Error('Boss asset missing: '+b.id+' / '+file);
    }
    if (!b.artModule) throw Error('Boss art provider missing: '+b.id);
    const providerPath=path.join(rootDir,b.artModule);
    try { require.resolve(providerPath); } catch { throw Error('Boss art module missing: '+b.id+' / '+b.artModule); }
    if (rootDir===__dirname && typeof require(providerPath).art!=='function')throw Error('Boss art module lacks art(): '+b.id);
  }
  return active.map(b=>b.id);
}
module.exports={bosses,get,requireEnabled,enabledBosses,rotationBosses,byTestCommand,storageFile,lobbyVisual,assertRuntimeReady};
