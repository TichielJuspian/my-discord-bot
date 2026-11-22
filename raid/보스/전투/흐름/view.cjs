const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Rules=require('./rules.cjs'),LastTurn=require('./last-turn.cjs'),StatusPanels=require('./status-panels.cjs');
const {renderPanel}=require('../raid-panel-delta.cjs');
const UltimateArt=require('../../../클래스/card-v23/ultimate-art.cjs');
const LABEL={charge:'Charge',blood_transfusion:'Blood Draw',bloodletting:'Blood Draw',shoulder_tackle:'Tackle',tackle:'Tackle',smash:'Smash',blessing:'Blessing',heal:'Heal',purification:'Purification',guard:'Phys. Guard',magic_guard:'Magic Guard',attack:'Attack',thrust:'Thrust',slash:'Slash',ultimate:'Ultimate',parry:'Phys. Parry',magic_parry:'Magic Parry',emergency_evade:'Evade',offer_yes:'Sign',offer_no:'No',offer_next:'NEXT',end_battle:'End battle'};
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
 const a={...session,state:structuredClone(session.state),cardFrame:frame};
 a.state.hp=LastTurn.displayedHP(frame).hp;
 if(frame.characterPose==='idle'||frame.interactive===true)a.state.log.push({turn:a.state.turn,phase:a.state.phase,action:'idle',berserker:a.state.config.job==='berserker'&&require('../../../클래스/광전사/berserker-rules.cjs').stage(a.state)>0?{action:'charge'}:{},displayOnly:true});
 else if(['hit','enrage-hit'].includes(frame.characterPose))a.state.log.push({turn:a.state.turn,phase:a.state.phase,action:'display_hit',incoming:1,berserker:{chargeBroken:true},displayOnly:true});
 if(a.state.offerEffects?.remaining)a.state.offer={...a.state.offerEffects};
 return a;
}
// Gimmick progress is embedded in Last Turn. Use only the current v2 frame.
function gimmickModel(frame){
 const s=frame.state;
 if(s.status!=='active'||!['gimmick_a','gimmick_b','gimmick_success'].includes(frame.kind))return null;
 const required=Math.max(1,Number(s.gimmickRequired)||2),hits=Math.max(0,Math.min(required,Number(s.gimmickHits)||0));
 const hint=frame.kind==='gimmick_success'?'':'Attack does not interrupt (except for Berserker).';
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
 const load=file=>require(runtimePaths.join(root,file));
 const textBounds=require('./battle-log-render.cjs').createTextBounds(root);
 return {
  bossPanel:(a,name,file,source)=>load('raid-boss-panel.js').asset(a,name,file,{root,source,stage:a.state.director.enrageLevel||0}),
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
   const options={map:artMap,wrap:feed.wrap,textBounds,impactIcon:log=>load('raid-impact-icon.js').asset(log).attachment.toString('base64'),symbol:load('raid-log-symbols.js').svg,gimmick:gimmickModel(frame),totalDamage:s.totals?.damage||0,legacy:m};
   const stamps=require('./stamp-log-render.cjs'),model=LastTurn.presentation(frame,options);
   const planned=stamps.plan(frame,model);
   return renderPanel(a.panelRefs,'log',planned.key,()=>{
    const drawing=stamps.asset(frame,model,options,planned);
    return {name:'battle-feed-'+drawing.contentKey+'.'+drawing.extension,attachment:drawing.attachment,...(drawing.logRaw?{logRaw:drawing.logRaw}:{}),description:drawing.description};
   });
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
   return StatusPanels.buildBattleStatusText({state:s,visible,list});
  }
 };
}
function createRenderer({root=runtimePaths.join(runtimePaths.directory("raid15"),'..'),map=null,read=fs.readFileSync,exists=fs.existsSync,legacyPanels=true,legacy=null,presentationLayout="two-piece"}={}){
 if(!map){try{map=require(runtimePaths.join(root,'succubus-art-20261113/boss-art-map.json'));}catch{map={states:{}};}}
 const assetRoot=runtimePaths.join(root,'raid15/assets');
 function scene(frame,rememberCheckedBytes){
  const action=frame.log?.requestedAction||frame.log?.action||frame.lastTurn?.log?.action;
  const supportOnly=['charge','blood_transfusion','bloodletting','blessing','prayer','heal','purification'].includes(action)&&!(frame.log?.damage>0);
  // A support cast cannot hit the boss. Keep its current waiting/preparation
  // pose instead of flashing idle in the middle of curse/gimmick/stagger scenes.
  // Also tolerate saved presentation frames that labelled a support cast reaction.
  if(frame.kind==='support'||frame.kind==='reaction'&&supportOnly){
   const phase=frame.state.phase;
   const kind=phase==='defense'?'prep':phase==='ragnarok_defense_a'?'ragnarok_a':['gimmick_a','gimmick_b','stagger_a','stagger_b','ragnarok_a','ragnarok_b'].includes(phase)?phase:'idle';
   frame={...frame,kind};
  }
  const s=frame.state,stage=s.director.enrageLevel||0;
  if(frame.kind==='ultimate_hit'||frame.kind==='cancelled'||frame.kind==='reaction'&&frame.reaction==='hit'&&frame.log?.ultimate){
   const key=s.config.job==='berserker'?'berserkerUltimateHit':s.config.job==='paladin'?'paladinUltimateHit':'warriorUltimateHit';
   const image=map.states[key]?.image,cut=image&&runtimePaths.join(root,'succubus-art-20261113',image);
   // Missing catalog art should still depict a hit, never an evade or idle.
   return cut&&exists(cut)?cut:runtimePaths.join(assetRoot,'10 Hit_Reaction.jpg');
  }
  if(frame.kind==='reaction')return runtimePaths.join(assetRoot,({hit:'10 Hit_Reaction.jpg',guard:'11 Guard.jpg',evade:'12 Dodge.jpg'})[frame.reaction]||'10 Hit_Reaction.jpg');
  if(frame.kind==='prep'&&s.pattern.kind==='N')return runtimePaths.join(assetRoot,stage?'01 Enraged_Attack Prep.jpg':'01 Attack Prep.jpg');
  if(frame.kind==='curse_interrupted'){
   const image=map.states.curseFailed?.image;
   if(image){
    const candidate=runtimePaths.join(root,'succubus-art-20261113',image);
    if(exists(candidate)){
     try{
      const bytes=read(candidate);
      if(Buffer.isBuffer(bytes)&&bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9){rememberCheckedBytes?.(bytes);return candidate;}
     }catch{}
    }
   }
   const hit=map.states[stage?'enragedHit':'hit']?.image||map.states.hit?.image;
   const fallback=hit&&runtimePaths.join(root,'succubus-art-20261113',hit);
   return fallback&&exists(fallback)?fallback:runtimePaths.join(assetRoot,'10 Hit_Reaction.jpg');
  }
  let key=imageKeys[frame.kind];
  if(frame.kind==='prep')key=s.pattern.kind==='H'?'heavyPrepare':'cursePrepare';
  if(frame.kind==='boss_attack')key=s.pattern.kind==='N'?'basic'+frame.hitIndex:'heavy';
  if(frame.kind==='contract_result')key=frame.choice==='yes'?'offerYes':'offerNo';
  if(frame.kind==='ended')key=frame.aborted?'idle':s.status==='victory'?'defeated':'playerExhausted';
  if(frame.kind==='evaded'&&(frame.pattern?.kind||s.pattern?.kind)==='C')key='curse';
  if(frame.kind==='enrage'||key==='idle'||frame.kind==='evaded'&&key!=='curse')key=stage>=3?'enragedIdle3':stage===2?'enragedIdle2':stage===1?'enragedIdle':'idle';
  else {const enraged='enraged'+(key||'')[0]?.toUpperCase()+(key||'').slice(1);if(stage&&map.states[enraged])key=enraged;}
  // A genuine third cut is preferred; no relabelled v1.4 wing pattern is executed.
  if(!map.states[key]&&frame.kind==='boss_attack'&&frame.hitIndex===3)key=stage&&map.states.enragedBasic2?'enragedBasic2':'basic2';
  const value=map.states[key]?.image;
  return value?runtimePaths.join(root,'succubus-art-20261113',value):null;
 }
 const text=content=>({type:10,content});
 const gallery=(name,description)=>({type:12,items:[{media:{url:'attachment://'+name},description}]});
 function render({id,revision,frame,engine,ready,playerName,namespace='raid15',production=false,activeSession,panelRefs}){
  if(!['raid15','raidtest'].includes(namespace))throw new Error('Unknown battle control namespace');
  const s=frame.state,files=[],components=[],session=displaySession(id,frame,{playerName,activeSession});
  const twoPiece=presentationLayout!=="legacy";
  session.panelRefs=twoPiece?undefined:panelRefs;
  const showGuide = /^(skills|guide_(core|growth|passives))$/.test(activeSession?.view || '');
  let checkedBytes;
  let desired=scene(frame,bytes=>{checkedBytes=bytes;}),fallback=false;
  if(!desired||!exists(desired)){
   fallback=true;
   const idleStage=s.director.enrageLevel||0,idleKey=idleStage>=3?'enragedIdle3':idleStage===2?'enragedIdle2':idleStage===1?'enragedIdle':'idle';
   const idle=map.states[idleKey]?.image;desired=idle?runtimePaths.join(root,'succubus-art-20261113',idle):null;
   if(!desired||!exists(desired))desired=runtimePaths.join(assetRoot,idleStage?'01 Enraged_Attack Prep.jpg':'01 Attack Prep.jpg');
  }
  const sceneBytes=desired&&exists(desired)?checkedBytes||read(desired):null;
   let characterCard,feedCard,effectsCard;
  // Resolve separately so one missing portrait never removes the combat log/effects.
  const providers=legacyPanels?(legacy||legacyProviders(root)):{};
  const metrics={};
  function timed(name,run){const start=performance.now();try{return run();}finally{metrics[name]=Math.round(performance.now()-start);}}
   const bossName='Nameless Succubus';
   const bossArt=sceneBytes?timed('bossPanel',()=>require('../raid-boss-art-v34.cjs').asset(sceneBytes,desired,bossName,session.panelRefs)):null;
  try{characterCard=timed('character',()=>providers.character?(UltimateArt.art(frame,session.panelRefs)||providers.character(cardSession(session,frame))):undefined);}catch(error){console.warn('[RAID PANEL CHARACTER]',error.code||error.name,error.message);throw error;}
  try{if(!twoPiece)feedCard=timed('log',()=>providers.feed?.(session,frame));}catch(error){console.warn('[RAID PANEL FEED]',error.code||error.name,error.message);throw error;}
  try{if(!showGuide)effectsCard=timed('effects',()=>providers.effects?.(session,frame));}catch(error){console.warn('[RAID PANEL EFFECTS]',error.code||error.name,error.message);}
  if(frame.kind==='boss_attack')console.warn('[RAID PANEL CPU]',JSON.stringify({job:s.config.job,turn:s.turn,hit:frame.hitIndex,...metrics,characterPose:characterCard?.description}));
   const dialogue=twoPiece?require('./raid-two-piece-model.cjs').contractDisplay(frame):null;
  const dialogueAlt=dialogue?require('./raid-two-piece-model.cjs').contractDescription(dialogue):null;
  if(bossArt){files.push(dialogueAlt?{...bossArt,description:dialogueAlt}:bossArt);components.push(gallery(bossArt.name,dialogueAlt||bossName));}
  const result=[];
  if(frame.kind==='contract_result'&&!dialogue&&(twoPiece||!LastTurn.projection(frame,map))){
   result.push(frame.choice==='yes'?'Bargain accepted.':'Offer refused.');
   if(frame.choice==='no')result.push(`Refusals: **${frame.refusals}/3**`);
   if(frame.choice==='no'&&frame.refusals===3)result.push('Damage taken +100% for the next 3 turns.');
   try{const details=require(runtimePaths.join(root,'raid-devil-offer-view.js')).result(s);if(details)result.push(details);}catch{}
  }
  const l=frame.log||s.log.at(-1);
  if(dialogue&&!bossArt)result.push(dialogueAlt);
  if(feedCard){files.push(feedCard);components.push(gallery(feedCard.name,feedCard.description||'Last combat turn result'));}
  else if(!twoPiece||!bossArt) {const lines=['**'+LastTurn.turnLabel(frame)+'** · Total damage '+Math.max(0,s.totals.damage-((LastTurn.comboAt(frame,map)&&!LastTurn.comboAt(frame,map).final)?(frame.lastTurn.log.attackLog?.damage||0):0))],display=LastTurn.projection(frame,map);if(display){lines.push('Your action: '+display.own,'Boss action: '+display.boss);if(display.receivedTotal)lines.push(display.receivedTotal);if(display.ownDetail)lines.push(display.ownDetail);const gauge=gimmickModel(frame);if(gauge)lines.push('Boss action: '+gauge.description);if(display.bossDetail)lines.push(display.bossDetail);}else if(l){lines.push(`Your action: ${l.action==='smash'&&s.config.job==='paladin'?(typeof l.paladin?.divineSmite==='boolean'?l.paladin.divineSmite:require('../../../클래스/성기사/paladin-rules.cjs').evolved(s))?'Divine Smash':'Smash':LABEL[l.action]||l.action} · Damage dealt ${l.damage||0}`,`Boss action: Damage taken ${l.incoming||0}${l.parryResult?' · '+l.parryResult.toUpperCase()+' PARRY':''}`);if(l.counterDamage)lines.push('Counter: '+l.counterDamage+' damage');if(l.energyStart!=null)lines.push('Energy '+l.energyStart+' → '+l.energyEnd);const healed=(l.heal||0)+(l.paladin?.divineHeal||0)+(l.paladin?.smiteHeal||0)+(l.warrior?.thrustHeal??l.warrior?.sixthSenseHeal??0);if(healed)lines.push(`HP recovered ${healed}`);if(l.chargeBroken)lines.push('CHARGE BROKEN! '+(l.chargeBreakText||'Charge reset.'));}else lines.push('Your action:', 'Boss action:');if(LastTurn.guardOutcome(frame))lines.push(LastTurn.guardOutcome(frame));components.push(text(lines.join('\n')));}
  if(fallback)result.push('Cutscene fallback active.');
  if(result.length)components.push(text(result.join('\n')));
  const player=[],defenseMenu=[],defenseLayout=['prep','gimmick_a','gimmick_b'].includes(frame.kind);
  if(characterCard){files.push(characterCard);player.push(gallery(characterCard.name,(UltimateArt.isActivation(frame)&&s.config.job!=='paladin'?className(s)+' Ultimate':className(s)+' status')));}
  else player.push(text(`**${s.config.job==='paladin'?'Paladin':s.config.job==='berserker'?'Berserker':'Blader'} · Level ${s.config.level}**\nHP ${s.hp} / ${s.stats.hp} · Energy ${s.energy} / ${s.maxEnergy}`));
  if(ready){
   const ultimateLeft=Math.max(0,(s.config.level>=90?2:1)-(s.ultimateUses??Number(!!s.ultimateUsed)));
   const evadeLeft=Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses??Number(!!s.emergencyUsed)));
   const all=(frame.kind==='contract'?['offer_yes','offer_no']:frame.kind==='contract_result'?['offer_next']:['prep','gimmick_a','gimmick_b'].includes(frame.kind)?(engine.defenseActions||Rules.DEFENSE_ACTIONS):(engine.attackActions||Rules.ATTACK_ACTIONS)).filter(action=>action!=='purification'||require('../../../클래스/성기사/purification.cjs').removable(s));
   const available=engine.actions();
   const actionLabel=action=>{if(action==='purification')return 'Purification';if(action==='smash'&&s.config.job==='paladin')return require('../../../클래스/성기사/paladin-rules.cjs').evolved(s)?'Divine Smash':'Smash';if(action==='attack'&&s.config.job==='berserker'){const B=require('../../../클래스/광전사/berserker-rules.cjs'),stage=B.stage(s);if(stage)return B.names[stage]+(['',' +2E',' +1E',''][stage]);return ['gimmick_a','gimmick_b'].includes(s.phase)||s.phase==='defense'&&s.pattern?.kind==='C'?'Power Attack':'Attack';}return LABEL[action]||action;};
   const buttons=all.map(action=>{const info=action.startsWith('offer_')?{}:engine.actionInfo?.(action)||{};let label=action==='thrust'?(s.hone||0)>=require('../../../클래스/검사/warrior-rules.cjs').threshold(s)?'Deep Thrust':'Thrust':actionLabel(action);if(label==='Power Attack')label+=' -1E';else if(info.cost>0)label+=' · -'+info.cost+'E';if(action==='ultimate')label+=' · '+ultimateLeft+' left';if(action==='emergency_evade')label='Evade · '+evadeLeft+' left';return {type:2,style:action==='offer_yes'?1:action==='offer_no'?4:['ultimate','emergency_evade'].includes(action)?3:['thrust','slash','smash','charge','blood_transfusion','heal','blessing'].includes(action)?1:2,label,custom_id:`${namespace}:${id}:${revision}:${action}`,disabled:!available.includes(action)||(action==='ultimate'&&ultimateLeft===0)||(action==='emergency_evade'&&evadeLeft===0)};});
   const attackSet=new Set(engine.attackActions||Rules.ATTACK_ACTIONS);
   const utility=action=>action==='ultimate'||action==='emergency_evade';
   const groups=defenseLayout?[
    buttons.filter((b,i)=>!utility(all[i])&&(s.config.job==='paladin'?['guard','magic_guard','heal','blessing'].includes(all[i]):!attackSet.has(all[i]))),
    buttons.filter((b,i)=>!utility(all[i])&&(s.config.job==='paladin'?['attack','smash','purification'].includes(all[i]):attackSet.has(all[i])))
   ]:!['contract','contract_result'].includes(frame.kind)?[buttons.filter((b,i)=>!utility(all[i])),buttons.filter((b,i)=>utility(all[i]))]:[buttons];
   if(defenseLayout){
    const utilityButtons=buttons.filter((b,i)=>utility(all[i]));
    if(production&&namespace==='raidtest')defenseMenu.push(...utilityButtons);
    else groups.push(utilityButtons);
   }
   for(const group of groups)for(let n=0;n<group.length;n+=5)player.push({type:1,components:group.slice(n,n+5)});
  }
  const menuOpen=activeSession?.view==='menu';
  if(production&&namespace==='raidtest'&&ready){
   const button=(action,label,style=2)=>({type:2,style,label,custom_id:`${namespace}:${id}:${revision}:${action}`});
   const toggle=button(menuOpen?'battle':'menu',menuOpen?'Close Menu':'Menu');
   // Menu has a dedicated row in both phases; a spent ultimate remains disabled.
   player.push({type:1,components:[...defenseMenu,toggle]});
   if(menuOpen)player.push({type:1,components:[button('skills','Skill guide'),button('retreat','End battle',4)]});
  }else if(ready||frame.kind==='ended'&&!frame.aborted)player.push({type:1,components:[{type:2,style:4,label:'End battle',custom_id:`${namespace}:${id}:${revision}:${namespace==='raidtest'?'retreat':'end_battle'}`}]});
  player.forEach(require('../raid-button-icons.js').decorate);
  components.push(...player);
  if (showGuide) {
   const guide = require('../../../클래스/selection-reader.cjs').guideBody(s.config.job);
   components.push({type:1,components:[{
    type:2,style:2,label:'Back',custom_id:namespace+':'+id+':'+revision+':battle'
   }]});
   files.push(...guide.files);
   components.push(...guide.components);
   return {flags:32768,attachments:[],files,components,allowedMentions:{parse:[]},...(twoPiece?{twoPiece:{bossName:bossArt?.name,cardName:characterCard?.name,overlay:require("./raid-two-piece-model.cjs").overlayFor(frame,{gauge:gimmickModel(frame),cinematic:characterCard?.ultimateArt===true})}}:{})};
  }
  const statuses=[];
  if(s.charmTurns)statuses.push(`Charm: ${s.charmTurns} turn(s)`);
  if(s.config.job==='paladin'){const P=require(runtimePaths.join(root,'raid-engine/paladin-rules.cjs')),n=P.stacks(s);if(n)statuses.push(`Blessing: ${n}/${P.BLESSING_MAX_STACKS} stacks · Smash +${P.protectionBonus(s)}% / CRIT +${n*P.BLESSING_CRIT_PER_STACK}% · ${P.offensiveTurns(s)} turn(s)`);if(s.protectionTurns)statuses.push(`Blessing DEF +40%: ${s.protectionTurns} turn(s)`);}if(s.config.job==='paladin')statuses.push(`Blessing casts: ${s.paladinBlessing||0} · Divine Smash evolves at ${require('../../../클래스/성기사/paladin-rules.cjs').threshold(s)}`);if(s.config.job==='berserker')statuses.push(`Charge: ${s.berserkerCharge||0}/3 · Unguarded normal hits: ${s.unguardedNormalHits||s.berserkerUnguardedNormalHits||0}/2`);
  if(s.overheatTurns)statuses.push(`Blade Trance: ${s.overheatTurns} turn(s)`);
  if(s.offerEffects?.remaining){const o=s.offerEffects;statuses.push(`Contract: ${o.remaining} turn(s)${o.incoming?' · Damage taken '+Math.round(o.incoming*100)+'%':''}${o.outgoing?' · Damage dealt '+Math.round(o.outgoing*100)+'%':''}`);}
  const statusCards=effectsCard?(Array.isArray(effectsCard)?effectsCard:[effectsCard]):[];
  // Keep detailed effects after the character card and controls.
  if(statusCards.length){
    const effectText=statusCards.map(card=>text(card.content));
    components.push({type:14,divider:true,spacing:1},...(statusCards.every(card=>card.group)?StatusPanels.battleStatusBoxes(statusCards):[{type:17,components:effectText}]));
   }
  else {
   if(s.contractPenalty?.turns>0){const p=s.contractPenalty;statuses.push(`Contract Vulnerability · Damage taken +100% · ${p.turns} turn(s) remaining${s.turn<p.startTurn?' · starts next turn':''}`);}
   if(statuses.length)components.push({type:14,divider:true,spacing:1},{type:17,components:StatusPanels.formatBattleStatusRows([statuses]).map(card=>text(card.content))});
  }
  if(!production)components.push(text('-# Isolated v2.0 Playtest · No XP, points, items, rankings, or saved profile changes.'));
  return {flags:32768,attachments:[],files,components,allowedMentions:{parse:[]},...(twoPiece?{twoPiece:{bossName:bossArt?.name,cardName:characterCard?.name,overlay:require("./raid-two-piece-model.cjs").overlayFor(frame,{gauge:gimmickModel(frame),cinematic:characterCard?.ultimateArt===true})}}:{})};
 }
  return {render,scene};
}
module.exports={createRenderer,LABEL,TITLES,displaySession,cardSession,legacyProviders,gimmickModel,gimmickSVG};

