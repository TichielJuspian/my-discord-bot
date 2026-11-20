const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
// Pure domain model. Production must authenticate level/user and persist casts atomically.
const DURATION = 2 * 60 * 60 * 1000;
const REQUIRED = {blessing:70, rally:80};
function day(now) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)); }
function cast(ledger, {userId,level,kind,now,raidId}) {
  if (!userId || !raidId || !Number.isSafeInteger(now) || !Number.isInteger(level) || level>100 || !(kind in REQUIRED) || level<REQUIRED[kind]) throw Error('Invalid cooperative cast');
  if (ledger.some(x=>x.userId===userId && x.day===day(now))) throw Error('One cooperative skill per Pacific day');
  return [...ledger,{userId,kind,raidId,day:day(now),startsAt:now,expiresAt:now+DURATION}];
}
function effects(ledger,raidId,now) {
  const unique=new Map();
  for(const x of ledger) if(x.raidId===raidId && x.startsAt<=now && now<x.expiresAt) unique.set(x.userId,x);
  const count=kind=>[...unique.values()].filter(x=>x.kind===kind).length;
  // Cooperative Curse removed; old records have no effect.
  return {curses:0,damageReduction:0,hpBonus:.05*count('blessing'),attackBonus:.1*count('rally'),stun:0,blind:0,confusion:0,fortune:0};
}
module.exports={DURATION,REQUIRED,day,cast,effects};
