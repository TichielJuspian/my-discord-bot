const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const Recipient=require('./recipient-presentation.cjs'),Profile=require('../../서큐버스/succubus-presentation.cjs'),SharedLog=require('./battle-log-render.cjs'),Paladin=require('../../../클래스/성기사/paladin-rules.cjs');
// Pure presentation of resolved events. Never recompute damage or mutate combat.
const ACTION={attack:'Attack',slash:'Slash',thrust:'Thrust',smash:'Smash',prayer:'Blessing',blessing:'Blessing',heal:'Heal',purification:'Purification',guard:'Guard',magic_guard:'Magic Guard',parry:'Parry',magic_parry:'Magic Parry',charge:'Charge',blood_transfusion:'Blood Draw',shoulder_tackle:'Tackle',emergency_evade:'Evade',charmed:'Charmed'};
const finite=n=>Number.isFinite(n)?Math.max(0,n):0;
const number=n=>finite(n).toLocaleString('en-US');
function skill(log,s){
 const a=log.action;
 if(log.interruptStrike&&!log.charmBlocked)return 'Interrupt Strike';
 if(a==='resonant_wave'||a==='ultimate')return s.config.job==='paladin'?'Judgment':s.config.job==='berserker'?'Ragnarok':'Resonant Wave Slash';
 if(a==='berserker_ultimate')return 'Ragnarok';
 if(a==='thrust'&&log.warrior?.deep)return 'Deep Thrust';
 if(a==='smash'&&s.config.job==='paladin')return (typeof log.paladin?.divineSmite==='boolean'?log.paladin.divineSmite:Paladin.evolved(s))?'Divine Smash':'Smash';
 if(a==='attack'&&log.berserker?.attackName)return log.berserker.attackName;
 return ACTION[a]||String(a||'Battle ready').replaceAll('_',' ');
}
function bossNames(pattern,map){
 const p=pattern||{},stage=p.stage||0;
 const name=(key,fallback)=>map?.states?.[(stage?'enraged':'')+(stage?key[0].toUpperCase()+key.slice(1):key)]?.name||map?.states?.[key]?.name||fallback;
 if(p.kind==='N'){
  const count=Math.max(1,p.hits||1),names=[];
  for(let i=1;i<=count;i++){const key='basic'+i,previous=i>2?'basic2':key;const actual=map?.states?.[(stage?'enraged':'')+(stage?key[0].toUpperCase()+key.slice(1):key)]?.name;names.push(actual||name(previous,i===1?'Crimson Claw':'Scarlet Needle'));}
  const groups=[];for(const n of names){const last=groups.at(-1);if(last?.name===n)last.count++;else groups.push({name:n,count:1});}return groups.map(g=>g.name+(g.count>1?' ×'+g.count:'')).join(' + ');
 }
 return p.kind==='H'?name('heavy','Blood Surge'):p.kind==='C'?name('curse','Abyssal Eye'):p.kind==='G'?'Crimson Mirage':'No boss attack';
}
function contractProjection(frame){
 const e=frame.lastTurn,s=frame.state,l=e?.log||frame.log||s.log.at(-1)||{};
 if(e?.event!=='contract'&&frame.kind!=='contract_result'&&!l.offerCinematic)return null;
 const o=e?.contract||s.offer;if(!o?.choice)return null;
 const percent=n=>(n>0?'+':'')+Math.round(n*100)+'%',parts=[];
 if(o.outgoing)parts.push('Damage dealt '+percent(o.outgoing));
 if(o.incoming)parts.push('Damage taken '+percent(o.incoming));
 if(o.lifesteal)parts.push('Heal '+Math.round(o.lifesteal*100)+'% of damage dealt');
 if(o.healRate)parts.push('HP +'+number(o.heal));
 if(o.hpLoss)parts.push('HP -'+number(o.hpLoss));
 if(o.choice==='no'&&o.index===2)parts.push('Energy -'+number(o.energyCost));
 if(o.charm)parts.push('Cursed! (Charm)');
 if(e?.newPenalty)parts.push('Damage taken +100%'+(s.turn<s.contractPenalty?.startTurn?' (pending)':''));
 const refusals=e?.refusals??frame.refusals??s.contractResultRefusals;
 return {own:'Debuff!',ownDetail:parts.join(' · ')||'No ongoing modifier',boss:"Devil's Bargain / "+(o.choice==='yes'?'Accepted':'Refused'),bossDetail:o.choice==='no'&&refusals!=null?'Refusals: '+refusals+'/3 · Refusing 3 times applies a powerful debuff.':'',incoming:0,outgoing:0,selfDamage:0,critical:false,log:l,event:'contract'};
}
function failedDefense(action,type){
 const mismatch=type==='physical'?['magic_parry','magic_guard'].includes(action):type==='magic'?['parry','guard'].includes(action):false;
 return mismatch?(['parry','magic_parry'].includes(action)?'Parry Failed!':'Block Failed!'):null;
}
function projectionBase(frame,map){
 const contract=contractProjection(frame);if(contract)return contract;
 const event=frame.lastTurn,s=frame.state;if(!event)return null;
 const l=event.log||{},attack=l.attackLog||l,defense=l.defenseLog||l,p=event.pattern;
 const incoming=finite(defense.incoming),outgoing=finite(attack.damage),selfDamage=finite(l.selfDamage||attack.selfDamage),counter=finite(l.counterDamage);
 // These support actions never strike; their adapter may still record reaction='hit'.
 const supportOnly=['charge','blood_transfusion','bloodletting','shoulder_tackle','blessing','prayer','heal','purification'].includes(attack.action);
 const kind=event.event,attackAttempt=outgoing>0||!supportOnly&&(!!attack.reaction||attack.ultimate);
 const resolved=['attack','gimmick_release'].includes(kind);
 const failed=resolved?failedDefense(defense.action,p?.type):null,allHitsEvaded=resolved&&event.hits?.length>0&&event.hits.every(hit=>hit.evaded===true);
 let own=skill(attack,s),boss='No boss attack',details=[];
 if(attack.charmBlocked)own='Charmed';
 else if(event.playerExecuted===false)own=skill(l,s)+' (not executed)';
 else if(allHitsEvaded)own='Evaded';
 else if(failed)own=failed;
 else if(defense.parryResult==='perfect')own=(l.action==='magic_parry'?'Perfect Magic Parry':'Perfect Parry')+'!';
 else if(defense.parryResult==='success')own=skill(l,s)+'!';
 else if(resolved&&finite(defense.blocked)>0&&['guard','magic_guard','shoulder_tackle'].includes(defense.action))own='Block!';
 else if(attack.critical)own+='! Critical!!';
 if(resolved||incoming>0)own+=' / '+(incoming?'−'+number(incoming):'0')+' HP';
 if(selfDamage)own+=' / −'+number(selfDamage)+' HP (cost)';
 if(kind==='reaction'||kind==='gimmick_prepare')boss=event.reaction?({hit:'Hit',guard:'Block!',evade:'Evaded'})[event.reaction]||'Hit':'No boss attack';
 if(kind==='attack'||kind==='gimmick_release')boss=bossNames(p,map);
 if(kind==='evaded'){own='Evaded / 0 HP';boss=bossNames(p,map);}
 if(kind==='cancelled')boss=bossNames(p,map)+' / Cancelled';
 if(kind==='curse_interrupted')boss=bossNames(p,map)+' / Interrupted';
 if(kind==='gimmick_success')boss='Crimson Mirage / Interrupted';
 if(kind==='curse_release'){
  boss=bossNames(p,map);
  if(event.curseLanded){if(['parry','magic_parry'].includes(event.selectedAction))own=ACTION[event.selectedAction]+' Failed!';own+=' / Cursed!';}
 }
 const bossDamage=attackAttempt&&event.playerExecuted!==false?(outgoing?'−'+number(outgoing):'0')+' HP':'';
 if(bossDamage)boss+=' / '+bossDamage;
 if(p?.kind==='N'&&resolved&&(p.hits||1)>1)details.push(p.hits+'-hit combo · total received damage');
 if(defense.evades>0)details.push(defense.evades+' hit'+(defense.evades===1?'':'s')+' evaded');
 if(counter)details.push('Counter / −'+number(counter)+' HP');
 return {own,boss,bossDamage,bossDetail:details.join(' · '),incoming,outgoing,selfDamage,critical:!!attack.critical,log:l,event:kind,...(failed?{defenseTypeMismatch:true,evaded:allHitsEvaded}:{})};
}
function model(frame,legacy,map,wrap){
 const p=projection(frame,map);if(!p)return legacy;
 const m={...legacy,own:p.own,boss:p.boss,bossDetail:p.bossDetail,counter:'',dotLine:'',critical:p.critical};
 if(p.event==='contract')Object.assign(m,{ownDetail:p.ownDetail,offerEvent:true,effects:'',passiveNotice:'',nextAttackEmpowered:false});
 // Adapt fallback text without truncating a long boss name or received HP.
 if(p.bossDamage&&wrap&&wrap(m.boss,20,467,1)[0]!==m.boss){m.boss=m.boss.slice(0,-(' / '+p.bossDamage).length);m.bossDetail=[p.bossDamage,m.bossDetail].filter(Boolean).join(' · ');}
 if(p.log.chargeBroken)m.ownDetail=p.log.chargeBreakText||'Charge broken';
 return m;
}
function renderLog(frame){
 const l=structuredClone(frame.lastTurn?.log||frame.log||frame.state.log.at(-1)||{}),p=frame.lastTurn?.pattern,event=frame.lastTurn?.event;
 if(event==='contract'||l.offerCinematic){l.heal=0;l.energyEntries=[];}
 // Symbol choice only. The original combat log/phase is never changed.
 if(['attack','gimmick_release','curse_release','curse_interrupted','cancelled','evaded'].includes(event))l.phase=({N:'normal',H:'heavy',C:'mark',G:'struggle_end'})[p?.kind]||l.phase;
 return l;
}
// Header follows the displayed phase; result content may retain the prior event.
function turnLabel(frame){
 if(frame.defenseCounter)return 'Defense Turn';
 if(['prep','gimmick_a','gimmick_b','boss_attack','curse_release','curse_interrupted','gimmick_success','gimmick_release','evaded','cancelled','contract','contract_result'].includes(frame.kind))return 'Defense Turn';
 if(['idle','reaction','ultimate_hit','ultimate_bonus','stagger_a','stagger_b','ragnarok_a','ragnarok_b'].includes(frame.kind))return 'Attack Turn';
 if(['defense','gimmick_a','gimmick_b','contract','contract_result'].includes(frame.state?.phase))return 'Defense Turn';
 const e=frame.lastTurn;if(!e)return 'Attack Turn';
 if(['attack','gimmick_prepare','gimmick_release','gimmick_success','curse_release','curse_interrupted','evaded','cancelled','contract'].includes(e.event))return 'Defense Turn';
 if(['defense','gimmick_a','gimmick_b','contract','contract_result'].includes(e.log?.phase))return 'Defense Turn';
 return 'Attack Turn';
}
function receiptAt(hits,index,field='incoming'){
 if(!Array.isArray(hits)||!hits.length||!Number.isInteger(index)||index<1||index>hits.length||hits.some(h=>!Number.isFinite(h?.[field])||h[field]<0))return null;
 return {index,count:hits.length,final:index===hits.length,hit:hits[index-1],amount:hits[index-1][field],total:hits.slice(0,index).reduce((n,h)=>n+h[field],0)};
}
function comboAt(frame,map){
 const e=frame.lastTurn;if(e?.event!=='attack'||e.pattern?.kind!=='N'||!e.hits?.length)return null;
 const index=frame.kind==='boss_attack'?frame.hitIndex:e.hits.length,r=receiptAt(e.hits,index);if(!r)return null;
 const l=e.log||{},d=l.defenseLog||l,action=d.action||l.action,hit=r.hit;
 const parryFor=h=>['parry','magic_parry'].includes(action)&&((action==='parry'&&h.type==='physical')||(action==='magic_parry'&&h.type==='magic'))&&['success','perfect'].includes(h.parryResult??d.parryResult);
 const guardFor=h=>d.matched===true&&d.guardReduction>0&&((action==='guard'&&h.type==='physical')||(action==='magic_guard'&&h.type==='magic'));
 const tackleFor=h=>action==='shoulder_tackle'&&d.tackle===true&&h.kind!=='G';
 const parry=parryFor(hit),guard=guardFor(hit),tackle=tackleFor(hit);
 const defended=h=>!h.evaded&&(parryFor(h)||guardFor(h)||tackleFor(h));
 const again=defended(hit)&&e.hits.slice(0,index-1).some(defended),perfect=parry&&(hit.parryResult??d.parryResult)==='perfect'&&!hit.evaded;
 let own=skill(d,frame.state);
 if(hit.evaded)own='Evaded';
 else if(failedDefense(action,hit.type))own=failedDefense(action,hit.type);
 else if(parry)own=(perfect?'Perfect ':'')+(action==='magic_parry'?'Magic Parry':'Parry')+(again?' Again!':'!');
 else if(tackle)own='Tackle'+(again?' Again!':'!');
 else if(guard)own='Block'+(again?' Again!':'!');
 else if(l.attackLog||e.playerExecuted===false)own='Hit';
 const key='basic'+index,enraged=e.pattern.stage>0?'enraged'+key[0].toUpperCase()+key.slice(1):key;
 const boss=map?.states?.[enraged]?.name||map?.states?.[e.pattern.stage>0?'enragedBasic2':'basic2']?.name||bossNames({...e.pattern,hits:1},map);
 return {...r,incoming:r.amount,own,boss,again,evaded:!!hit.evaded,perfect,mitigated:!hit.evaded&&(parry||guard||tackle)&&finite(d.blocked)>0};
}
function projection(frame,map){
 const p=projectionBase(frame,map),c=comboAt(frame,map);if(!p||!c)return p;
 const outgoing=c.final?p.outgoing:0;
 return {...p,own:c.own+' / '+(c.incoming?'−'+number(c.incoming):'0')+' HP',boss:c.boss+(outgoing?' / Hit / −'+number(outgoing)+' HP':''),bossDamage:outgoing?'−'+number(outgoing)+' HP':'',bossDetail:'',incoming:c.incoming,outgoing,selfDamage:c.final?p.selfDamage:0,critical:false,receivedTotal:c.index>1?'Total '+(c.total?'−'+number(c.total):'0')+' HP':'',combo:c};
}
function displayedHP(frame){
 const c=comboAt(frame),h=frame.lastTurn?.hpDisplay;
 if(!c||c.final)return {hp:frame.state.hp,stepped:false,note:''};
 if(h?.safe===true&&Number.isFinite(h.before))return {hp:Math.max(0,h.before-c.total),stepped:true,note:''};
 return {hp:frame.state.hp,stepped:false,note:'HP shows final result'};
}
function guardOutcome(frame){
 const l=frame.lastTurn?.log||frame.log||frame.state.log.at(-1)||{},d=l.defenseLog||l;
 return ['guard','magic_guard'].includes(d.action)&&typeof d.matched==='boolean'?(d.matched?'BLOCK MATCHED · 50% reduction':'BLOCK TYPE MISMATCH'):'';
}
module.exports={projection,model,renderLog,skill,bossNames,contractProjection,turnLabel,guardOutcome,receiptAt,comboAt,displayedHP};

