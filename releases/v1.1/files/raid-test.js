'use strict';
const {randomBytes,randomInt}=require('node:crypto');
const R=require('./raid-engine/progression-combat.cjs');
const registry=require('./raid-boss-registry');
const OWNER='170947916167512064',GUILD='495716062097309697',TTL=24*60*60*1000;
const MODERATOR_ROLE='495727371140202506';
const LABEL={attack:'Attack',thrust:'Thrust · 2 energy',guard:'Guard',parry:'Parry · 1 energy',cleanse:'Cleanse',break_part:'Break Part',retreat:'End Battle'};
const PHASE={normal:'Normal attack',flurry:'Multi-hit attack',warning:'Heavy attack warning — no direct hit',heavy:'Heavy attack',mark_warning:'Mark warning',mark:'Mark applied',struggle_start:'Clash begins — deal damage',struggle:'Clash — deal damage',struggle_end:'Clash check',part_warning:'Break the part',part_check:'Part-break check',opening:'Opening — bonus damage'};
// Keep default deny. The server command permission grants this one command to MODERATOR_ROLE.
const RAIDSET={name:'raidset',description:'Start or inspect automatic 23-hour raid rotation',default_member_permissions:'0',dm_permission:false};
const RAIDSETSTOP={name:'raidsetstop',description:'Stop automatic rotation after the current raid settles',default_member_permissions:'0',dm_permission:false};
const COMMAND={name:'raidtest',description:'Reset all beta raids and create one fresh boss lobby. No rewards.',default_member_permissions:'0',dm_permission:false,options:registry.enabledBosses().map(b=>({type:1,...b.testCommand}))};
function payload(session){
 if(require('./raid-engine/devil-offer.cjs').pending(session.state))return require('./raid-devil-offer-view').payload(session);
 const s=session.state,last=s.log.at(-1),ended=s.status!=='active',phase=R.phase(s),available=R.actions(s),upgrade=s.enhancements.weapon;
 const fields=[
 {name:'Warrior',value:`Level ${s.config.level} · Slots +${upgrade}\nHP **${s.hp}/${s.stats.hp}** · Energy **${s.energy}/${s.maxEnergy}**`,inline:true},
 {name:'Damage',value:`Total **${s.totals.damage}**\nBoss HP **${s.bossHP}/${s.bossMaxHP||require('./raid-boss-health').maximum(s.config.boss)}**`,inline:true},
 {name:ended?'Result':'Next boss pattern',value:ended?`${s.status.toUpperCase()} · ${s.turn-1} turns completed`:PHASE[phase]||phase},
 {name:'Build',value:`ATK ${s.stats.attack} · DEF ${s.stats.defense} · Crit ${s.stats.crit}%\nPower ${s.config.power} / Focus ${s.config.focus} / Ruin ${s.config.ruin}`},
 {name:'Rules',value:`Auto-counter 60% · Counter damage 30% ATK\nOn counter proc: block floor(DEF × 30%) direct damage once\nParry ${Math.round(s.config.warriorParryChance*100)}% · Perfect: 20% of successes\nSuccessful parry: next attack +${10+s.config.level-1} damage\nNo ultimate. No XP, points or item rewards.`}
 ];
 if(last)fields.splice(3,0,{name:`Turn ${last.turn} · ${LABEL[last.action]||last.action}`,value:`Attack **${last.damage}**${last.critical?' (critical)':''} · Counter **${last.counterDamage}**\nDamage taken: direct ${last.incoming}, ongoing ${last.dot}, mechanic ${last.mechanicDamage||0}\n${last.parryResult?'Parry: '+last.parryResult+' · ':''}${require('./raid-energy-log').format(last)}`});
 const names=ended?['retreat']:['attack','thrust','guard','parry',...(available.includes('cleanse')?['cleanse']:[]),...(available.includes('break_part')?['break_part']:[]),'retreat'];
 const components=[];for(let n=0;n<names.length;n+=5)components.push({type:1,components:names.slice(n,n+5).map(action=>({type:2,style:action==='retreat'?4:action==='thrust'?1:2,label:LABEL[action],custom_id:`raidtest:${session.id}:${s.turn}:${action}`,disabled:action!=='retreat'&&!available.includes(action)}))});
 return {content:'**PRIVATE RAID TEST** · Only you can operate this battle.',embeds:[{title:`${R.BOSSES[s.config.boss].name} — Warrior test`,color:0x5865f2,fields,footer:{text:'No action = no turn passes. /raidtest resumes; restart:true starts over. Restarting the bot clears tests.'}}],components,allowedMentions:{parse:[]}};
}
function createPersonalRaidTest({ownerId=OWNER,guildId=GUILD,clock=Date.now,renderBattle=true,readServerLevel=require('./raid-server-level').readServerLevel,sharedLobby=null,characterStore=null,canResetClass=()=>true,onBattleEnded=()=>{},battleIdleMs=10*60*1000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let session=null,starting=false,pendingRules=null,pendingClass=null,generation=0;
 let idleTimer=null;
 function armIdle(){clearTimer(idleTimer);idleTimer=null;if(!session||session.finished||session.state.status!=='active')return;idleTimer=setTimer(()=>{if(!expireIdle())armIdle();},Math.max(1000,session.touched+battleIdleMs-clock()));idleTimer?.unref?.();}
 function settle(active,i=active?.displayReply,record=true){
  if(!active||active.finished)return false;
  clearTimer(idleTimer);idleTimer=null;
  if(active.state.status==='active')active.state=R.step(active.state,'retreat');
  if(record&&renderBattle)lobby.record(active,ownerId);
  lobby.abandon?.(active.state,ownerId);
  if(session===active)session=null;
  active.finished=true;require('./raid-render-worker').release(active.id);active.attachmentMemo=null;active.mediaAttachments=null;onBattleEnded();
  if(i)void require('./raid-finish-battle').finishBattle(i,active,renderBattle?()=>lobby.refresh():null).catch(e=>report('[RAID FINISH]',e));
  else if(renderBattle)void lobby.refresh().catch(e=>report('[RAID FINISH]',e));
  return true;
 }
 function expireIdle(){
  if(pendingRules&&clock()-pendingRules.created>300000)pendingRules=null;
  if(pendingClass&&clock()-pendingClass.created>300000)pendingClass=null;
  if(!session||session.finished||session.busy||starting||clock()-session.touched<battleIdleMs)return false;
  return settle(session);
 }
 const characters=characterStore||require('./raid-characters').createStore();
 const lobby=sharedLobby||require('./raid-lobby').createLobby({clock});
 const display=(active,initial=false)=>{
  if(!renderBattle)return payload(active);
  if(['equipment','inventory'].includes(active.view)){const saved=characters.get(guildId,ownerId);active.inventoryItems=saved.items;active.workshopAccount=saved.workshop;}
  const panel=require('./raid-render-worker').render(active,R.BOSSES[active.state.config.boss].name,PHASE[R.phase(active.state)]||R.phase(active.state),initial);
 
  return panel;
 }; const relevant=i=>(i.isChatInputCommand?.()&&i.commandName==='raidtest')||((i.isButton?.()||i.isStringSelectMenu?.())&&i.customId?.startsWith('raidtest:'));
 const report=(tag,e)=>console.error(tag,e?.code||e?.name||'InteractionError');
 const say=async(i,content)=>{try{if(i.deferred)await i.editReply({flags:32768,components:[{type:10,content}],attachments:[],allowedMentions:{parse:[]}});else await i.reply({content,ephemeral:true,allowedMentions:{parse:[]}});}catch(e){report('[RAID REPLY]',e);}};
 async function classes(i,update=false){
  const profile=characters.get(guildId,ownerId),menu={id:randomBytes(6).toString('hex'),created:clock(),revision:profile.revision,job:profile.job||'warrior',page:'overview',level:1};pendingClass=menu;
  if(!i.deferred){if(update)await i.deferUpdate();else await i.deferReply({ephemeral:true});}
  menu.level=await readServerLevel(guildId,ownerId);if(!Number.isInteger(menu.level)||menu.level<1||menu.level>100)throw Error('Invalid guide level');
  await i.editReply(require('./raid-class-view').payload(menu.id,profile,menu));
 }
 async function updateDisplay(i,active,initial=false){
 if(active.finished)return;
 const displayGeneration=generation,valid=()=>!active.finished&&session===active&&displayGeneration===generation;
 // Attachment IDs belong to a message, not the battle. A resumed panel is a new message.
 const messageId=i.message?.id;
 const rebuild=initial||active.displayDirty||(messageId&&active.displayMessageId!==messageId);
 let message;
 const started=performance.now();let rendered=started;
 try{const body=await display(active,rebuild);if(!valid())return;const prepared=require('./raid-attachment-cache').prepare(active,body,i.message);rendered=performance.now();message=await i.editReply(prepared.body);if(!valid())return;require('./raid-attachment-cache').remember(active,message,prepared.signatures);}
 catch(e){
  if(!valid())return;
  active.displayDirty=true;
  report('[RAID DISPLAY RETRY]',e);
  if(e?.rawError?.errors)console.error('[RAID VALIDATION]',JSON.stringify(e.rawError.errors));
  // Retry the same committed turn with a complete attachment set, never replay combat.
  const body=await display(active,true);if(!valid())return;const prepared=require('./raid-attachment-cache').prepare({...active,attachmentMemo:null},body,messageId);message=await i.editReply(prepared.body);if(!valid())return;require('./raid-attachment-cache').remember(active,message,prepared.signatures);
 }
 const memory=require('./raid-runtime-metrics')();
 console.info('[RAID TIMING]',JSON.stringify({turn:active.state.turn,renderMs:Math.round(rendered-started),updateMs:Math.round(performance.now()-rendered),memory}));
 if(active.state.status!=='active')require('./raid-render-worker').release(active.id);
 active.displayReply=i;armIdle();active.displayDirty=false;active.displayMessageId=message?.id||messageId||active.displayMessageId;
 if(renderBattle&&!['skills','effects','menu','equipment','inventory'].includes(active.view)&&!require('./raid-engine/devil-offer.cjs').pending(active.state)){
  if(message?.attachments)active.mediaAttachments=[...message.attachments.values()].map(x=>({id:x.id,filename:x.name}));
  // The child returns rendered media names; never rasterize again in the bot process.
 }
 }
 async function reopenDisplay(i,active){
  const displayGeneration=generation,valid=()=>!active.finished&&session===active&&generation===displayGeneration;
  // Stage only presentation data. Never sync HP, rebuild the character, step combat or settle here.
  const panel={...active,view:null,motionStage:null,motionBefore:null,cutsceneResult:false,attachmentMemo:null,mediaAttachments:null};
  const previousReply=active.displayReply,previousMessageId=active.displayMessageId;
  // A retried preparation callback may already target the current window via deferUpdate.
  // It cannot create a fresh reply, and must never edit or discard that confirmed window.
  if(previousMessageId&&(i.deferred||i.replied)&&i.message?.id===previousMessageId)throw Error('Reopen from Join Battle or Resume in the boss lobby');
  const discard=()=>require('./raid-async').bounded(()=>i.deleteReply()).catch(e=>report('[RAID REOPEN CLEANUP]',e));
  try{
   if(!i.deferred)await i.deferReply({ephemeral:true});
   if(!valid()){await discard();return false;}
   const body=await display(panel,true);
   if(!valid()){await discard();return false;}
   // i.message is the public lobby, not the new private reply. Never reuse its attachments.
   const prepared=require('./raid-attachment-cache').prepare(panel,body,null);
   // One publication only: an uncertain response must not create or activate another window.
   const response=await i.editReply(prepared.body),message=response?.resource?.message||response?.message||response;
   if(!valid()){await discard();return false;}
   if(!message?.id||message.id===previousMessageId)throw Error('Fresh battle message was not confirmed');
   require('./raid-attachment-cache').remember(panel,message,prepared.signatures);
   // Commit the new control owner synchronously, before attempting best-effort old UI cleanup.
   active.view=null;active.motionStage=null;active.motionBefore=null;active.cutsceneResult=false;
   active.displayReply=i;active.displayMessageId=message.id;active.displayDirty=false;
   active.attachmentMemo=panel.attachmentMemo;active.mediaAttachments=null;
   active.renderedBoss=panel.renderedBoss;active.renderedProfile=panel.renderedProfile;
   active.touched=clock();armIdle();
   if(previousReply)void require('./raid-async').bounded(()=>previousReply.deleteReply()).catch(e=>report('[RAID OLD WINDOW]',e));
   return true;
  }catch(e){
   // Leave the old confirmed window and all combat data intact on failure or ambiguity.
   await discard();throw e;
  }
 }
 async function handle(i,preparedEntry=false,epoch=generation){
 if(!preparedEntry&&!relevant(i))return false;
 if(i.user?.id!==ownerId||i.guildId!==guildId){await say(i,'This test is available only to the server owner account.');return true;}
 // Reject replaced/unknown controls before touching the lobby's active-attempt lease.
 const control=/^raidtest:([a-f0-9]{12}):\d+:[a-z_]+$/.exec(i.customId||'');
 if(renderBattle&&control&&(!session||control[1]!==session.id||!session.displayMessageId||session.displayMessageId!==i.message?.id)){await say(i,'This battle panel has expired. Use Join Battle in the raid lobby.');return true;}
 expireIdle();
 if(session&&lobby.touch&&!lobby.touch(session.state,ownerId))settle(session,session.displayReply,false);
 if(renderBattle&&i.isChatInputCommand()){await lobby.publish(i,readServerLevel);return true;}
 if(renderBattle&&i.isButton?.()&&/^raidtest:board:(home|[0-3])$/.test(i.customId)){await i.deferUpdate();const page=i.customId.split(':')[2];await i.editReply(await lobby.rank(ownerId,page==='home'?null:Number(page)));return true;}
 const lobbyAction=preparedEntry?'join':renderBattle?lobby.match(i):null;
 if(renderBattle&&i.customId?.startsWith('raidtest:lobby:')&&!lobbyAction){await say(i,'This lobby has expired. Use /raidtest to open the current lobby.');return true;}
 if(lobbyAction?.startsWith('buff_')){await lobby.cast(i,lobbyAction.slice(5),readServerLevel);return true;}
 if(lobbyAction==='rank'){await i.deferReply({ephemeral:true});await i.editReply(await lobby.rank(ownerId,0));return true;}
 if(lobbyAction==='refresh'){await i.deferUpdate();await lobby.refresh();return true;}
 if(lobbyAction==='participation'){await say(i,lobby.entryCheck(ownerId).content||'Participation rewards are not enabled in this beta. No reward has been claimed.');return true;}
 let classConfirmed=false;
 const classMatch=/^raidtest:class:([a-f0-9]{12}):([a-z_]+)$/.exec(i.customId||'');
 if(lobbyAction==='class'){if(starting||session?.busy){await say(i,'One action is being processed. Try again shortly.');return true;}await classes(i);return true;}
 if(classMatch){
  if(starting||session?.busy){await say(i,'One action is being processed. Try again shortly.');return true;}
  if(!pendingClass||pendingClass.id!==classMatch[1]||clock()-pendingClass.created>300000){await say(i,'This class menu has expired. Use Join Battle or open /workshop.');return true;}
  starting=true;
  try{
   const action=classMatch[2],profile=characters.get(guildId,ownerId);
   if(['reset','confirm_reset'].includes(action)){await say(i,'Class changes are free during beta. End your battle and open /workshop > Class. Your reset potions are not consumed.');return true;}
   if(action==='cancel'){pendingClass=null;await i.deferUpdate();await say(i,'Class menu closed.');return true;}
   if(action==='choose'){
    if(!pendingClass.job){await say(i,'Choose a class and read its skills first.');return true;}
    const result=characters.choose(guildId,ownerId,pendingClass.job,pendingClass.revision);
    if(!result.ok){await say(i,result.reason);return true;}
    pendingClass=null;pendingRules=null;classConfirmed=true;await i.deferUpdate();
   }else if(action==='reset'||action==='confirm_reset'){
    if(!canResetClass(ownerId)){await say(i,'End your active battles before using a Class Reset Potion.');return true;}
    if(!profile.job||profile.items.class_reset<1){await say(i,'You need a selected class and one Class Reset Potion.');return true;}
    if(action==='reset'){
     pendingClass.resetRevision=profile.revision;await i.deferUpdate();await i.editReply({flags:32768,attachments:[],allowedMentions:{parse:[]},components:[{type:17,accent_color:0xc9a967,components:[{type:10,content:'## USE CLASS RESET POTION?\nConsumes **1 Class Reset Potion** and unlocks class selection. Your raid scores stay unchanged.'},{type:1,components:[{type:2,style:4,label:'Use 1 item',custom_id:'raidtest:class:'+pendingClass.id+':confirm_reset'},{type:2,style:2,label:'Cancel',custom_id:'raidtest:class:'+pendingClass.id+':cancel'}]}]}]});return true;
    }
    const result=characters.reset(guildId,ownerId,pendingClass.resetRevision);if(!result.ok){await say(i,result.reason);return true;}
    session=null;pendingRules=null;await classes(i,true);return true;
   }else{
    if(['warrior','paladin','berserker'].includes(action))pendingClass.job=action;
    else if(['overview','passives','core','advanced','growth'].includes(action)&&pendingClass.job)pendingClass.page=action;
    else {await say(i,'Choose a class first.');return true;}
    await i.deferUpdate();
    await i.editReply(require('./raid-class-view').payload(pendingClass.id,profile,pendingClass));return true;
   }
  }catch(e){report('[RAID CLASS]',e);await say(i,'Class menu unavailable. Open /workshop to check your class.');return true;}
  finally{starting=false;}
 }
 // Reopening creates only a fresh private message; never start, resolve or settle combat here.
 const joinRequested=['join','join_paladin'].includes(lobbyAction);
 if(lobbyAction==='resume'||(joinRequested&&session&&!session.finished&&(session.state.status==='active'||lobby.remainingHP<=0))){
  if(!session||session.finished){await say(i,'No saved battle is available for this boss. Use Join Battle in the lobby.');return true;}
  if(starting||session.busy){await say(i,'One action is still being processed. Please try Join Battle again shortly.');return true;}
  const active=session;
  active.reopenRequests??=new Set();if(i.id&&active.reopenRequests.has(i.id))return true;if(i.id)active.reopenRequests.add(i.id);
  active.busy=true;
  try{await reopenDisplay(i,active);}
  catch(e){report('[RAID RESUME]',e);if(!active.finished&&session===active){const content='Your battle is still saved, but the new window could not be confirmed. Your previous window still works if visible. Use Join Battle or Resume in this boss lobby to try again.';if(i.deferred||i.replied)await i.followUp({content,ephemeral:true,allowedMentions:{parse:[]}}).catch(()=>{});else await say(i,content);}}
  finally{active.busy=false;armIdle();}return true;
 }
 const ruleMatch=/^raidtest:rules:([a-f0-9]{12}):(start|cancel)$/.exec(i.customId||'');
 let confirmedRule=null;
 if(ruleMatch){
  if(starting||session?.busy){await say(i,'One action is still being processed. Please try again.');return true;}
  if(!pendingRules||pendingRules.id!==ruleMatch[1]||clock()-pendingRules.created>300000){await say(i,'This rules screen has expired. Choose Join in the latest lobby to review the rules again.');return true;}
  if(ruleMatch[2]==='cancel'){pendingRules=null;await i.deferUpdate();await i.editReply({flags:32768,components:[{type:10,content:'Entry cancelled. No battle has started.'}],attachments:[]});return true;}
  confirmedRule=pendingRules;
 }
 const enteringLobby=['join','join_paladin'].includes(lobbyAction)||!!confirmedRule||classConfirmed;
 const selectedProfile=enteringLobby&&renderBattle?characters.get(guildId,ownerId):null;
 const selectedClass=selectedProfile?.workshop?.job||selectedProfile?.job||null;
 const requestedJob=selectedClass||confirmedRule?.job||(lobbyAction==='join_paladin'?'paladin':'warrior');
 const commandOptions=enteringLobby?lobby.options:i.options;

 if(i.isChatInputCommand()||enteringLobby){
 const restart=enteringLobby?(!session||session.state.config.job!==requestedJob||session.state.config.boss!==lobby.selectedBoss||session.state.status!=='active'||(lobby.explicitLevel!==null&&session.state.config.level!==lobby.selectedLevel)||session.state.enhancements.weapon!==(lobby.options.getInteger('upgrade')??0)):commandOptions.getBoolean('restart')??false;
 if(starting||session?.busy){await say(i,'One action is still being processed. Please try again.');return true;}
 if(session&&restart&&!session.finished&&session.state.status==='active'){await say(i,'You already have an active battle. Use Join Battle to return to it.');return true;}
 if(!session||restart){
 if(renderBattle&&lobby.entryCheck){const entry=lobby.entryCheck(ownerId);if(!entry.allowed){await say(i,entry.content);return true;}}
 if(renderBattle&&enteringLobby&&!selectedClass){await classes(i,!!classMatch);return true;}
 if(confirmedRule&&confirmedRule.job!==selectedClass){pendingRules=null;await say(i,'Your class has changed. Rejoin to review the rules again.');return true;}
 if(renderBattle&&enteringLobby&&!confirmedRule&&!preparedEntry){
  const review={id:randomBytes(6).toString('hex'),job:requestedJob,created:clock()};pendingRules=review;
  if(!i.deferred)await i.deferReply({ephemeral:true});
  await i.editReply(require('./raid-rules-card').payload(review.id,{job:requestedJob,boss:lobby.selectedBoss,hp:lobby.remainingHP}));return true;
 }
 const override=null,upgrade=commandOptions.getInteger('upgrade')??0,boss=enteringLobby?lobby.selectedBoss:commandOptions.getString('boss')??'earth',parry=commandOptions.getInteger('parry')??95;
 let level=override,boostInfo;
 if(level===null||level===undefined){
  starting=true;
  try{if(!i.deferred){if(confirmedRule)await i.deferUpdate();else await i.deferReply({ephemeral:true});}level=await readServerLevel(i.guildId,i.user.id);boostInfo=await require('./booster-current-counts').read(guildId,ownerId,{member:i.member});}
  catch(e){report('[RAID LEVEL]',e);if(i.deferred)await i.editReply({content:'Your server level or current boost count could not be verified. No battle was started. Try Join Battle again.',allowedMentions:{parse:[]}}).catch(()=>{});return true;}
  finally{starting=false;}
 }
 if(epoch!==generation){await say(i,'This raid was reset. Join the latest lobby.');return true;}
 if(!Number.isInteger(level)||level<1||level>100||![0,5,10,20].includes(upgrade)||!Object.hasOwn(R.BOSSES,boss)||![60,70,95].includes(parry)){await say(i,'Invalid test settings.');return true;}
 const M=require('./raid-workshop-model'),saved=renderBattle?characters.workshopRead(guildId,ownerId,level,true):null;
 if(renderBattle&&!M.ready(saved,level)){pendingRules=null;await i.editReply(M.preparation(saved,level));return true;}
 const candidate={id:randomBytes(6).toString('hex'),busy:false,touched:clock(),state:saved?M.battle(saved,level,boss,randomInt(1,0x7fffffff)):R.create(require('./raid-test-build').config(requestedJob,level,upgrade,boss),randomInt(1,0x7fffffff))};
 candidate.state=require('./raid-booster').apply(candidate.state,boostInfo.effectiveCount);candidate.booster=boostInfo.active;candidate.boostObservedAt=boostInfo.observedAt;
 if(renderBattle&&lobby.admit){const entry=lobby.admit(candidate.state,ownerId,candidate.id);if(!entry.allowed){await say(i,entry.content);return true;}candidate.state=entry.state;}
 session=candidate;pendingRules=null;
 }
 session.touched=clock();session.playerName=i.member?.displayName||i.user?.globalName||i.user?.username||'Gosu General';
  // Reopening displays the saved combat snapshot. The next valid action refreshes it.
 if(renderBattle){session.state=lobby.syncHP(lobby.applyBuffs(session.state),ownerId);}
 if(!renderBattle){if(i.deferred)await i.editReply(display(session));else await i.reply({...display(session),ephemeral:true});return true;}
 const active=session;active.busy=true;
 try{if(!i.deferred)await i.deferReply({ephemeral:true});await updateDisplay(i,active,true);}
 catch(e){console.error('[RAID DISPLAY]',e?.code||e?.name);if(i.deferred)await i.editReply({flags:32768,components:[{type:10,content:'Battle display unavailable. Use Join Battle in the boss lobby to retry.'}]}).catch(()=>{});}
 finally{active.busy=false;armIdle();}return true;
 }
 const match=/^raidtest:([a-f0-9]{12}):(\d+):([a-z_]+)$/.exec(i.customId);
 if(starting){await i.deferUpdate();return true;}
 if(!match||!session||match[1]!==session.id||(renderBattle&&(!session.displayMessageId||session.displayMessageId!==i.message?.id))){await say(i,'This battle panel has expired. Use Join Battle in the raid lobby.');return true;}
 // A second click while the first is uploading must not produce another turn or error popup.
 if(session.busy){await i.deferUpdate();return true;}
 if(Number(match[2])!==session.state.turn){
  const active=session;active.busy=true;
  try{await i.deferUpdate();await updateDisplay(i,active,true);active.touched=clock();}
  finally{active.busy=false;}return true;
 }
 
 // Older preview buttons restore the standard card without consuming a turn.
 if(renderBattle&&match[3]==='class_items'){const active=session;active.busy=true;try{await i.deferUpdate();if(active.finished||epoch!==generation)return true;active.view='inventory';await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&match[3]==='motion'){const active=session;active.busy=true;try{await i.deferUpdate();active.view=null;await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&require('./raid-equipment').isAction(match[3])){const active=session;active.busy=true;try{await i.deferUpdate();if(active.finished||epoch!==generation)return true;active.view='equipment';await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&['inventory_prev','inventory_next'].includes(match[3])){const active=session;active.busy=true;try{await i.deferUpdate();active.view='inventory';active.inventoryPage=Math.max(0,(active.inventoryPage||0)+(match[3]==='inventory_next'?1:-1));await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&['equipment','inventory','skills','effects','menu','battle','skills_passives','skills_core','skills_advanced','skills_growth'].includes(match[3])){const active=session;active.busy=true;try{await i.deferUpdate();if(match[3].startsWith('skills_')){active.view='skills';active.guidePage=match[3].slice(7);}else {active.view=match[3]==='battle'?null:match[3];if(match[3]==='skills')active.guidePage='passives';}active.touched=clock();await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(match[3]!=='retreat'&&!R.actions(session.state).includes(match[3])){await say(i,'That action is unavailable. Check your energy and the current pattern.');return true;}
 const active=session;let boostInfo=null;
 if(match[3]!=='retreat'){
  if(active.boostPending){await i.deferUpdate();return true;}
  active.boostPending=true;
  try{
   await i.deferUpdate();
   boostInfo=await require('./booster-current-counts').read(guildId,ownerId,{member:i.member});
  }catch(e){
   report('[RAID BOOST]',e);
   if(!active.finished&&session===active&&epoch===generation)await i.followUp({content:'Current boost count could not be verified. No turn was consumed. Retry the same action shortly, or choose End Battle.',ephemeral:true,allowedMentions:{parse:[]}}).catch(()=>{});
   return true;
  }finally{active.boostPending=false;}
  // Recheck after every await; old windows, duplicate turns, reset and End Battle cannot revive combat.
  if(active.finished||session!==active||epoch!==generation||Number(match[2])!==active.state.turn||active.busy||(renderBattle&&active.displayMessageId!==i.message?.id))return true;
 }
 active.busy=true;
 try{
 if(!i.deferred&&!i.replied)await i.deferUpdate();if(active.finished||session!==active||epoch!==generation)return true;
 const boosted=boostInfo?require('./raid-booster').apply(active.state,boostInfo.effectiveCount):active.state;
 const before=renderBattle?lobby.syncHP(lobby.applyBuffs(boosted),ownerId):boosted,energy=before.energy,next=match[3]==='retreat'&&before.status!=='active'?before:R.step(before,match[3]);
 if(!Number.isSafeInteger(next.totals.damage)||next.totals.damage<0)throw Object.assign(Error('Combat damage exceeds the supported numeric range.'),{code:'BOOST_COMBAT_RANGE'});
 if(match[3]!=='retreat'&&match[3]!=='offer_next'&&!next.log.at(-1)?.offerCinematic){next.log.at(-1).testEnergyBefore=energy;next.log.at(-1).testEnergyAfter=next.energy;}
 if(boostInfo){active.booster=boostInfo.active;active.boostObservedAt=boostInfo.observedAt;}
 active.state=next;active.touched=clock();
 if(renderBattle&&match[3]!=='retreat')lobby.record(active,ownerId);
 if(match[3]==='retreat'){
 // End gameplay synchronously; Discord cleanup must not hold admission or reset locks.
 settle(active,i);
 }else {
 // One committed result + next intent, one Discord edit; no timed intermediate panel.
 await updateDisplay(i,active);
}
 }catch(error){
 // Never roll back a committed turn after an uncertain Discord response.
 console.error('[RAID TEST]',error?.code||error?.name||'ActionError');
 const message={content:error?.code==='BOOST_COMBAT_RANGE'?'Attack result exceeds the supported numeric range. No turn was consumed. End Battle remains available.':'The display could not update. Use Join Battle in the boss lobby to reopen your saved turn.',ephemeral:true,allowedMentions:{parse:[]}};
 if(i.deferred||i.replied)await i.followUp(message).catch(()=>{});else await i.reply(message).catch(()=>{});
 }finally{active.motionStage=null;active.motionBefore=null;active.busy=false;armIdle();}
 return true;
 }
 return {expireIdle,get battleDeadline(){return session&&!session.finished&&session.state.status==='active'?session.touched+battleIdleMs:null;},async endForWorkshop({force=false}={}){if(!force&&(starting||session?.busy))throw Error('A battle action is being processed. Try /workshop again shortly.');generation++;clearTimer(idleTimer);idleTimer=null;const active=session;session=null;pendingRules=null;pendingClass=null;if(!active)return;active.finished=true;require('./raid-render-worker').release(active.id);active.attachmentMemo=null;active.mediaAttachments=null;active.motionBefore=null;lobby.abandon?.(active.state,ownerId);if(active.displayReply)void require('./raid-async').bounded(()=>active.displayReply.deleteReply()).catch(()=>{});},get activePanel(){expireIdle();return !!(starting||pendingRules||pendingClass||this.activeBattle);},get activeBattle(){expireIdle();return !!(session&&!session.finished&&session.state.status==='active');},commands:[{toJSON:()=>structuredClone(COMMAND)}],handle:async(i,preparedEntry=false)=>{
  if(!preparedEntry&&!relevant(i))return false;
  try{return await handle(i,preparedEntry);}catch(e){
   // Expired Discord interactions must never escape into the shared bot's error event.
   report('[RAID INTERACTION]',e);
   if(session)session.displayDirty=true;
   if(i.deferred||i.replied)await i.followUp({content:'Your battle is saved. Use Join Battle in the boss lobby to reopen it.',ephemeral:true}).catch(()=>{});
   return true;
  }
 }};
}
function hasModeratorRole(member,roleId=MODERATOR_ROLE){
 const roles=member?.roles;
 return Array.isArray(roles)?roles.includes(roleId):roles?.cache?.has?.(roleId)===true;
}
function createRaidTest(options={}){
 const {ownerId=OWNER,guildId=GUILD,moderatorRoleId=MODERATOR_ROLE,clock=Date.now}=options;
 // Each tester owns a complete controller, including its lobby, HP, buffs and busy flag.
 // Never share the owner's battle or let a moderator operate another tester's buttons.
 registry.assertRuntimeReady({combatBosses:R.BOSSES});
 const testers=new Map();
 let productionActive=()=>false;
 const storage=options.lobbyStorageFile===undefined?require('node:path').join(__dirname,'raid-beta-lobby.json'):options.lobbyStorageFile;
 const characterFile=options.characterStorageFile===undefined?(storage?require('node:path').join(require('node:path').dirname(storage),'raid-characters.json'):null):options.characterStorageFile;
 const characterStore=options.characterStore||require('./raid-characters').createStore({file:characterFile,testGrant:true});
 const workshop=require('./raid-workshop').createWorkshop({...options,beforeOpen:async userId=>{
  const own=[...testers.values()].filter(c=>c.userId===userId);
  if(own.some(c=>c.controller.activeBattle))return 'You have an active battle. Use Join Battle or Resume in that boss lobby to reopen it, then continue or choose End Battle before opening /workshop. Battles automatically end after 10 minutes of inactivity once any current action finishes.';
  if(entryFlow.isOpen(userId))return 'Your raid entry preparation is open. Finish it or choose Cancel in that window before opening /workshop.';
  if(own.some(c=>c.pending))return 'A raid request is still being processed. Please wait for it to finish, then try /workshop again.';
  if(own.some(c=>c.controller.activePanel))return 'Your raid entry preparation is open. Finish it or choose Cancel in that window before opening /workshop.';
  return false;
 },store:require('./raid-workshop-store').createStore(characterStore,{productionActive:()=>productionActive()})});
 const lobbies=new Map(registry.enabledBosses().map(b=>[b.id,require('./raid-lobby').createLobby({clock,boss:b.id,storageFile:registry.storageFile(storage,b.id)})]));
 const scheduler=require('./raid-scheduler').createRaidScheduler({stateFile:options.schedulerStorageFile??(storage?storage.replace(/\.json$/,'')+'-schedule.json':require('node:path').join(__dirname,'raidset-schedule.json')),lobbies,guildId,ownerId,clock,readServerLevel:options.readServerLevel||require('./raid-server-level').readServerLevel});
 productionActive=()=>scheduler.isProductionActive();
 require('./raid-workshop-store').setProductionChecker(()=>productionActive());
 const replacing=new Set();
 let cleanupQueue=Promise.resolve();
 const cleanupFile=storage?storage.replace(/\.json$/,'')+'-cleanup.json':null;
 let cleanupMarks={};try{if(cleanupFile)cleanupMarks=JSON.parse(require('node:fs').readFileSync(cleanupFile,'utf8'));}catch(e){if(e.code!=='ENOENT')console.error('[RAID CLEANUP STATE]',e.code||e.name);}
 // Inspect only managed raid channels; never delete other bots' or members' messages.
 async function previousLobbies(i){
  const locations=[...lobbies.values()].map(l=>l.savedLocation).filter(Boolean);
  const channels=new Map([[i.channel.id,i.channel]]);
  for(const channelId of new Set([...locations.map(l=>l.channelId),...Object.keys(cleanupMarks)]))if(!channels.has(channelId)){
   try{channels.set(channelId,await require('./raid-async').bounded(()=>i.guild.channels.fetch(channelId)));}catch(e){if(e.code===10003)delete cleanupMarks[channelId];else throw e;}
  }
  const hasLobby=nodes=>(nodes||[]).some(c=>String(c.customId||c.custom_id||'').startsWith('raidtest:lobby:')||hasLobby(c.components));
  const botId=i.client?.user?.id;
  if(!botId)throw Error('Cannot identify the raid bot for safe lobby cleanup');
  const prepared=await Promise.all([...channels].map(async([channelId,ch])=>{
   if(!ch?.messages?.fetch)throw Error('Cannot read a previous raid channel');
   return {channelId,ch,page:await require('./raid-async').bounded(()=>ch.messages.fetch({limit:100}))};
  }));
  // Capture the newest pages before publishing. The sweep can never reach the new lobby.
  return async()=>{
   let failed=0;const seen=new Set();
   for(const {channelId,ch,page:first}of prepared){
    let page=first,before,complete=true;const boundary=cleanupMarks[channelId],newest=[...first.values()][0]?.id;cleanupMarks[channelId]=boundary||null;
    try{for(;;){
     if(!page.size)break;let reached=false;
     for(const msg of page.values()){
      if(boundary&&(/^\d+$/.test(msg.id)&&/^\d+$/.test(boundary)?BigInt(msg.id)<=BigInt(boundary):msg.id===boundary)){reached=true;continue;}
      if(seen.has(msg.id)||msg.author?.id!==botId||!(hasLobby(msg.components)||locations.some(l=>l.channelId===channelId&&l.messageId===msg.id)))continue;
      seen.add(msg.id);try{await require('./raid-async').bounded(()=>msg.delete());}catch(e){if(e.code!==10008){failed++;complete=false;void require('./raid-async').bounded(()=>msg.edit({components:[],content:'This raid has ended. Use the latest raid lobby.'})).catch(()=>{});}}
     }
     if(reached||page.size<100)break;
     const last=[...page.values()].at(-1)?.id;if(!last||last===before)throw Error('Raid history pagination did not advance');
     before=last;page=await require('./raid-async').bounded(()=>ch.messages.fetch({limit:100,before}));
    }}catch(e){failed++;complete=false;console.error('[RAID CLEANUP]',e.code||e.name);}
    if(complete&&newest)cleanupMarks[channelId]=newest;
   }
   if(cleanupFile)try{const fs=require('node:fs');fs.writeFileSync(cleanupFile+'.tmp',JSON.stringify(cleanupMarks));fs.renameSync(cleanupFile+'.tmp',cleanupFile);}catch(e){failed++;console.error('[RAID CLEANUP STATE]',e.code||e.name);}
   return failed;
  };
 }
 const relevant=i=>(i.isChatInputCommand?.()&&i.commandName==='raidtest')||((i.isButton?.()||i.isStringSelectMenu?.())&&i.customId?.startsWith('raidtest:'));
 async function deny(i,content){try{await i.reply({content,ephemeral:true,allowedMentions:{parse:[]}});}catch(e){console.error('[RAID ACCESS]',e?.code||e?.name);}}
 function remember(context,response){
  const message=response?.resource?.message||response?.message||response;
  if(message?.id)context.messages.add(message.id);
  return response;
 }
 function scopedInteraction(i,context){
  const channel=i.channel&&new Proxy(i.channel,{get(target,key){
   if(key==='send')return async(...args)=>remember(context,await target.send(...args));
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  return new Proxy(i,{get(target,key){
   if(key==='channel')return channel;
   if(['reply','editReply','followUp'].includes(key)&&typeof target[key]==='function')return async(...args)=>{const response=await target[key](...args);const message=response?.resource?.message||response?.message||response;const id=message?.id;if(id){const remove=()=>typeof target.webhook?.deleteMessage==='function'?target.webhook.deleteMessage(id):target.deleteReply();if(testers.get(context.userId+':'+context.boss)!==context||replacing.has(context.boss)){void require('./raid-async').bounded(remove).catch(()=>{});return response;}context.windows??=new Map();context.windows.set(id,remove);}return remember(context,response);};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
 }
 const entryFlow=require('./raid-entry-flow').create({characters:characterStore,workshop,readLevel:options.readServerLevel||require('./raid-server-level').readServerLevel,clock,render:options.renderBattle!==false,valid:c=>testers.get(c.userId+':'+c.boss)===c&&!replacing.has(c.boss),start:async(i,c)=>{if(c.pending)throw Error('A raid action is in progress.');c.pending++;try{return await c.controller.handle(scopedInteraction(i,c),true);}finally{c.pending--;}}});
 return {async start(client){for(const lobby of lobbies.values())await lobby.start(client);await scheduler.resume(client).catch(e=>console.error('[RAID SCHEDULE RESTORE]',e?.code||e?.name));},commands:[{toJSON:()=>structuredClone(COMMAND)},{toJSON:()=>structuredClone(RAIDSET)},{toJSON:()=>structuredClone(RAIDSETSTOP)},...workshop.commands],handle:async i=>{
  if(i.isChatInputCommand?.()&&['raidset','raidsetstop'].includes(i.commandName)){
   if(i.guildId!==guildId||i.user?.id!==ownerId){await deny(i,'Only the configured raid owner can manage automatic raids.');return true;}
   await i.deferReply({ephemeral:true});
   try{if(i.commandName==='raidsetstop')await i.editReply(scheduler.stopAfterCurrent());
   else {const result=await scheduler.enable(i.client,i.channelId);await i.editReply(result.status+(result.started?'\nAutomatic raid mode enabled.':'\nExisting automatic raid was not reset.'));}}
   catch(e){console.error('[RAIDSET]',e?.code||e?.name);await i.editReply('Automatic raid setup was not completed: '+String(e.message||'Unknown error').slice(0,220)+'. Existing raid data was preserved.');}
   return true;
  }
  if(await entryFlow.handle(i))return true;
  if(await workshop.handle(i))return true;
  if(!relevant(i))return false;
  const userId=i.user?.id;
  if(i.guildId!==guildId||!userId){await deny(i,'This raid test is available in its configured server only.');return true;}
  if(i.isChatInputCommand?.()&&userId!==ownerId){await deny(i,'Only the owner can set up the beta lobby. Use the existing lobby to join.');return true;}
  if(i.isChatInputCommand?.()&&scheduler.isProductionActive()){await deny(i,'Automatic raids are enabled. /raidtest cannot reset a scheduled raid. Use /raidset to inspect the schedule or /raidsetstop to stop after settlement.');return true;}
  if(i.isChatInputCommand?.()&&options.renderBattle!==false){
   const sub=i.options.getSubcommand?.(),boss=registry.byTestCommand(sub)?.id||null;
   if(!boss){await deny(i,'Use '+registry.enabledBosses().map(b=>'/raidtest '+b.testCommand.name).join(' or ')+'.');return true;}
   if(replacing.size){await deny(i,'A new raid is being published. Please wait for that request to finish.');return true;}
   for(const key of lobbies.keys())replacing.add(key);
   try{
    await i.deferReply({ephemeral:true});
    const started=performance.now();let sweep;try{sweep=await previousLobbies(i);}catch(e){console.error('[RAID CLEANUP PREPARE]',e.code||e.name);sweep=async()=>1;}const prepared=performance.now();
    // Invalidate all old gameplay before any new lobby can accept players.
    const old=[...testers.values()];testers.clear();
    for(const c of old)await c.controller.endForWorkshop({force:true});
    const cleanup=[entryFlow.clear(),workshop.closeAll()];
    for(const c of old){for(const remove of c.windows?.values()||[])cleanup.push(require('./raid-async').bounded(remove).catch(e=>{if(e.code!==10008)console.error('[RAID WINDOW CLOSE]',e.code||e.name);}));c.windows?.clear();c.messages.clear();}
    for(const lobby of lobbies.values()){await lobby.settleRewards();lobby.retire();}
    await Promise.allSettled(cleanup);
    if(await lobbies.get(boss).publish(i,options.readServerLevel||require('./raid-server-level').readServerLevel,{freshOnly:true})){
     console.info('[RAID LOBBY TIMING]',JSON.stringify({prepareMs:Math.round(prepared-started),publishMs:Math.round(performance.now()-prepared)}));
     const raidURL=lobbies.get(boss).url;
     cleanupQueue=cleanupQueue.catch(()=>{}).then(sweep).then(failed=>{if(failed)console.warn('[RAID CLEANUP]',failed,'old messages remain with expired controls');}).catch(e=>console.error('[RAID CLEANUP]',e.code||e.name));
     await require('./raid-async').bounded(()=>i.editReply({content:'All previous raid sessions reset. Fresh HP, rankings and personal bests: '+raidURL+' / Join now. Old lobby messages are being removed in the background.'})).catch(e=>console.error('[RAID RESET REPLY]',e.code||e.name));
    }
   }catch(e){console.error('[RAID RESET]',e.code||e.name);await i.editReply({content:'The previous raid has been stopped, but the new lobby could not be published. Check channel permissions and run /raidtest again.'}).catch(()=>{});}
   finally{replacing.clear();}return true;
  }
  if(replacing.size){await deny(i,'Raid lobbies are being reset. Please wait.');return true;}
  let publicLobby=null,publicAction=null;
  if(i.customId?.startsWith('raidtest:lobby:'))for(const lobby of lobbies.values()){if(lobby.restoreBlocked?.(i)){await deny(i,'This lobby is preserved, but its saved HP and rankings are incomplete. Please ask Gosu General to recover the original raid records. No HP or rankings have been reset.');return true;}await lobby.restore(i);const action=lobby.match(i);if(action){publicLobby=lobby;publicAction=action;break;}}
  if(i.customId?.startsWith('raidtest:lobby:')&&!publicAction){await deny(i,'This lobby has been replaced. Join the latest lobby for this boss.');return true;}
  if(publicAction&&userId!==ownerId&&publicAction==='refresh'){await deny(i,'Only the owner can refresh the shared lobby.');return true;}
  if(publicAction==='claim'){await publicLobby.claim(i);return true;}
  for(const [key,entry]of testers)if(clock()-entry.touched>TTL&&!entry.pending){entry.controller.expireIdle();if(!entry.controller.activePanel)testers.delete(key);}
  let context=publicAction?testers.get(userId+':'+publicLobby.selectedBoss):[...testers.values()].find(c=>c.userId===userId&&c.messages.has(i.message?.id));
  if((i.isButton?.()||i.isStringSelectMenu?.())&&!publicAction&&!context){await deny(i,'This battle belongs to another player or its lobby was replaced. Join the latest boss lobby.');return true;}
  const boss=publicLobby?.selectedBoss||context?.boss||'earth';
  if(replacing.has(boss)){await deny(i,'This boss lobby is being replaced. Please wait.');return true;}
  if(publicAction==='resume'&&!context){await deny(i,'No saved battle is available for this boss. Use Join Battle in the lobby.');return true;}
  if(!context){
   publicLobby=publicLobby||lobbies.get(boss);
   publicLobby.releaseOrphan?.(userId);
   context={boss,userId,lobby:publicLobby,controller:createPersonalRaidTest({...options,ownerId:userId,sharedLobby:publicLobby,characterStore,onBattleEnded:()=>{for(const remove of context.windows?.values()||[])void require('./raid-async').bounded(remove).catch(()=>{});context.windows?.clear();context.messages.clear();},canResetClass:id=>![...testers.values()].some(c=>c.userId===id&&(c.controller.activeBattle||(c.boss!==boss&&c.pending)))}),messages:new Set(),touched:clock(),pending:0};
   testers.set(userId+':'+boss,context);
  }
  if(['join','join_paladin','resume'].includes(publicAction)&&[...testers.values()].some(c=>c!==context&&c.userId===userId&&(c.pending||c.controller.activeBattle))){await deny(i,'Finish your current battle before joining another raid.');return true;}
  if(['join','join_paladin','resume'].includes(publicAction)&&workshop.isOpen(userId)){await deny(i,workshop.isOpening?.(userId)?'Your Workshop is still opening. Wait for it to finish, then close it before joining.':'Your Workshop is open. Close it before joining. It closes automatically after 2 minutes of inactivity.');return true;}
  if(['join','join_paladin'].includes(publicAction)&&!context.controller.activeBattle&&options.renderBattle!==false)return entryFlow.begin(i,context);
  context.touched=clock();context.pending++;
  try{return await context.controller.handle(scopedInteraction(i,context));}
  finally{context.pending--;}
 }};
}
module.exports={createRaidTest,COMMAND,payload,hasModeratorRole};

