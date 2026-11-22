'use strict';
// Projection only. Every read is from an already-committed combat receipt/snapshot.
const Last=require('./last-turn.cjs');
const Profile=require('../../서큐버스/succubus-presentation.cjs');
const amount=v=>Number.isFinite(v)&&v>0?Math.floor(v):0;
const finalHit=f=>f.kind!=='boss_attack'||!Array.isArray(f.lastTurn?.hits)||f.hitIndex>=f.lastTurn.hits.length;
const ATTACK=new Set(['reaction','ultimate_hit','cancelled']);
const ACTUAL=new Set([...ATTACK,'support','boss_attack','gimmick_release','contract_result']);
const applied=(log)=>Array.isArray(log?.energyEntries)?log.energyEntries.reduce((sum,e)=>sum+amount(e.applied),0):0;
function annotate(frames,before) {
 let healBefore=amount(before?.totals?.healing),energyBefore=before?.energy,gainRound=0;
 return frames.map(f=>{
  const healAfter=amount(f.state?.totals?.healing),energyAfter=f.state?.energy;
  const current={};
  if(ACTUAL.has(f.kind)&&finalHit(f)){
   const heal=Math.max(0,healAfter-healBefore);
   if(heal)current.heal=heal;
   healBefore=healAfter;
  }
  if(f.kind==='enrage'||f.kind==='idle'){
   if(Number.isFinite(energyBefore)&&Number.isFinite(energyAfter))gainRound+=amount(energyAfter-energyBefore);
   if(f.kind==='idle'&&gainRound){current.gain=gainRound;gainRound=0;}
  }
  energyBefore=energyAfter;
  return Object.keys(current).length?{...f,twoPieceReceipts:current}:f;
 });
}
function incomingOutcome(log,hit){
 if(hit?.evaded===true||log?.emergencyEvaded||log?.evaded===true||log?.evades>0&&(!log.hits||log.evades>=log.hits)&&!hit)return 'miss';
 const parry=hit?.parryResult||log?.parryResult;
 if(parry==='perfect')return 'perfect_parry';
 if(parry==='success')return 'parry';
 if((log?.matched===true||log?.tackle===true)&&(log?.blocked>0||log?.guardReduction>0))return 'block';
 return undefined;
}
function names(values,state){
 return [...new Set(values||[])].map(name=>Profile.gainedEffect(name==='Thrust Defense'?'Defense Up':name,state).iconKey).filter(Boolean);
}
function overlayFor(frame,{gauge,cinematic=false}={}){
 const e=frame.lastTurn||{},log=e.log||frame.log||{},def=log.defenseLog||log,atk=log.attackLog||log;
 const f=frame.kind,s=frame.state,done=finalHit(frame),one=frame.twoPieceReceipts||{};
 const out={turn:s.turn,phase:Last.turnLabel(frame)==='Defense Turn'?'defense':'attack',totalDamage:amount(s.totals?.damage),cinematic};
 if(ATTACK.has(f)&&!atk.charmBlocked){
  const r=Last.receiptAt(e.outgoingHits,e.outgoingHitIndex,'damage'),damage=amount(r?.amount??atk.damage),reaction=e.reaction||frame.reaction||atk.reaction;
  if(damage||reaction==='evade'||reaction==='guard'){
   out.outgoing={damage,critical:damage>0&&(r?.hit?.critical??atk.critical)===true,...(reaction==='evade'?{outcome:'miss'}:reaction==='guard'?{outcome:'block'}:{})};
  }
  // When supplied with one true frame per outgoing hit, don't show any future hit's damage.
  if(r&&!r.final)out.totalDamage=Math.max(0,out.totalDamage-e.outgoingHits.slice(r.index).reduce((n,h)=>n+amount(h.damage),0));
 }
 if(f==='boss_attack'||f==='gimmick_release'){
  const r=Last.receiptAt(e.hits,f==='boss_attack'?frame.hitIndex:1);
  const multi=f==="boss_attack"&&e.pattern?.kind==="N"&&e.pattern?.hits>1;
  const damage=amount(r?.amount??(multi?0:def.incoming)),outcome=r||!multi?incomingOutcome(def,r?.hit):undefined;
  if(damage||outcome)out.incoming={damage,...(outcome?{outcome}:{}),...(f==='gimmick_release'&&e.event==='gimmick_release'&&damage>0?{mechanicFailed:true}:{})};
 }else if(f==='evaded')out.incoming={damage:0,outcome:'miss'};
 if(f==='curse_release'&&e.event==='curse_release'&&e.curseLanded===true)out.curse={released:true,landed:true};
 if((f==='prep'||f==='gimmick_a'||f==='gimmick_b')&&frame.pattern?.kind==='C')out.curse={casting:true};
 if(f==='curse_interrupted'&&e.event==='curse_interrupted')out.curse={interrupted:true};
 if(f==='gimmick_success'&&e.event==='gimmick_success')out.mechanicInterrupted=true;
 if(gauge)out.break={hits:gauge.hits,required:gauge.required};
 const onAction=(ATTACK.has(f)||f==='support')&&!atk.charmBlocked;
 const onDefense=(f==='boss_attack'||f==='gimmick_release')&&done;
 const gain=amount(one.gain)+(onAction?applied(atk):onDefense?applied(def):0);
 if(gain&&!cinematic)out.gain=gain;
 if(amount(one.heal)&&!cinematic)out.heal=amount(one.heal);
 if(onAction||onDefense){const buffs=names(e.buffs,s);if(buffs.length)out.buffs=buffs;}
 if(out.curse?.landed)out.debuffs=['succubus.charm'];
 if(f==='contract_result'&&e.event==='contract'){
  const c=e.contract,fx=[];
  if(c?.charm>0)fx.push('succubus.charm');
  if(c?.outgoing<0||c?.incoming>0)fx.push('succubus.devils_contract');
  if(e.newPenalty)fx.push('succubus.contract_vulnerability');
  if(fx.length)out.debuffs=fx;
 }
 return out;
}
function forLegacy(a,phase,cinematic=false){
 const s=a.state,l=s.log.at(-1)||{},result=!!a.twoPieceLegacy||!!a.cutsceneResult&&!a.motionStage;
 const out={turn:result?(l.turn??s.turn):s.turn,phase:['opening','idle'].includes(result?l.phase:phase)?'attack':'defense',totalDamage:amount(s.totals?.damage),cinematic};
 if(!result)return out;
 const damage=amount(l.damage),mechanic=amount(l.mechanicDamage),incoming=mechanic||amount(l.incoming),outcome=incomingOutcome(l),reaction=l.bossEvaded?'miss':l.bossGuarded?'block':undefined;
 if(damage||reaction)out.outgoing={damage,critical:damage>0&&l.critical===true,...(reaction?{outcome:reaction}:{})};
 if(incoming||outcome)out.incoming={damage:incoming,...(outcome?{outcome}:{}),...(amount(l.mechanicDamage)&&incoming>0?{mechanicFailed:true}:{})};
 if(l.charmApplied===true&&l.curseInterruptedNow!==true&&!l.emergencyEvaded){out.curse={released:true,landed:true};out.debuffs=['succubus.charm'];}
 if(l.curseInterruptedNow)out.curse={interrupted:true};
 if(l.shockwaveInterrupted)out.mechanicInterrupted=true;
 const g=applied(l);
 if(g&&!cinematic)out.gain=g;
 if(!cinematic){
  const heal=a.twoPieceLegacy?amount(a.twoPieceLegacy.heal):amount(l.heal)+amount(l.paladin?.divineHeal)+amount(l.paladin?.smiteHeal)+amount(l.warrior?.thrustHeal??l.warrior?.sixthSenseHeal)+amount(l.berserker?.lifesteal);
  if(heal)out.heal=heal;
 }
 return out;
}
module.exports={annotate,overlayFor,forLegacy};


