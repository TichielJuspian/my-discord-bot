'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Rules=require('./rules.cjs'),LastTurn=require('./last-turn.cjs'),StatusPanels=require('./status-panels.cjs');
const LABEL={charge:'Charge',blood_transfusion:'Bloodletting',bloodletting:'Bloodletting',shoulder_tackle:'Tackle',tackle:'Tackle',smash:'Divine Smash',blessing:'Blessing',heal:'Heal',guard:'Guard',magic_guard:'Magic Guard',attack:'Basic Attack',thrust:'Thrust',slash:'Slash',ultimate:'Ultimate',parry:'Parry',magic_parry:'Magic Parry',emergency_evade:'Evade',offer_yes:'YES',offer_no:'NO',offer_next:'NEXT',end_battle:'End battle'};
const TITLES={ragnarok_b:'STAGGER B · 1.5× ATTACK',ragnarok_a:'STAGGER A · 1.5× ATTACK',support:'SKILL RESULT',idle:'PLAYER ATTACK TURN',reaction:'BOSS REACTION',prep:'PLAYER DEFENSE TURN',ultimate_bonus:'BONUS ATTACK',gimmick_a:'INTERRUPT 1 / 2',gimmick_b:'INTERRUPT 2 / 2',stagger_a:'STAGGER ATTACK 1 / 2',stagger_b:'STAGGER ATTACK 2 / 2',boss_attack:'BOSS ATTACK',curse_release:'CURSE RELEASED',curse_interrupted:'CURSE INTERRUPTED',gimmick_success:'GIMMICK INTERRUPTED',gimmick_release:'CRIMSON MIRAGE',evaded:'PATTERN EVADED',cancelled:'PATTERN CANCELLED',enrage:'ENRAGE',ended:'TEST COMPLETE',contract:"DEVIL'S CONTRACT",contract_result:'CONTRACT RESULT'};
const imageKeys={support:'idle',ragnarok_b:'groggyFinal',ragnarok_a:'groggy',idle:'idle',ultimate_bonus:'idle',gimmick_a:'special',gimmick_b:'specialPrepareB',gimmick_success:'groggy',stagger_a:'groggy',stagger_b:'groggyFinal',curse_release:'curse',curse_interrupted:'hit',gimmick_release:'specialCast',contract:'offer',cancelled:'warriorUltimateHit'};
// Presentation adapters operate on clones. Never erase combat history to reset a portrait.
const className=s=>s.config.job==='paladin'?'Paladin':s.config.job==='berserker'?'Berserker':'Blader';
function displaySession(id,frame,{playerName,activeSession}={}){
 const state=structuredClone(frame.state);
 if(frame.log){if(state.log.length)state.log[state.log.length-1]=structuredClone(frame.log);else state.log.push(structuredClone(frame.log));}
 for(const l of state.log){l.action=({magic_parry:'parry',magic_guard:'guard',blessing:'prayer'})[l.action]||l.action;}
 // The card label is the class only. Accounting retains the real actor on activeSession.
 return {id,state,playerName:className(state),...(activeSession?.booster?{booster:structuredClone(activeSession.booster)}:{})};
}
function cardSession(session,frame){
 const a={...session,state:structuredClone(session.state)};
 a.state.hp=LastTurn.displayedHP(frame).hp;
 if(frame.characterPose==='idle'||frame.interactive===true)a.state.log.push({turn:a.state.turn,phase:a.state.phase,action:'idle',berserker:{},displayOnly:true});
 else if(['hit','enrage-hit'].includes(frame.characterPose))a.state.log.push({turn:a.state.turn,phase:a.state.phase,action:'display_hit',incoming:1,berserker:{chargeBroken:true},displayOnly:true});
 if(a.state.offerEffects?.remaining)a.state.offer={...a.state.offerEffects};
 return a;
}
// Gimmick progress is embedded in Last Turn. Use only the current v2 frame.
function gimmickModel(frame){
 const s=frame.state;
 if(s.status!=='active'||!['gimmick_a','gimmick_b','gimmick_success'].includes(frame.kind))return null;
 const required=Math.max(1,Number(s.gimmickRequired)||2),hits=Math.max(0,Math.min(required,Number(s.gimmickHits)||0));
 const hint=frame.kind==='gimmick_success'?'':'Basic Attack does not interrupt (except for Berserker).';
 return {hits,required,progress:hits/required,hint,description:`Interrupt progress: ${hits}/${required}`+(hint?'\n'+hint:'')};
}
function gimmickSVG(m,wrap){
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const lines=wrap(m.hint,16,596,3),offset=Math.max(0,lines.length-1)*20,height=80+offset;
 const text=(x,y,value,size,color,extra='')=>`<text x="${x}" y="${y}" font-family="Noto Sans KR" font-size="${size}" font-weight="700" fill="${color}" dominant-baseline="central" ${extra}>${esc(value)}</text>`;
 // Exact v1.4 yellow gradient, track, fill, divider, and panel geometry from raid-metal-ui.js.
 // Extra hint lines move the intact gauge downward; no Next Action block is reintroduced.
 const gauge='<rect x="18" y="64" width="604" height="12" rx="4" fill="#302711" stroke="#d8ad48" stroke-width="1"/><rect x="20" y="66" width="'+(600*Math.max(0,Math.min(1,m.progress)))+'" height="8" rx="2" fill="url(#yellow)"/><path d="M320 66V74" stroke="#6b501d" stroke-width="1"/>';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${height}"><defs><linearGradient id="yellow" x2="0" y2="1"><stop stop-color="#fff4a5"/><stop offset=".45" stop-color="#ffcf39"/><stop offset="1" stop-color="#df951c"/></linearGradient></defs><rect x="1" y="1" width="638" height="${height-2}" rx="7" fill="#142035"/>`+text(18,21,'INTERRUPT PROGRESS',14,'#ffe1a0')+text(622,21,m.hits+' / '+m.required,17,'#ffe1a0','text-anchor="end"')+lines.map((line,i)=>text(22,46+i*20,line,16,'#d9e8f6')).join('')+`<g transform="translate(0 ${offset})">${gauge}</g></svg>`;
 return {svg,height};
}
function legacyProviders(root){
 const load=file=>require(path.join(root,file));
 const textBounds=require('./battle-log-render.cjs').createTextBounds(root);
 return {
  boss:(a,name)=>{
   const asset=load('raid-metal-assets.js').boss(a,name);
   // The shared renderer names by turn, but v2 can change HP several times in
   // one turn. Content identity is stable for identical strips and distinct for
   // changed pixels, so changed strips never reuse an old upload's filename.
   return {...asset,name:'raid15-boss-status-'+createHash('sha256').update(asset.attachment).digest('hex')+'.png'};
  },
  // Exact v1.4 static PNG renderer, asset resolution and original camera/crop.
  character:a=>load('raid-card-motion.js').asset(a),
  feed:(a,frame)=>{
   const feed=load('raid-battle-feed.js'),s=structuredClone(a.state);
   if(frame.lastTurn?.log){if(s.log.length)s.log[s.log.length-1]=structuredClone(frame.lastTurn.log);else s.log.push(structuredClone(frame.lastTurn.log));}
   const l=s.log.at(-1)||{};
   let m=load('berserker-ui.cjs').feed(feed.model(s,true),s,l);
   // Remove ONLY the intent block. All Last Turn rows, icons, counters and energy remain.
   m={...m,hint:s.hp<=0?'EXHAUSTED':'TURN RESULT',storyLines:[],sub:'',secondary:'',progress:null,mechanicText:'',totalDamage:s.totals?.damage||0};
   if(l.incoming>0&&!m.boss)m.boss='Boss attack / You -'+l.incoming+' HP';
   if(l.action==='heal')m.own='Heal / HP +'+(l.heal||0);
   if(l.action==='emergency_evade'||l.emergencyEvaded)m.own='Evade!';
   if(l.chargeBroken)m.bossDetail=l.chargeBreakText||'Charge broken';
   if(l.parryResult&&l.blocked>0)m.bossDetail='Parry reduced damage by '+l.blocked;
   if(l.charmApplied)m.boss='Charmed! +4 turns';
   if(l.offerCinematic)m.boss='No attack / Contract resolved';
   let artMap;try{artMap=load('succubus-art-20261113/boss-art-map.json');}catch{artMap={states:{}};}
   m=LastTurn.model(frame,m,artMap,feed.wrap);
   const drawing=LastTurn.drawing(frame,{map:artMap,wrap:feed.wrap,textBounds,impactIcon:log=>load('raid-impact-icon.js').asset(log).attachment.toString('base64'),symbol:load('raid-log-symbols.js').svg,gimmick:gimmickModel(frame),totalDamage:s.totals?.damage||0,legacy:m});
   return {name:'battle-feed-'+s.turn+'.png',attachment:load('raid-metal-assets.js').raster(drawing.svg),description:drawing.description};
  },
  gimmick:(a,frame)=>{
   const m=gimmickModel(frame);if(!m)return null;
   const drawing=gimmickSVG(m,load('raid-battle-feed.js').wrap);
   return {name:'gimmick-progress-'+a.state.turn+'.png',attachment:load('raid-metal-assets.js').raster(drawing.svg),description:m.description};
  },
  effects:a=>{
   const s=structuredClone(a.state),visible=load('raid-visible-effects.js');
   // v1.4's effect drawing reads the active contract through s.offer.
   if(s.offerEffects?.remaining)s.offer={...s.offerEffects};
   const list=visible.descriptors(s).map(e=>{
    const turns=({'BLADE TRANCE':s.overheatTurns,'Thrust Defense':s.thrustDefenseTurns,'Blessing':s.config.job==='paladin'?Math.max(s.protectionTurns||0,load('raid-engine/paladin-rules.cjs').offensiveTurns(s)):undefined})[e.name];
    return turns>0?{...e,count:e.name==='Blessing'?e.count:null,turns}:e;
   });
   return StatusPanels.buildStatusPanels({state:s,visible,wrap:load('raid-battle-feed.js').wrap,raster:load('raid-metal-assets.js').raster,list,maxPanels:6});
  }
 };
}
function createRenderer({root=path.join(__dirname,'..'),map=null,read=fs.readFileSync,exists=fs.existsSync,legacyPanels=true,legacy=null}={}){
 if(!map){try{map=require(path.join(root,'succubus-art-20261113/boss-art-map.json'));}catch{map={states:{}};}}
 const assetRoot=path.join(root,'raid15/assets');
 function scene(frame){
  const s=frame.state,stage=s.director.enrageLevel||0;
  if(frame.kind==='ultimate_hit'||frame.kind==='reaction'&&frame.reaction==='hit'&&frame.log?.ultimate){const key=s.config.job==='berserker'?'berserkerUltimateHit':s.config.job==='paladin'?'paladinUltimateHit':'warriorUltimateHit';if(map.states[key])return path.join(root,'succubus-art-20261113',map.states[key].image);}
  if(frame.kind==='reaction')return path.join(assetRoot,({hit:'10 Hit_Reaction.jpg',guard:'11 Guard.jpg',evade:'12 Dodge.jpg'})[frame.reaction]||'10 Hit_Reaction.jpg');
  if(frame.kind==='prep'&&s.pattern.kind==='N')return path.join(assetRoot,stage?'01 Enraged_Attack Prep.jpg':'01 Attack Prep.jpg');
  let key=imageKeys[frame.kind];if(frame.kind==='cancelled')key=s.config.job==='berserker'?'berserkerUltimateHit':s.config.job==='paladin'?'paladinUltimateHit':'warriorUltimateHit';
  if(frame.kind==='prep')key=s.pattern.kind==='H'?'heavyPrepare':'cursePrepare';
  if(frame.kind==='boss_attack')key=s.pattern.kind==='N'?'basic'+frame.hitIndex:'heavy';
  if(frame.kind==='contract_result')key=frame.choice==='yes'?'offerYes':'offerNo';
  if(frame.kind==='ended')key=frame.aborted?'idle':s.status==='victory'?'defeated':'playerExhausted';
  if(frame.kind==='enrage'||key==='idle'||frame.kind==='evaded')key=stage>=3?'enragedIdle3':stage===2?'enragedIdle2':stage===1?'enragedIdle':'idle';
  else {const enraged='enraged'+(key||'')[0]?.toUpperCase()+(key||'').slice(1);if(stage&&map.states[enraged])key=enraged;}
  // A genuine third cut is preferred; no relabelled v1.4 wing pattern is executed.
  if(!map.states[key]&&frame.kind==='boss_attack'&&frame.hitIndex===3)key=stage&&map.states.enragedBasic2?'enragedBasic2':'basic2';
  const value=map.states[key]?.image;
  return value?path.join(root,'succubus-art-20261113',value):null;
 }
 const text=content=>({type:10,content});
 const gallery=(name,description)=>({type:12,items:[{media:{url:'attachment://'+name},description}]});
 function render({id,revision,frame,engine,ready,playerName,namespace='raid15',production=false,activeSession}){
  if(!['raid15','raidtest'].includes(namespace))throw new Error('Unknown battle control namespace');
  const s=frame.state,files=[],components=[],session=displaySession(id,frame,{playerName,activeSession});
  let desired=scene(frame),fallback=false;
  if(!desired||!exists(desired)){
   fallback=true;
   const idleStage=s.director.enrageLevel||0,idleKey=idleStage>=3?'enragedIdle3':idleStage===2?'enragedIdle2':idleStage===1?'enragedIdle':'idle';
   const idle=map.states[idleKey]?.image;desired=idle?path.join(root,'succubus-art-20261113',idle):null;
   if(!desired||!exists(desired))desired=path.join(assetRoot,idleStage?'01 Enraged_Attack Prep.jpg':'01 Attack Prep.jpg');
  }
  if(desired&&exists(desired)){const file={attachment:read(desired),name:'raid15-boss'+path.extname(desired)};files.push(file);components.push(gallery(file.name,TITLES[frame.kind]||'Nameless Succubus'));}
  else components.push(text('Nameless Succubus · '+(TITLES[frame.kind]||'Battle')));
  let bossCard,characterCard,feedCard,effectsCard,gimmickCard;
  // Resolve separately so one missing portrait never removes the combat log/effects.
  const providers=legacyPanels?(legacy||legacyProviders(root)):{};
  try{bossCard=providers.boss?.(session,'Nameless Succubus');}catch{}
  try{characterCard=providers.character?.(cardSession(session,frame));}catch{}
  try{feedCard=providers.feed?.(session,frame);}catch{}
  try{effectsCard=providers.effects?.(session,frame);}catch{}
  if(bossCard){files.push(bossCard);components.push(gallery(bossCard.name,bossCard.description||'Boss status'));}
  else components.push(text(`**Nameless Succubus** · Turn ${s.turn} · ${['Normal','Enrage 1','Enrage 2','Maximum'][s.director.enrageLevel||0]}\nHP ${s.bossHP} / ${s.bossMaxHP} · Total damage ${s.totals.damage}`));
  const result=[];
  if(frame.kind==='contract_result'&&!LastTurn.projection(frame,map)){
   result.push(frame.choice==='yes'?'Bargain accepted.':'Offer refused.');
   if(frame.choice==='no')result.push(`Refusals: **${frame.refusals}/3**`);
   if(frame.choice==='no'&&frame.refusals===3)result.push('Damage taken +100% for the next 3 turns.');
   try{const details=require(path.join(root,'raid-devil-offer-view.js')).result(s);if(details)result.push(details);}catch{}
  }
  const l=frame.log||s.log.at(-1);
  if(feedCard){files.push(feedCard);components.push(gallery(feedCard.name,feedCard.description||'Last combat turn result'));}
  else {const lines=['**'+LastTurn.turnLabel(frame)+'** · Total damage '+Math.max(0,s.totals.damage-((LastTurn.comboAt(frame,map)&&!LastTurn.comboAt(frame,map).final)?(frame.lastTurn.log.attackLog?.damage||0):0))],display=LastTurn.projection(frame,map);if(display){lines.push('Your action: '+display.own,'Boss action: '+display.boss);if(display.receivedTotal)lines.push(display.receivedTotal);if(display.ownDetail)lines.push(display.ownDetail);const gauge=gimmickModel(frame);if(gauge)lines.push('Boss action: '+gauge.description);if(display.bossDetail)lines.push(display.bossDetail);}else if(l){lines.push(`Your action: ${LABEL[l.action]||l.action} · Damage dealt ${l.damage||0}`,`Boss action: Damage taken ${l.incoming||0}${l.parryResult?' · '+l.parryResult.toUpperCase()+' PARRY':''}`);if(l.counterDamage)lines.push('Counter: '+l.counterDamage+' damage');if(l.energyStart!=null)lines.push('Energy '+l.energyStart+' → '+l.energyEnd);const healed=(l.heal||0)+(l.paladin?.divineHeal||0)+(l.paladin?.smiteHeal||0)+(l.warrior?.sixthSenseHeal||0);if(healed)lines.push(`HP recovered ${healed}`);if(l.chargeBroken)lines.push('CHARGE BROKEN! '+(l.chargeBreakText||'Charge reset.'));}else lines.push('Your action:', 'Boss action:');if(LastTurn.guardOutcome(frame))lines.push(LastTurn.guardOutcome(frame));components.push({type:17,accent_color:0xffbd45,components:[text(lines.join('\n'))]});}
  if(fallback)result.push('Cutscene fallback active.');
  if(result.length)components.push(text(result.join('\n')));
  const player=[];
  if(characterCard){files.push(characterCard);player.push(gallery(characterCard.name,(s.config.job==='paladin'?'Paladin':s.config.job==='berserker'?'Berserker':'Blader')+' status'));}
  else player.push(text(`**${s.config.job==='paladin'?'Paladin':s.config.job==='berserker'?'Berserker':'Blader'} · Level ${s.config.level}**\nHP ${s.hp} / ${s.stats.hp} · Energy ${s.energy} / ${s.maxEnergy}`));
  if(s.config.job==='berserker')player.push(text('**Berserker skill: Curse / Mechanic interrupt**\nDuring Curse or Mechanic prep, uncharged Basic Attack becomes Interrupt Strike: costs 1 Energy, gives 1 interrupt on hit, and restores no Energy. Charge Stage 1 gives 1 interrupt; Stages 2 and 3 give 2.'));
  if(ready){
   const ultimateLeft=Math.max(0,(s.config.level>=90?2:1)-(s.ultimateUses??Number(!!s.ultimateUsed)));
   const evadeLeft=Math.max(0,1-(s.emergencyUses??Number(!!s.emergencyUsed)));
   const all=(frame.kind==='contract'?['offer_yes','offer_no']:frame.kind==='contract_result'?['offer_next']:['prep','gimmick_a','gimmick_b'].includes(frame.kind)?(engine.defenseActions||Rules.DEFENSE_ACTIONS):(engine.attackActions||Rules.ATTACK_ACTIONS)).filter(action=>(action!=='ultimate'||ultimateLeft>0)&&(action!=='emergency_evade'||evadeLeft>0));
   const available=engine.actions();
   const actionLabel=action=>action==='attack'&&s.config.job==='berserker'&&(['gimmick_a','gimmick_b'].includes(frame.kind)||frame.kind==='prep'&&s.pattern?.kind==='C')&&!(s.berserkerCharge>0)?'Interrupt Strike':LABEL[action]||action;
   const buttons=all.map(action=>{const info=action.startsWith('offer_')?{}:engine.actionInfo?.(action)||{};let label=action==='thrust'?(s.hone||0)>=require('../raid-engine/warrior-rules.cjs').threshold(s)?'Deep Thrust':'Thrust':actionLabel(action);if(info.cost>0)label+=' · '+info.cost+' Energy';if(action==='ultimate')label+=' · '+ultimateLeft+' left';if(action==='emergency_evade')label='Evade · '+evadeLeft+' left';return {type:2,style:action==='offer_yes'?1:action==='offer_no'?4:['ultimate','emergency_evade'].includes(action)?3:['thrust','slash','smash'].includes(action)?1:2,label,custom_id:`${namespace}:${id}:${revision}:${action}`,disabled:!available.includes(action)};});
   for(let n=0;n<buttons.length;n+=5)player.push({type:1,components:buttons.slice(n,n+5)});
  }
  if(production&&namespace==='raidtest'&&ready)player.push({type:1,components:[['equipment','Equipment'],['inventory','Inventory'],['skills','Skill guide']].map(([action,label])=>({type:2,style:2,label,custom_id:`${namespace}:${id}:${revision}:${action}`}))});
  // A separate danger row never exceeds Discord's five-buttons-per-row limit.
  if(ready||frame.kind==='ended'&&!frame.aborted)player.push({type:1,components:[{type:2,style:4,label:'End battle',custom_id:`${namespace}:${id}:${revision}:${namespace==='raidtest'?'retreat':'end_battle'}`}]});
  components.push({type:17,accent_color:0xc9a967,components:player});
  const statuses=[];
  if(s.charmTurns)statuses.push(`Charm: ${s.charmTurns} turn(s)`);
  if(s.config.job==='paladin'){const P=require(path.join(root,'raid-engine/paladin-rules.cjs')),n=P.stacks(s);if(n)statuses.push(`Blessing: ${n}/${P.BLESSING_MAX_STACKS} stacks · Smite +${P.protectionBonus(s)}% / CRIT +${n*P.BLESSING_CRIT_PER_STACK}% · ${P.offensiveTurns(s)} turn(s)`);if(s.protectionTurns)statuses.push(`Blessing DEF +100%: ${s.protectionTurns} turn(s)`);}if(s.config.job==='paladin')statuses.push(`Blessing casts: ${s.paladinBlessing||0} · Divine Smash evolves at ${require('../raid-engine/paladin-rules.cjs').threshold(s)}`);if(s.config.job==='berserker')statuses.push(`Charge: ${s.berserkerCharge||0}/3 · Unguarded normal hits: ${s.unguardedNormalHits||s.berserkerUnguardedNormalHits||0}/2`);
  if(s.overheatTurns)statuses.push(`Blade Trance: ${s.overheatTurns} turn(s)`);
  if(s.offerEffects?.remaining){const o=s.offerEffects;statuses.push(`Contract: ${o.remaining} turn(s)${o.incoming?' · Damage taken '+Math.round(o.incoming*100)+'%':''}${o.outgoing?' · Damage dealt '+Math.round(o.outgoing*100)+'%':''}`);}
  const statusCards=effectsCard?(Array.isArray(effectsCard)?effectsCard:[effectsCard]):[];
  // Keep detailed effects outside the character/controls container, as in v1.4.
  if(statusCards.length){for(const card of statusCards){files.push(card);components.push(gallery(card.name,card.description||'Buffs and Debuffs'));}}
  else {
   if(s.contractPenalty?.turns>0){const p=s.contractPenalty;statuses.push(`Contract Vulnerability · Damage taken +100% · ${p.turns} turn(s) remaining${s.turn<p.startTurn?' · starts next turn':''}`);}
   if(statuses.length)components.push(text('**Buffs / Debuffs**\n'+statuses.join('\n')));
  }
  if(!production)components.push(text('-# Isolated v2.0 Playtest · No XP, points, items, rankings, or saved profile changes.'));
  return {flags:32768,attachments:[],files,components,allowedMentions:{parse:[]}};
 }
 return {render,scene};
}
module.exports={createRenderer,LABEL,TITLES,displaySession,cardSession,legacyProviders,gimmickModel,gimmickSVG};
