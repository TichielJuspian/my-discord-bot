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
function incomingOutcome(log,hit,pattern){
 if(hit?.evaded===true||!hit&&(log?.emergencyEvaded||log?.evaded===true||log?.evades>0&&(!log.hits||log.evades>=log.hits)))return 'miss';
 const kind=hit?.kind??pattern?.kind;
 if(kind==='G')return undefined; // Unavoidable mechanic: Tackle/Guard cannot turn it into BLOCK.
 const action=log?.action,type=hit?.type??pattern?.type,isParry=action==='parry'||action==='magic_parry';
 const matched=type===undefined?!hit:(action==='guard'||action==='parry')?type==='physical':(action==='magic_guard'||action==='magic_parry')?type==='magic':false;
 const parry=hit?hit.parryResult:log?.parryResult;
 if(isParry&&matched&&['success','perfect'].includes(parry))return 'block';
 if(matched&&['guard','magic_guard'].includes(action)&&log?.matched===true&&log.guardReduction>0)return 'block';
 if(['shoulder_tackle','tackle'].includes(action)&&log?.tackle===true&&(kind==='N'||kind==='H'||!hit&&kind===undefined)&&log.blocked>0)return 'block';
 return undefined;
}
function names(values,state){
 return [...new Set(values||[])].map(name=>Profile.gainedEffect(name==='Thrust Defense'?'Defense Up':name,state).iconKey).filter(Boolean);
}
const CONTRACT_COPY=Object.freeze({
 offer:'Give me a taste of your vitality, and I’ll give you a night you’ll never recover from',
 signed:'Thanks for signing away your stamina... it tastes divine',
 refused:"Fine, keep your pathetic strength—I'll just take it by force later.",
 third:'Whatever! Be stubborn then! I just cursed you to feel everything twice as hard—and not in the fun way!'
});
const signedPct=x=>(x>0?'+':'−')+Number((Math.abs(x)*100).toFixed(2))+'%';
function contractDisplay(frame){
 if(frame.kind==='contract')return {speaker:'Succubus',line:CONTRACT_COPY.offer,effects:[]};
 const e=frame.lastTurn||{},c=e.contract;
 if(frame.kind!=='contract_result'||e.event!=='contract'||!c)return null;
 const choice=frame.choice??c.choice,refusals=amount(frame.refusals??e.refusals),instant=[],buff=[],debuff=[];
 const add=(dst,kind,text)=>dst.push({kind,text});
 const duration=amount(c.remaining), turns=count=>count?' · '+count+' turns':'';
 if(amount(c.heal))add(instant,'benefit','HP +'+amount(c.heal));
 if(amount(c.hpLoss))add(instant,'harm','HP -'+amount(c.hpLoss));
 if(amount(c.energyCost))add(instant,'harm','Energy -'+amount(c.energyCost));
 const timed=(label,value,good)=>{if(duration&&Number.isFinite(value)&&value!==0)add(good?buff:debuff,good?'benefit':'harm',label+' '+signedPct(value)+turns(duration));};
 timed('ATK',c.attack,c.attack>0);timed('DEF',c.defense,c.defense>0);
 timed('Damage dealt',c.outgoing,c.outgoing>0);timed('Damage taken',c.incoming,c.incoming<0);timed('Lifesteal',c.lifesteal,c.lifesteal>0);
 if(duration&&Number.isFinite(c.energyMultiplier)&&c.energyMultiplier>1)add(debuff,'harm','Energy cost ×'+c.energyMultiplier+turns(duration));
 if(amount(c.charm))add(debuff,'harm','Charm'+turns(amount(c.charm)));
 const pen=frame.state?.contractPenalty;
 if(e.newPenalty&&pen?.multiplier>1){const when=pen.startTurn>frame.state.turn?' from next turn':'';add(debuff,'harm','Damage taken '+signedPct(pen.multiplier-1)+turns(amount(pen.turns))+when);}
 return {speaker:'Succubus',line:choice==='yes'?CONTRACT_COPY.signed:refusals===3?CONTRACT_COPY.third:CONTRACT_COPY.refused,...(choice==='no'?{refusals}:{}),effects:[...instant,...buff,...debuff]};
}
function contractDescription(c){return c?[c.speaker+': '+c.line,...c.effects.map(e=>e.text),c.refusals!==undefined?'Refusal: '+c.refusals+'/3':null].filter(Boolean).join('\n'):null;}
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
  const damage=amount(r?.amount??(multi?0:def.incoming)),outcome=r||!multi?incomingOutcome(def,r?.hit,e.pattern??frame.pattern):undefined;
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
 const contract=contractDisplay(frame);
 if(contract){out.contract=contract;delete out.heal;delete out.gain;}
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
module.exports={annotate,overlayFor,forLegacy,contractDisplay,contractDescription};


