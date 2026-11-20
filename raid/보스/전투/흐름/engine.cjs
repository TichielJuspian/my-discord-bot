const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const Rules=require('./rules.cjs'),Runtime=require('./state-runtime.cjs');
function createEngine({combat,build={},contractPolicy=Rules.CONTRACT_POLICY,patternChoice=null,initialState=null,runtime=null}={}){
 if(!combat)throw new TypeError('Combat adapter required');
 if(runtime&&!initialState)throw TypeError('Runtime import requires its combat state');
 let mode=initialState?'live':'isolated';
 let s=initialState?(runtime?Runtime.validateState(Runtime.clone(initialState)):Runtime.prepare(initialState)):combat.create(build),pattern=null,frames=[],started=false;
 let completed=0,readyAt={},guarantee=false,gimmickSkills=0,lastTurn=null,dealtTurn=-1,dealtHits=[];
 if(initialState){const job=combat.attackActions?.includes('charge')?'berserker':combat.attackActions?.includes('smash')?'paladin':'warrior';if(s.config.job!==job)throw TypeError('Combat adapter does not match state class');}
 if(runtime){const saved=Runtime.validateRuntime(s,runtime);({mode,pattern,frames,started,completed,readyAt,guarantee,gimmickSkills,contractPolicy}=saved);lastTurn=saved.lastTurn||null;dealtTurn=saved.dealtTurn??-1;dealtHits=saved.dealtHits||[];}

 const phaseAttack=()=>['idle','ultimate_bonus','stagger_a','stagger_b','ragnarok_b','ragnarok_a','ragnarok_defense_a'].includes(s.phase);
 const active=()=>s.status==='active';
 const state=()=>structuredClone(s);
 function frame(kind,interactive=false,extra={}){const delayMs=['ultimate_hit','boss_attack','gimmick_release','curse_release','curse_interrupted','gimmick_success','cancelled','evaded','enrage'].includes(kind)?500:0;frames.push({kind,interactive,delayMs,state:state(),lastTurn:lastTurn?structuredClone(lastTurn):null,log:s.log.at(-1)?structuredClone(s.log.at(-1)):undefined,...(interactive?{characterPose:'idle'}:{}),...extra});}
 // Display-only event metadata: never add synthetic entries to the combat log.
 function buffs(){return {...(combat.presentationBuffs?.(s)||{}),thrustDefense:s.thrustDefenseTurns>0?s.thrustDefense||0:0,...Object.fromEntries(['sharpEye','sixthSense','bladerFocus','hone','overheatTurns','thrustDefenseTurns','protectionTurns','smiteBlessingStacks','paladinBlessing','berserkerCharge','berserkerBloodEnergy','tackleDefenseTurns'].map(k=>[k,s[k]||0]))};}
 function gained(before){const after=buffs(),out=[];for(const [key,name]of [['sharpEye','Sharp Eye'],['sixthSense','Sixth Sense'],['hone','Hone'],['bladerFocus','Focus'],['smiteBlessingStacks','Blessing'],['overheatTurns','BLADE TRANCE'],['thrustDefenseTurns','Thrust Defense'],['thrustDefense','Thrust Defense'],['enrage','Enrage'],['protectionTurns','Blessing'],['paladinBlessing','Divine Punishment'],['berserkerCharge','Charge'],['berserkerBloodEnergy','Blood Draw'],['tackleDefenseTurns','Tackle Defense']])if(Number(after[key])>Number(before[key]||0))out.push(name);return [...new Set(out)];}
 function remember(log,event,extra={}){lastTurn={event,log:structuredClone(log),pattern:pattern?structuredClone(pattern):null,...extra};}
 function chosen(action,current){return {turn:s.turn,phase:current,action,damage:0,incoming:0,energyStart:s.energy,energyEnd:s.energy};}
 function setPhase(p){s.phase=p;}
 function idle(){setPhase('transition');Rules.beginIdle(s);combat.beginRound(s);frame('idle',true);}
 function closeRound(){
  combat.endRound(s);completed++;s.director.combatActions=completed;
  if(pattern)readyAt[pattern.kind]=completed+combat.cooldown(s,pattern.kind);
  pattern=null;gimmickSkills=0;s.gimmickHits=0;
  if(!active()){setPhase('ended');frame('ended');return;}
  // A displayed mechanic is completed before an enrage threshold can alter its sequence.
  if(!guarantee&&combat.due(s)){combat.enter(s);s.director.stageStart=s.turn+1;s.director.stageTurnStart=s.turn+1;guarantee=true;setPhase('enrage');frame('enrage');}
  idle();
 }
 function selectPattern(){
  const keys=['N','H','C','G','S'],weights=combat.weights(s);
  const pool=keys.map((key,i)=>({key,weight:weights[i]})).filter(x=>x.weight>0&&completed>=(readyAt[x.key]||0)&&(x.key!=='S'||!s.offerEffects?.remaining));
  let kind;
  if(guarantee)kind='S';else if(patternChoice)kind=patternChoice(state());else{let n=combat.roll(s)*pool.reduce((a,x)=>a+x.weight,0);kind=pool.at(-1).key;for(const x of pool){n-=x.weight;if(n<0){kind=x.key;break;}}}
  if(!keys.includes(kind))throw new Error('Invalid pattern');
  pattern={kind,type:kind==='N'?'physical':['H','G'].includes(kind)?'magic':kind==='C'?'status':'special',stage:combat.stage(s)};
  if(kind==='G'){pattern.required=2;s.gimmickRequired=pattern.required;}
  if(kind==='N')pattern.hits=Rules.comboHits(['normal','enrage1','enrage2','maximum'][pattern.stage],()=>combat.roll(s));
  s.pattern=structuredClone(pattern);s.director.phase='idle';
  if(kind==='S'){s.pendingGuarantee=guarantee;setPhase('contract');frame('contract',true);return;}
  setPhase(kind==='G'?'gimmick_a':'defense');frame(kind==='G'?'gimmick_a':'prep',true,{pattern:structuredClone(pattern)});
 }
 const isAttack=a=>combat.isAttackAction?combat.isAttackAction(a):Rules.ATTACK_ACTIONS.includes(a);
 const isSupport=a=>combat.isSupport?.(a)||false;
 const interrupt=(a,l)=>l.damage>0&&!l.charmBlocked&&(combat.interruptionWeight?combat.interruptionWeight(a,l)>0:(combat.interruptionSkills||['thrust','slash']).includes(a));
 function strike(action,{opening=false,reaction=false,gimmick=false,ultimateCut=true,defenseReaction=false,publishReaction=true,guaranteedHit=false}={}){
  const offensive=isAttack(action),showReaction=reaction&&offensive&&action!=='ultimate';
  // Ultimate and guaranteed Stagger attacks never consume a boss-avoidance roll.
  const reactionKind=showReaction&&!guaranteedHit?(defenseReaction?Rules.defenseBossReaction(s.config.boss,()=>combat.roll(s)):Rules.bossReaction(()=>combat.roll(s))):'hit';
  const beforeBuffs=buffs();
  const result=combat.attack(s,action,{reaction:reactionKind,opening,gimmick});s=result.state;
  if(offensive&&!result.log.charmBlocked){if(dealtTurn!==s.turn){dealtTurn=s.turn;dealtHits=[];}dealtHits.push({damage:Math.max(0,result.log.damage||0),critical:!!result.log.critical});}
  remember(result.log,result.log.charmBlocked?'charm_blocked':offensive?'reaction':'support',{reaction:offensive&&!result.log.charmBlocked?reactionKind:null,buffs:gained(beforeBuffs),...(offensive&&!result.log.charmBlocked?{outgoingHits:structuredClone(dealtHits),outgoingHitIndex:dealtHits.length}:{})});
  if(showReaction&&publishReaction&&!result.log.charmBlocked)frame('reaction',false,{reaction:reactionKind,log:result.log,defenseCounter:defenseReaction});
  else if(ultimateCut&&result.log?.ultimate===true)frame('ultimate_hit',false,{log:result.log});
  else if(!offensive||result.log.charmBlocked)frame('support',false,{log:result.log,delayMs:500});
  return result;
 }
 function finishAttack(action){
  const current=s.phase;
  const stagger=current==='stagger_a'||current==='stagger_b';
  const ragnarokOpening=current==='ragnarok_a'||current==='ragnarok_defense_a';
  const result=strike(action,{opening:stagger||current.startsWith('ragnarok'),reaction:current==='idle'||stagger||ragnarokOpening,guaranteedHit:stagger||ragnarokOpening});
  if(!active()){closeRound();return;}
  if(current==='ragnarok_b'){setPhase('ragnarok_a');frame('ragnarok_a',true);return;}
  if(current==='ragnarok_a'){selectPattern();return;}
  if(current==='ragnarok_defense_a'){closeRound();return;}
  if(current==='stagger_a'){setPhase('stagger_b');frame('stagger_b',true);return;}
  if(current==='stagger_b'){closeRound();return;}
  // New Ragnarok casts allow exactly one opening (A). Keep the historical B
  // transition above only for an already-saved B phase.
  if(current==='idle'&&result.log?.ultimate===true&&s.config.job==='berserker'){s.attackUltimateBonusUsed=true;setPhase('ragnarok_a');frame('ragnarok_a',true);return;}
  selectPattern();
 }
 function defense(action){
  const current=s.phase,beforeBuffs=buffs();let attempted=null;
  // Migrate only an unresolved legacy normal pattern. Previously committed cuts remain intact.
  if(pattern?.kind==='N'&&pattern.hits>2){pattern.hits=2;s.pattern=structuredClone(pattern);}
  if(action==='emergency_evade'){
   combat.onEmergencyEvade?.(s,pattern);s.emergencyUses=(s.emergencyUses??Number(!!s.emergencyUsed))+1;s.emergencyUsed=s.emergencyUses>=(s.config.level>=100?2:1);s.log.push({turn:s.turn,phase:s.phase,action:'emergency_evade',damage:0,incoming:0,emergencyEvaded:true,energyStart:s.energy,energyEnd:s.energy});remember(s.log.at(-1),'evaded');setPhase('result');frame('evaded',false,{pattern:structuredClone(pattern)});closeRound();return;
  }
  if(action==='ultimate'){
   const result=strike(action,{ultimateCut:false});attempted=result.log;
   if(result.log?.ultimate===true){
    remember(result.log,'cancelled',{buffs:gained(beforeBuffs),outgoingHits:structuredClone(dealtHits),outgoingHitIndex:dealtHits.length});
    setPhase('result');frame('cancelled',false,{pattern:structuredClone(pattern)});
    if(s.config.job==='berserker'&&active()){
     // Keep the canceled pattern only for round closure and its cooldown. Its
     // attack is never resolved while the Ragnarok follow-up is available.
     setPhase('ragnarok_defense_a');frame('ragnarok_a',true);return;
    }
    closeRound();return;
   }
   // Charm can block the cast. It spends no use and does not cancel the pending pattern.
  }
  if(pattern.kind==='C'){
   let interrupted=false;
   if(isAttack(action)&&action!=='ultimate'){const r=strike(action,{reaction:true,defenseReaction:true});attempted=r.log;interrupted=interrupt(action,r.log);}
   else if(isSupport(action)){const r=combat.resolveDefenseAction(s,action,pattern,{release:false});s=r.state;attempted=r.log;remember(r.log,'support');frame('support',false,{log:r.log,delayMs:500});}
   if(!active()){closeRound();return;}
   const curseLanded=!interrupted;
   if(curseLanded)s.charmTurns=(s.charmTurns||0)+4;
   remember(attempted||chosen(action,current),interrupted?'curse_interrupted':'curse_release',{curseLanded,selectedAction:action,interruptionReason:interrupted?'hit':attempted?.charmBlocked?'charmed':attempted?.reaction==='evade'?'boss_evaded':isAttack(action)?'non_interrupting_attack':'no_interrupt',buffs:gained(beforeBuffs)});
   setPhase('result');frame(interrupted?'curse_interrupted':'curse_release',false,curseLanded?{characterPose:'hit'}:s.config.job==='warrior'&&action==='thrust'?{characterPose:'idle'}:{});closeRound();return;
  }
  if(pattern.kind==='G'){
   if(isAttack(action)&&action!=='ultimate'){const r=strike(action,{gimmick:true,reaction:true,defenseReaction:true});attempted=r.log;const credit=combat.gimmickProgress?combat.gimmickProgress(action,r.log):(interrupt(action,r.log)?1:0);gimmickSkills=Math.min(pattern.required,gimmickSkills+Math.max(0,Number(credit)||0));s.gimmickHits=gimmickSkills;}
   if(isSupport(action)&&current==='gimmick_a'){const r=combat.resolveDefenseAction(s,action,pattern,{release:false});s=r.state;attempted=r.log;remember(r.log,'support');frame('support',false,{log:r.log,delayMs:500});}
   if(!active()){closeRound();return;}
   if(gimmickSkills>=pattern.required){remember(attempted||chosen(action,current),'gimmick_success',{buffs:gained(beforeBuffs)});setPhase('result');frame('gimmick_success');setPhase('stagger_a');frame('stagger_a',true);return;}
   if(current==='gimmick_a'){remember(attempted||chosen(action,current),'gimmick_prepare',{reaction:attempted&&!attempted.charmBlocked?attempted.reaction:null,buffs:gained(beforeBuffs)});setPhase('gimmick_b');frame('gimmick_b',true);return;}
   const r=isSupport(action)?combat.resolveDefenseAction(s,action,pattern,{release:true}):combat.defense(s,action,pattern);s=r.state;const displayLog=attempted?{...r.log,...attempted,incoming:r.log.incoming,defenseLog:r.log,attackLog:attempted}:r.log;remember(displayLog,'gimmick_release',{hits:r.presentation?.hits||[],hitBasis:r.presentation?.basis,buffs:gained(beforeBuffs)});setPhase('result');frame('gimmick_release',false,{log:r.log});closeRound();return;
  }
  // Offensive choices resolve before the boss releases its normal/heavy attack.
  // Curse and gimmick interruption branches above keep their existing cutscenes.
  if(isAttack(action)&&action!=='ultimate'){
   strike(action,{reaction:true,defenseReaction:true});
   if(!active()){closeRound();return;}
  }
  const incomingBuffs=buffs();
  const hpBefore=s.hp,maxHPBefore=s.stats.hp,lastStandBefore=!!s.lastStand;
  const result=isSupport(action)?combat.resolveDefenseAction(s,action,pattern,{release:true}):combat.defense(s,action,pattern);s=result.state;setPhase('result');
  const hpAfterDefense=s.hp,maxHPAfterDefense=s.stats.hp,lastStandAfterDefense=!!s.lastStand;
  const resultLog=result.log;
  const displayLog=attempted&&!resultLog.attackLog?{...resultLog,...attempted,incoming:result.log.incoming,defenseLog:result.log,attackLog:attempted}:resultLog;
  const recordedHits=result.presentation?.hits||[],d=displayLog.defenseLog||displayLog,a=displayLog.attackLog||{};
  const hpAdjustment=x=>[x.selfDamage,x.heal,x.paladin?.divineHeal,x.paladin?.smiteHeal,x.warrior?.sixthSenseHeal,x.warrior?.parryHeal,x.berserker?.selfDamage,x.berserker?.lifesteal].some(v=>!Number.isFinite(Number(v??0))||Number(v??0)!==0);
  const validHits=recordedHits.length>0&&recordedHits.every(h=>Number.isFinite(h.incoming)&&h.incoming>=0),sum=validHits?recordedHits.reduce((n,h)=>n+h.incoming,0):NaN;
  const hpSafe=pattern.kind==='N'&&validHits&&sum===d.incoming&&Number.isFinite(hpBefore)&&hpBefore>=0&&Number.isFinite(maxHPBefore)&&maxHPBefore>0&&Number.isFinite(hpAfterDefense)&&maxHPBefore===maxHPAfterDefense&&maxHPBefore===s.stats.hp&&lastStandBefore===lastStandAfterDefense&&!d.lastStandTriggered&&!hpAdjustment(d)&&!hpAdjustment(a)&&hpAfterDefense===Math.max(0,hpBefore-sum)&&s.hp===hpAfterDefense;
  const hpDisplay={before:hpBefore,afterDefense:hpAfterDefense,after:s.hp,maxBefore:maxHPBefore,maxAfterDefense:maxHPAfterDefense,lastStandBefore,lastStandAfterDefense,safe:hpSafe,basis:hpSafe?'validated-received-prefix':'authoritative-final-only'};
  remember(displayLog,'attack',{hits:recordedHits,hitBasis:result.presentation?.basis,buffs:gained(incomingBuffs),playerExecuted:!isAttack(action)||!!resultLog.attackLog,hpDisplay});
  for(let hitIndex=1;hitIndex<=(pattern.kind==='N'?pattern.hits:1);hitIndex++)frame('boss_attack',false,{pattern:structuredClone(pattern),hitIndex,...(pattern.kind==='N'&&pattern.hits===2?{delayMs:500}:{}),log:resultLog,...(result.log.chargeBroken?{characterPose:result.log.playerPose}: {})});
  closeRound();
 }
 function contract(action){
  const priorPenalty=!!s.contractPenalty;
  s=combat.contract(s,action==='offer_yes'?'yes':'no');
  if(action==='offer_yes'){s.contractRefusals=0;s.contractPenaltyPending=false;}
  else {s.contractResultRefusals=(s.contractRefusals||0)+1;Rules.contractRefusal(s,contractPolicy);}
  remember(s.log.at(-1),'contract',{contract:structuredClone(s.offer),refusals:action==='offer_no'?s.contractResultRefusals:0,newPenalty:!priorPenalty&&!!s.contractPenalty});
  s.offer.screen='active';guarantee=false;s.pendingGuarantee=false;
  setPhase('contract_result');frame('contract_result',true,{choice:action==='offer_yes'?'yes':'no',refusals:action==='offer_no'?s.contractResultRefusals:0});
 }
 function actions(){
  if(!active())return [];
  if(s.phase==='contract')return ['offer_yes','offer_no'];if(s.phase==='contract_result')return ['offer_next'];
  if(phaseAttack())return (combat.attackActions||Rules.ATTACK_ACTIONS).filter(a=>combat.available(s,a)&&
   (['ragnarok_a','ragnarok_defense_a'].includes(s.phase)?a!=='ultimate'&&isAttack(a):!(a==='ultimate'&&['ultimate_bonus','ragnarok_b'].includes(s.phase))));
  if(['defense','gimmick_a','gimmick_b'].includes(s.phase))return (combat.defenseActions||Rules.DEFENSE_ACTIONS).filter(a=>combat.available(s,a));
  return [];
 }
 function act(action){
  if(!actions().includes(action))throw new Error('Unavailable or stale phase action');
  const backup=state(),meta={pattern:structuredClone(pattern),completed,readyAt:{...readyAt},guarantee,gimmickSkills,dealtTurn,dealtHits:structuredClone(dealtHits),lastTurn:structuredClone(lastTurn),frames:structuredClone(frames)};frames=[];
  try{if(s.phase==='contract_result')closeRound();else if(s.phase==='contract')contract(action);else if(phaseAttack())finishAttack(action);else defense(action);s.log=s.log.slice(-256);return frames;}
  catch(error){s=backup;({pattern,completed,readyAt,guarantee,gimmickSkills,dealtTurn,dealtHits,lastTurn,frames}=meta);throw error;}
 }
 function end(){frames=[];if(!active())return frames;s.status=mode==='live'?'retreated':'ended';s.phase='ended';frame('ended',false,{characterPose:'idle',aborted:true});return frames;}
 function serialize(){return Runtime.clone({state:s,runtime:{schema:'gosu-succubus-flow',version:1,mode,job:s.config.job,started,completed,readyAt,guarantee,gimmickSkills,pattern,frames,contractPolicy,lastTurn,dealtTurn,dealtHits}});}
 function replaceExternalState(next){s=Runtime.replaceExternal(s,next);return state();}
 return {end,serialize,replaceExternalState,actionInfo:a=>({cost:combat.cost?.(s,a)??0,disabledReason:combat.disabledReason?.(s,a)||(!combat.available(s,a)?'Unavailable':null)}),attackActions:combat.attackActions||Rules.ATTACK_ACTIONS,defenseActions:combat.defenseActions||Rules.DEFENSE_ACTIONS,get active(){return active();},start(){if(started)throw Error('Already started');started=true;frames=[];idle();return frames;},act,actions,snapshot:state};
}
module.exports={createEngine};
