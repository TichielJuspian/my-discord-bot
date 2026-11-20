const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
const DEFINITIONS={protection:{level:60,label:'Protection',hp:30},rally:{level:70,label:'Battle Rally',attack:.1},blessing:{level:80,label:'Blessing',crit:10,critDamage:10}};
const DURATION=3*60*60*1000;
const CAPS={protection:5,rally:3,blessing:1};
function create({clock=Date.now,raidId,isComplete=()=>false}){
 const casts=new Map();
 function cast({casterId,casterName,level,kind}){
  const def=DEFINITIONS[kind];if(!def||!casterId||!Number.isInteger(level)||level<def.level||level>100)throw Error('Required level not reached');
  const live=active(),own=live.find(e=>e.casterId===casterId);
  if(own)return {event:own,fresh:false,reason:'already_active',retryAt:own.expiresAt};
  const same=live.filter(e=>e.kind===kind);
  if(same.length>=CAPS[kind])return {fresh:false,reason:'stack_limit',retryAt:Math.min(...same.map(e=>e.expiresAt))};
  const key=casterId+':'+kind,now=clock(),event={id:raidId+':'+key+':'+now,raidId,casterId,casterName,level,kind,startsAt:now,expiresAt:now+DURATION,committed:true};casts.set(key,event);return {event,fresh:true};
 }
 const active=()=>[...casts.values()].filter(e=>e.expiresAt>clock());
 function apply(original){
  const s=structuredClone(original),base=s.sharedBaseline??={hp:s.baseHP,attack:s.boosterBaseAttack??s.stats.attack,crit:s.stats.crit,critDamage:s.stats.critDamagePercent||0};
  const sum={hp:0,attack:0,crit:0,critDamage:0};for(const e of active())for(const k of Object.keys(sum))sum[k]+=DEFINITIONS[e.kind][k]||0;
  const max=base.hp+sum.hp;s.hp=Math.min(max,s.hp+Math.max(0,max-s.stats.hp));s.stats.hp=max;s.baseHP=max;
  s.stats.attack=require('./raid-booster.js').attack(base.attack,s.boosterCount||0,sum.attack);s.stats.crit=base.crit+sum.crit;s.stats.critDamagePercent=base.critDamage+sum.critDamage;
  s.sharedBuffEffects={...sum};
  return s;
 }
 return {cast,active,apply,snapshot:()=>active(),restore:events=>{
  casts.clear();
  // Legacy casts keep their original start time; a restart never renews a buff.
  for(const e of [...(events||[])].sort((a,b)=>a.startsAt-b.startsAt)){
   if(!DEFINITIONS[e.kind]||e.raidId!==raidId||!Number.isSafeInteger(e.startsAt))continue;
   const expiresAt=e.startsAt+DURATION,live=active();
   if(expiresAt<=clock()||live.some(x=>x.casterId===e.casterId)||live.filter(x=>x.kind===e.kind).length>=CAPS[e.kind])continue;
   casts.set(e.casterId+':'+e.kind,{...e,expiresAt});
  }
 },used:(user,kind)=>active().some(e=>e.casterId===user&&(!kind||e.kind===kind))};
}
module.exports={create,DEFINITIONS,DURATION,CAPS};