// Succubus-only interpretation; the shared renderer sees no combat state.
function presentation(frame,{map,gimmick,totalDamage=0,legacy={}}={}){
 // The choice screen must describe its pending offer, not repeat the previous hit.
 if(frame.kind==='contract')return Recipient.create({turnLabel:'Defense Turn',totalDamage,actors:{
  player:{action:{skillId:'player.awaiting_response',label:'Awaiting your response',color:'#a9e5ff'}},
  boss:{action:{skillId:'succubus.contract_offer',label:'The Succubus makes a tempting offer.',color:'#ffb4b4'},notes:[{text:'Will you accept? Choose YES or NO.',color:'#edf3fa'}]}
 }});
 const event=frame.lastTurn,p=projection(frame,map),combo=comboAt(frame,map),l=event?.log||frame.log||{},def=l.defenseLog||l,attack=l.attackLog||l,complete=!combo||combo.final;
 const contractCharm=p?.event==='contract'&&Number((event?.contract||frame.state.offer)?.charm)>0;
 const actionColor=contractCharm?'#d394ff':combo?(combo.evaded||combo.perfect?'#ffd578':combo.mitigated?'#8ce1dc':'#edf3fa'):p?.critical?'#ffad66':p?.event==='evaded'||p?.evaded||def.parryResult==='perfect'?'#ffd578':finite(def.blocked)>0&&['parry','magic_parry','guard','magic_guard','shoulder_tackle'].includes(l.action)?'#8ce1dc':'#edf3fa';
 let own=event?(p?.own||legacy.own||''):'',bossHead=event?(p?.boss||legacy.boss||''):'',received=null,bossReceived=null,bossExtra=null;
 const aux=[],buffs=[],bossAux=[];
 if(combo){
  own=combo.own;bossHead=combo.boss;received={amount:combo.incoming,total:combo.total,index:combo.index,count:combo.count,color:'#edf3fa'};
  if(complete&&p.outgoing>0)bossExtra={text:'Hit',receipt:{amount:p.outgoing,total:p.outgoing,index:1,count:1,color:attack.critical?'#ffad66':'#edf3fa'},critical:!!attack.critical};
  if(complete&&l.attackLog&&event.playerExecuted!==false){const title=skill(attack,frame.state)+(attack.critical?'! Critical!!':'');aux.push({text:title,color:attack.critical?'#ffad66':'#edf3fa'});}
 }else if(p){
  own=own.replace(/ \/ (?:[−-][\d,]+|0) HP(?: \(cost\))?/g,'');
  if(['attack','gimmick_release','evaded'].includes(p.event))received={amount:p.incoming,total:p.incoming,index:1,count:1,color:'#edf3fa'};
  if(p.bossDamage){bossHead=bossHead.replace(' / '+p.bossDamage,'');
   // A future caller may supply actual outgoing-hit records; no new combat or RNG.
   const future=receiptAt(event.outgoingHits,event.outgoingHitIndex,'damage');
   bossReceived=future&&future.amount===p.outgoing?{amount:future.amount,total:future.total,index:future.index,count:future.count,critical:future.hit.critical===true,color:p.critical?'#ffad66':'#edf3fa'}:{amount:p.outgoing,total:p.outgoing,index:1,count:1,color:p.critical?'#ffad66':'#edf3fa'};
  }
  if(p.event==='contract'){const detail={text:p.ownDetail,color:'#d9b2ff'};if(contractCharm&&p.ownDetail.endsWith('Cursed! (Charm)'))detail.runs=[{text:p.ownDetail.slice(0,-'Cursed! (Charm)'.length),color:'#d9b2ff'},{text:'Cursed! (Charm)',color:'#d394ff'}];aux.push(detail);if(p.bossDetail)bossAux.push({text:p.bossDetail,color:'#d9b2ff'});}
  else if(p.bossDetail)bossAux.push({text:p.bossDetail,color:'#d7cbf1'});
 }
 if(complete&&event&&p?.event!=='contract'){
  if(p?.selfDamage)aux.push({text:'−'+number(p.selfDamage)+' HP (cost)',color:'#ff9fae'});
  const grace=frame.state.config.job==='paladin'&&def.graceProc===true&&finite(def.incoming)>0&&Number.isFinite(def.paladin?.divineHeal)&&def.paladin.divineHeal>=0;
  if(grace)aux.push({text:'Passive! +'+number(def.paladin.divineHeal)+' HP',icon:{key:'paladin.divine_grace',after:'Passive!'},color:'#89e4d4'});
  const healed=finite(l.heal)+(grace?0:finite(l.paladin?.divineHeal))+finite(l.paladin?.smiteHeal)+finite(l.warrior?.thrustHeal??l.warrior?.sixthSenseHeal)+finite(l.warrior?.parryHeal);
  if(healed)aux.push({text:'HP +'+number(healed),color:'#89e4d4'});
  if(l.purified?.length)aux.push({text:'Purified: '+l.purified.join(', '),color:'#89e4d4'});
  if(def.chargeBroken||l.chargeBroken)aux.push({text:'Charge broken',color:'#ff9fae'});
  if(guardOutcome(frame))aux.push({text:guardOutcome(frame),color:finite(def.blocked)>0?'#8ce1dc':'#edf3fa'});
  const entries=[...(l.defenseLog?.energyEntries||[]),...(l.attackLog?.energyEntries||l.energyEntries||[])];
  for(const e of entries.filter(e=>e.requested>0))aux.push({text:(e.reason==='parry_refund'?'Refund · ':'')+'Energy +'+e.applied+(e.applied<e.requested?' (cap)':''),resource:true,color:'#9be4f2'});
  if(entries.some(e=>e.reason==='overheat'&&e.applied<0))aux.push({text:'Energy '+(l.defenseLog?.energyStart??l.energyStart)+' → '+l.energyEnd,resource:true,color:'#9be4f2'});
  for(const name of event.buffs||[])buffs.push(frame.state.config.job==='warrior'&&name==='Thrust Defense'?'Defense Up':name);
  if(frame.state.config.job==='paladin'&&event.buffs?.includes('Divine Punishment')&&attack.action==='prayer'&&attack.paladin?.blessingBefore<Paladin.threshold(frame.state)&&attack.paladin.blessing>=Paladin.threshold(frame.state)&&attack.paladin.divineSmite===true)aux.push({text:'Divine Smash Unlocked!',color:'#edf3fa'});
  if(frame.state.config.job==='warrior'&&event.buffs?.includes('Hone')&&attack.action==='slash'&&attack.damage>0&&attack.warrior?.hone===require('../../../클래스/검사/warrior-rules.cjs').threshold(frame.state)&&attack.warrior.deep===true)aux.push({text:'Deep Thrust Unlocked!',color:p.critical?'#ffad66':'#edf3fa'});
 }
 if(!complete&&combo?.evaded&&['success','perfect'].includes(def.parryResult))for(const name of event.buffs||[])buffs.push(name);
 const hp=displayedHP(frame);if(hp.note)aux.push({text:hp.note,color:'#afbdcc'});
 // A landed restriction is a real received effect, never invented damage.
 // Keep the selected-action failure, replacing only its redundant curse text.
 const curseEffect=event?.event==='curse_release'&&event.curseLanded===true?Profile.charmEffect():null;
 if(curseEffect)own=own.replace(/ \/ Cursed!$/, '');
 if(curseEffect&&event.interruptionReason)bossAux.push({text:({boss_evaded:'Curse not interrupted: the Succubus evaded.',charmed:'Curse not interrupted: Charm blocked your skill.',non_interrupting_attack:'This attack did not interrupt the curse.',no_interrupt:'Curse cast completed.'})[event.interruptionReason]||'',color:'#ffe0b5'});
 const reaction=complete?event?.reaction:null;
 const outgoingId=Profile.playerSkillId(attack,frame.state),incomingId=Profile.bossSkillId(event,combo);
 const identify=(r,source,target,skillId)=>r?{...r,source,target,skillId,...(source==='player'&&r.critical==null?{critical:!!attack.critical}:{})}:null;
 const playerIcon=p?.event==='contract'?(contractCharm?{kind:'effect',key:'succubus.charm',fallback:'curse'}:{kind:'symbol',key:'offer'}):combo?.evaded||p?.event==='evaded'||p?.evaded?{kind:'evade'}:combo?.own==='Hit'?{kind:'impact'}:{kind:'log',log:combo?{...def,critical:false}:renderLog(frame)};
 const bossIcon=reaction==='hit'?{kind:'impact',critical:!!attack.critical}:reaction==='guard'?{kind:'log',log:{action:'guard'}}:reaction==='evade'?{kind:'evade'}:{kind:'symbol',key:p?.event==='contract'?'offer':p?.event?.startsWith('curse')?'curse':p?.event?.startsWith('gimmick')?'special':event?.pattern?.kind==='H'?'heavy':event?.pattern?'attack':'pause'};
 const pendingOutgoing=!complete?finite(attack.damage):bossReceived?.count>1?Math.max(0,p.outgoing-bossReceived.total):0;
 return Recipient.create({turnLabel:turnLabel(frame),totalDamage:Math.max(0,totalDamage-pendingOutgoing),actors:{
  player:{action:{skillId:Profile.playerSkillId(def,frame.state),label:own,color:actionColor,icon:playerIcon},receipt:identify(received,'boss','player',incomingId),notes:aux,effects:[...buffs.filter(name=>(name!=='Hone'||frame.state.hone<require('../../../클래스/검사/warrior-rules.cjs').HONE_MAX)&&(name!=='Divine Punishment'||frame.state.paladinBlessing<Paladin.PUNISHMENT_MAX_STACKS)).map(name=>Profile.gainedEffect(name,frame.state)),...(curseEffect?[curseEffect]:[])]},
  boss:{action:{skillId:incomingId,label:bossHead,color:reaction==='evade'?'#ffd578':(reaction==='hit'||bossExtra)&&attack.critical?'#ffad66':'#f0b7bf',icon:bossIcon},receipt:identify(bossReceived,'player','boss',outgoingId),notes:bossAux,extra:bossExtra?{...bossExtra,receipt:identify(bossExtra.receipt,'player','boss',outgoingId)}:null,gauge:gimmick}
 }});
}
function drawing(frame,options){return SharedLog.drawing(presentation(frame,options),{...options,effectIcon:Profile.readEffectIcon,effectVisual:Profile.resolveEffectIcon});}
module.exports.presentation=presentation;
module.exports.drawing=drawing;
