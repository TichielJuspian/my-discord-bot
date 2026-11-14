'use strict';
const {randomBytes,randomInt}=require('node:crypto');
const R=require('./raid-engine/progression-combat.cjs');
const OWNER='170947916167512064',GUILD='495716062097309697',TTL=24*60*60*1000;
const MODERATOR_ROLE='495727371140202506';
const LABEL={attack:'Attack',thrust:'Thrust � 2 energy',guard:'Guard',parry:'Parry � 1 energy',cleanse:'Cleanse',break_part:'Break Part',retreat:'End Battle'};
const PHASE={normal:'Normal attack',flurry:'Multi-hit attack',warning:'Heavy attack warning - no direct hit',heavy:'Heavy attack',mark_warning:'Mark warning',mark:'Mark applied',struggle_start:'Clash begins - deal damage',struggle:'Clash - deal damage',struggle_end:'Clash check',part_warning:'Break the part',part_check:'Part-break check',opening:'Opening - bonus damage'};
// Keep default deny. The server command permission grants this one command to MODERATOR_ROLE.
const COMMAND={name:'raidtest',description:'Reset all beta raids and create one fresh boss lobby. No rewards.',default_member_permissions:'0',dm_permission:false,options:[
 {type:1,name:'colossus',description:'Reset all beta raids and create a fresh Colossus lobby'},
 {type:1,name:'succubus',description:'Reset all beta raids and create a fresh Succubus lobby'}
]};
function payload(session){
 if(require('./raid-engine/devil-offer.cjs').pending(session.state))return require('./raid-devil-offer-view').payload(session);
 const s=session.state,last=s.log.at(-1),ended=s.status!=='active',phase=R.phase(s),available=R.actions(s),upgrade=s.enhancements.weapon;
 const fields=[
 {name:'Warrior',value:`Level ${s.config.level} � Slots +${upgrade}\nHP **${s.hp}/${s.stats.hp}** � Energy **${s.energy}/${s.maxEnergy}**`,inline:true},
 {name:'Damage',value:`Total **${s.totals.damage}**\nBoss HP **${s.bossHP}/${s.bossMaxHP||require('./raid-boss-health').maximum(s.config.boss)}**`,inline:true},
 {name:ended?'Result':'Next boss pattern',value:ended?`${s.status.toUpperCase()} � ${s.turn-1} turns completed`:PHASE[phase]||phase},
 {name:'Build',value:`ATK ${s.stats.attack} � DEF ${s.stats.defense} � Crit ${s.stats.crit}%\nPower ${s.config.power} / Focus ${s.config.focus} / Ruin ${s.config.ruin}`},
 {name:'Rules',value:`Auto-counter 60% � Counter damage 30% ATK\nOn counter proc: block floor(DEF x 30%) direct damage once\nParry ${Math.round(s.config.warriorParryChance*100)}% � Perfect: 20% of successes\nSuccessful parry: next attack +${10+s.config.level-1} damage\nNo ultimate. No XP, points or item rewards.`}
 ];
 if(last)fields.splice(3,0,{name:`Turn ${last.turn} � ${LABEL[last.action]||last.action}`,value:`Attack **${last.damage}**${last.critical?' (critical)':''} � Counter **${last.counterDamage}**\nDamage taken: direct ${last.incoming}, ongoing ${last.dot}, mechanic ${last.mechanicDamage||0}\n${last.parryResult?'Parry: '+last.parryResult+' � ':''}${require('./raid-energy-log').format(last)}`});
 const names=ended?['retreat']:['attack','thrust','guard','parry',...(available.includes('cleanse')?['cleanse']:[]),...(available.includes('break_part')?['break_part']:[]),'retreat'];
 const components=[];for(let n=0;n<names.length;n+=5)components.push({type:1,components:names.slice(n,n+5).map(action=>({type:2,style:action==='retreat'?4:action==='thrust'?1:2,label:LABEL[action],custom_id:`raidtest:${session.id}:${s.turn}:${action}`,disabled:action!=='retreat'&&!available.includes(action)}))});
 return {content:'**PRIVATE RAID TEST** � Only you can operate this battle.',embeds:[{title:`${R.BOSSES[s.config.boss].name} - Warrior test`,color:0x5865f2,fields,footer:{text:'No action = no turn passes. /raidtest resumes; restart:true starts over. Restarting the bot clears tests.'}}],components,allowedMentions:{parse:[]}};
}
function createPersonalRaidTest({ownerId=OWNER,guildId=GUILD,clock=Date.now,renderBattle=true,readServerLevel=require('./raid-server-level').readServerLevel,sharedLobby=null,characterStore=null,canResetClass=()=>true}={}){
 let session=null,starting=false,pendingRules=null,pendingClass=null,generation=0;
 const characters=characterStore||require('./raid-characters').createStore();
 const lobby=sharedLobby||require('./raid-lobby').createLobby({clock});
 const display=(active,initial=false)=>{
  if(!renderBattle)return payload(active);
  if(['equipment','inventory'].includes(active.view)){const saved=characters.get(guildId,ownerId);active.inventoryItems=saved.items;active.workshopAccount=saved.workshop;}
  const panel=require('./raid-panels').display(active,{},R.BOSSES[active.state.config.boss].name,PHASE[R.phase(active.state)]||R.phase(active.state),initial);
  if(!active.view&&lobby.results)panel.components.push(...lobby.results(ownerId).components);
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
 // Attachment IDs belong to a message, not the battle. A resumed panel is a new message.
 const messageId=i.message?.id;
 const rebuild=initial||active.displayDirty||(messageId&&active.displayMessageId!==messageId);
 let message;
 const started=performance.now();let rendered=started;
 try{const prepared=require('./raid-attachment-cache').prepare(active,display(active,rebuild),i.message);rendered=performance.now();message=await i.editReply(prepared.body);require('./raid-attachment-cache').remember(active,message,prepared.signatures);}
 catch(e){
  active.displayDirty=true;
  report('[RAID DISPLAY RETRY]',e);
  if(e?.rawError?.errors)console.error('[RAID VALIDATION]',JSON.stringify(e.rawError.errors));
  // Retry the same committed turn with a complete attachment set, never replay combat.
  const prepared=require('./raid-attachment-cache').prepare({...active,attachmentMemo:null},display(active,true),messageId);message=await i.editReply(prepared.body);require('./raid-attachment-cache').remember(active,message,prepared.signatures);
 }
 console.info('[RAID TIMING]',JSON.stringify({turn:active.state.turn,renderMs:Math.round(rendered-started),updateMs:Math.round(performance.now()-rendered)}));
 active.displayReply=i;active.displayDirty=false;active.displayMessageId=message?.id||messageId||active.displayMessageId;
 if(renderBattle&&!['skills','effects','menu','equipment','inventory'].includes(active.view)&&!require('./raid-engine/devil-offer.cjs').pending(active.state)){
  if(message?.attachments)active.mediaAttachments=[...message.attachments.values()].map(x=>({id:x.id,filename:x.name}));
  active.renderedBoss=require('./raid-panels').bossArt(active.motionStage==='player'&&active.motionBefore?active.motionBefore:active.state)[0];active.renderedProfile=require('./raid-card-motion').asset(active).name;
 }
 }
 async function handle(i,preparedEntry=false,epoch=generation){
 if(!preparedEntry&&!relevant(i))return false;
 if(i.user?.id!==ownerId||i.guildId!==guildId){await say(i,'This test is available only to the server owner account.');return true;}
 if(session&&clock()-session.touched>TTL){lobby.abandon?.(session.state,ownerId);session=null;}
 if(session&&lobby.touch&&!lobby.touch(session.state,ownerId))session=null;
 if(renderBattle&&i.isChatInputCommand()){await lobby.publish(i,readServerLevel);return true;}
 if(renderBattle&&i.isButton?.()&&/^raidtest:board:(home|[0-3])$/.test(i.customId)){await i.deferUpdate();const page=i.customId.split(':')[2];await i.editReply(lobby.rank(ownerId,page==='home'?null:Number(page)));return true;}
 const lobbyAction=preparedEntry?'join':renderBattle?lobby.match(i):null;
 if(renderBattle&&i.customId?.startsWith('raidtest:lobby:')&&!lobbyAction){await say(i,'This lobby has expired. Use /raidtest to open the current lobby.');return true;}
 if(lobbyAction?.startsWith('buff_')){await lobby.cast(i,lobbyAction.slice(5),readServerLevel);return true;}
 if(lobbyAction==='rank'){await i.deferReply({ephemeral:true});await i.editReply(lobby.rank(ownerId,0));return true;}
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
   if(['reset','confirm_reset'].includes(action)){await say(i,'Class changes are free during beta. Open /workshop  Class. Your reset potions are not consumed.');return true;}
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
  const active=session;active.busy=true;
  try{if(!i.deferred)await i.deferReply({ephemeral:true});if(active.displayReply){try{await active.displayReply.fetchReply();active.view=null;active.displayDirty=true;await updateDisplay(active.displayReply,active,true);await say(i,'Your existing battle window has been updated. Return to that window to continue.');return true;}catch(e){if(![10008,10015,50027].includes(e.code))throw e;active.displayReply=null;}}active.view=null;active.motionStage=null;active.motionBefore=null;active.cutsceneResult=false;active.state=lobby.syncHP(active.state,ownerId);active.displayDirty=true;active.touched=clock();await updateDisplay(i,active,true);}
  catch(e){report('[RAID RESUME]',e);if(i.deferred)await i.editReply({flags:32768,components:[{type:10,content:'Your battle is still saved. Use Join Battle in the boss lobby to try again.'}],attachments:[],allowedMentions:{parse:[]}}).catch(()=>{});}
  finally{active.busy=false;}return true;
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
 let level=override;
 if(level===null||level===undefined){
  starting=true;
  try{if(!i.deferred){if(confirmedRule)await i.deferUpdate();else await i.deferReply({ephemeral:true});}level=await readServerLevel(i.guildId,i.user.id);}
  catch(e){report('[RAID LEVEL]',e);if(i.deferred)await i.editReply({content:'Your server level could not be loaded. Please try /raidtest again.',allowedMentions:{parse:[]}}).catch(()=>{});return true;}
  finally{starting=false;}
 }
 if(epoch!==generation){await say(i,'This raid was reset. Join the latest lobby.');return true;}
 if(!Number.isInteger(level)||level<1||level>100||![0,5,10,20].includes(upgrade)||!Object.hasOwn(R.BOSSES,boss)||![60,70,95].includes(parry)){await say(i,'Invalid test settings.');return true;}
 const M=require('./raid-workshop-model'),saved=renderBattle?characters.workshopRead(guildId,ownerId,level,true):null;
 if(renderBattle&&!M.ready(saved,level)){pendingRules=null;await i.editReply(M.preparation(saved,level));return true;}
 const candidate={id:randomBytes(6).toString('hex'),busy:false,touched:clock(),state:saved?M.battle(saved,level,boss,randomInt(1,0x7fffffff)):R.create(require('./raid-test-build').config(requestedJob,level,upgrade,boss),randomInt(1,0x7fffffff))};
 if(renderBattle&&lobby.admit){const entry=lobby.admit(candidate.state,ownerId,candidate.id);if(!entry.allowed){await say(i,entry.content);return true;}candidate.state=entry.state;}
 session=candidate;pendingRules=null;
 }
 session.touched=clock();session.playerName=i.member?.displayName||i.user?.globalName||i.user?.username||'Gosu General';
 const badge=require('./raid-member-badge').booster(i.member);if(badge!==undefined)session.booster=badge;
 session.state=require('./raid-booster').apply(session.state,session.booster===true?1:0);
 if(renderBattle){session.state=lobby.syncHP(lobby.applyBuffs(session.state),ownerId);}
 if(!renderBattle){if(i.deferred)await i.editReply(display(session));else await i.reply({...display(session),ephemeral:true});return true;}
 const active=session;active.busy=true;
 try{if(!i.deferred)await i.deferReply({ephemeral:true});await updateDisplay(i,active,true);}
 catch(e){console.error('[RAID DISPLAY]',e?.code||e?.name);if(i.deferred)await i.editReply({flags:32768,components:[{type:10,content:'Battle display unavailable. Use Join Battle in the boss lobby to retry.'}]}).catch(()=>{});}
 finally{active.busy=false;}return true;
 }
 const match=/^raidtest:([a-f0-9]{12}):(\d+):([a-z_]+)$/.exec(i.customId);
 if(starting){await i.deferUpdate();return true;}
 if(!match||!session||match[1]!==session.id||(session.displayMessageId&&i.message?.id&&session.displayMessageId!==i.message.id)){await say(i,'This battle panel has expired. Use Join Battle in the raid lobby.');return true;}
 // A second click while the first is uploading must not produce another turn or error popup.
 if(session.busy){await i.deferUpdate();return true;}
 if(Number(match[2])!==session.state.turn){
  const active=session;active.busy=true;
  try{await i.deferUpdate();await updateDisplay(i,active,true);active.touched=clock();}
  finally{active.busy=false;}return true;
 }
 
 // Older preview buttons restore the standard card without consuming a turn.
 if(renderBattle&&match[3]==='class_items'){await i.deferUpdate();session.view='inventory';await updateDisplay(i,session,true);return true;}
 if(renderBattle&&match[3]==='motion'){const active=session;active.busy=true;try{await i.deferUpdate();active.view=null;await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&require('./raid-equipment').isAction(match[3])){await i.deferUpdate();session.view='equipment';await updateDisplay(i,session,true);return true;}
 if(renderBattle&&['inventory_prev','inventory_next'].includes(match[3])){const active=session;active.busy=true;try{await i.deferUpdate();active.view='inventory';active.inventoryPage=Math.max(0,(active.inventoryPage||0)+(match[3]==='inventory_next'?1:-1));await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(renderBattle&&['equipment','inventory','skills','effects','menu','battle','skills_passives','skills_core','skills_advanced','skills_growth'].includes(match[3])){const active=session;active.busy=true;try{await i.deferUpdate();if(match[3].startsWith('skills_')){active.view='skills';active.guidePage=match[3].slice(7);}else {active.view=match[3]==='battle'?null:match[3];if(match[3]==='skills')active.guidePage='passives';}active.touched=clock();await updateDisplay(i,active,true);}finally{active.busy=false;}return true;}
 if(match[3]!=='retreat'&&!R.actions(session.state).includes(match[3])){await say(i,'That action is unavailable. Check your energy and the current pattern.');return true;}
 const active=session;active.busy=true;
 try{
 const received=performance.now();await i.deferUpdate();if(active.finished||epoch!==generation)return true;console.info('[RAID ACK]',Math.round(performance.now()-received));
 const currentBadge=require('./raid-member-badge').booster(i.member);if(currentBadge!==undefined)active.booster=currentBadge;
 const boosted=require('./raid-booster').apply(active.state,active.booster===true?1:0);
 const before=renderBattle?lobby.syncHP(lobby.applyBuffs(boosted),ownerId):boosted,energy=before.energy,next=match[3]==='retreat'&&before.status!=='active'?before:R.step(before,match[3]);
 if(match[3]!=='retreat'&&match[3]!=='offer_next'&&!next.log.at(-1)?.offerCinematic){next.log.at(-1).testEnergyBefore=energy;next.log.at(-1).testEnergyAfter=next.energy;}
 active.state=next;active.touched=clock();
 if(renderBattle)lobby.record(active,ownerId);
 if(match[3]==='retreat'){
 // End gameplay synchronously; Discord cleanup must not hold admission or reset locks.
 lobby.abandon?.(active.state,ownerId);if(session===active)session=null;
 void require('./raid-finish-battle').finishBattle(i,active,renderBattle?()=>lobby.refresh():null).catch(e=>report('[RAID FINISH]',e));
 }else {
 // One committed result + next intent, one Discord edit; no timed intermediate panel.
 await updateDisplay(i,active);
}
 }catch(error){
 // Never roll back a committed turn after an uncertain Discord response.
 console.error('[RAID TEST]',error?.code||error?.name||'ActionError');
 const message={content:'The display could not update. Use Join Battle in the boss lobby to reopen your saved turn.',ephemeral:true,allowedMentions:{parse:[]}};
 if(i.deferred||i.replied)await i.followUp(message).catch(()=>{});else await i.reply(message).catch(()=>{});
 }finally{active.motionStage=null;active.motionBefore=null;active.busy=false;}
 return true;
 }
 return {async endForWorkshop({force=false}={}){if(!force&&(starting||session?.busy))throw Error('A battle action is being processed. Try /workshop again shortly.');generation++;const active=session;session=null;pendingRules=null;pendingClass=null;if(!active)return;active.finished=true;lobby.abandon?.(active.state,ownerId);if(active.displayReply)void require('./raid-async').bounded(()=>active.displayReply.deleteReply()).catch(()=>{});},get activeBattle(){return !!(session&&!session.finished&&session.state.status==='active'&&clock()-session.touched<=TTL);},commands:[{toJSON:()=>structuredClone(COMMAND)}],handle:async(i,preparedEntry=false)=>{
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
 const testers=new Map();
 const storage=options.lobbyStorageFile===undefined?require('node:path').join(__dirname,'raid-beta-lobby.json'):options.lobbyStorageFile;
 const characterFile=options.characterStorageFile===undefined?(storage?require('node:path').join(require('node:path').dirname(storage),'raid-characters.json'):null):options.characterStorageFile;
 const characterStore=options.characterStore||require('./raid-characters').createStore({file:characterFile,testGrant:true});
 const workshop=require('./raid-workshop').createWorkshop({...options,beforeOpen:async userId=>{for(const c of testers.values())if(c.userId===userId){if(c.pending)throw Error('A battle action is being processed. Try again shortly.');await c.controller.endForWorkshop();}},store:require('./raid-workshop-store').createStore(characterStore)});
 const lobbies=new Map(['earth','nameless_succubus'].map(boss=>[boss,require('./raid-lobby').createLobby({clock,boss,storageFile:storage?(boss==='earth'?storage:storage.replace(/\.json$/,'')+'-succubus.json'):null})]));
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
   if(['reply','editReply','followUp'].includes(key)&&typeof target[key]==='function')return async(...args)=>remember(context,await target[key](...args));
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
 }
 const entryFlow=require('./raid-entry-flow').create({characters:characterStore,workshop,readLevel:options.readServerLevel||require('./raid-server-level').readServerLevel,clock,render:options.renderBattle!==false,valid:c=>testers.get(c.userId+':'+c.boss)===c&&!replacing.has(c.boss),start:async(i,c)=>{if(c.pending)throw Error('A raid action is in progress.');c.pending++;try{return await c.controller.handle(scopedInteraction(i,c),true);}finally{c.pending--;}}});
 return {commands:[{toJSON:()=>structuredClone(COMMAND)},...workshop.commands],handle:async i=>{
  if(await entryFlow.handle(i))return true;
  if(await workshop.handle(i))return true;
  if(!relevant(i))return false;
  const userId=i.user?.id;
  if(i.guildId!==guildId||!userId){await deny(i,'This raid test is available in its configured server only.');return true;}
  if(i.isChatInputCommand?.()&&userId!==ownerId){await deny(i,'Only the owner can set up the beta lobby. Use the existing lobby to join.');return true;}
  if(i.isChatInputCommand?.()&&options.renderBattle!==false){
   const sub=i.options.getSubcommand?.(),boss=sub==='succubus'?'nameless_succubus':sub==='colossus'?'earth':null;
   if(!boss){await deny(i,'Use /raidtest colossus or /raidtest succubus.');return true;}
   if(replacing.size){await deny(i,'A new raid is being published. Please wait for that request to finish.');return true;}
   for(const key of lobbies.keys())replacing.add(key);
   try{
    await i.deferReply({ephemeral:true});
    const started=performance.now();let sweep;try{sweep=await previousLobbies(i);}catch(e){console.error('[RAID CLEANUP PREPARE]',e.code||e.name);sweep=async()=>1;}const prepared=performance.now();
    if(await lobbies.get(boss).publish(i,options.readServerLevel||require('./raid-server-level').readServerLevel,{freshOnly:true})){
     for(const c of testers.values())await c.controller.endForWorkshop({force:true});testers.clear();void workshop.closeAll().catch(e=>console.error('[WORKSHOP CLOSE]',e.code||e.name));
     for(const [key,lobby]of lobbies)if(key!==boss)lobby.retire();
     console.info('[RAID LOBBY TIMING]',JSON.stringify({prepareMs:Math.round(prepared-started),publishMs:Math.round(performance.now()-prepared)}));
     const raidURL=lobbies.get(boss).url;
     cleanupQueue=cleanupQueue.catch(()=>{}).then(sweep).then(failed=>{if(failed)console.warn('[RAID CLEANUP]',failed,'old messages remain with expired controls');}).catch(e=>console.error('[RAID CLEANUP]',e.code||e.name));
     await require('./raid-async').bounded(()=>i.editReply({content:'All previous raid sessions reset. Fresh HP, rankings and personal bests: '+raidURL+' / Join now. Old lobby messages are being removed in the background.'})).catch(e=>console.error('[RAID RESET REPLY]',e.code||e.name));
    }
   }catch(e){console.error('[RAID RESET]',e.code||e.name);await i.editReply({content:'Raid reset could not finish. Please check channel permissions and try again. No further cleanup was performed.'}).catch(()=>{});}
   finally{replacing.clear();}return true;
  }
  if(replacing.size){await deny(i,'Raid lobbies are being reset. Please wait.');return true;}
  let publicLobby=null,publicAction=null;
  if(i.customId?.startsWith('raidtest:lobby:'))for(const lobby of lobbies.values()){if(lobby.restoreBlocked?.(i)){await deny(i,'This lobby is preserved, but its saved HP and rankings are incomplete. Please ask Gosu General to recover the original raid records. No HP or rankings have been reset.');return true;}await lobby.restore(i);const action=lobby.match(i);if(action){publicLobby=lobby;publicAction=action;break;}}
  if(i.customId?.startsWith('raidtest:lobby:')&&!publicAction){await deny(i,'This lobby has been replaced. Join the latest lobby for this boss.');return true;}
  if(publicAction&&userId!==ownerId&&publicAction==='refresh'){await deny(i,'Only the owner can refresh the shared lobby.');return true;}
  for(const [key,entry]of testers)if(clock()-entry.touched>TTL&&!entry.pending)testers.delete(key);
  let context=publicAction?testers.get(userId+':'+publicLobby.selectedBoss):[...testers.values()].find(c=>c.userId===userId&&c.messages.has(i.message?.id));
  if((i.isButton?.()||i.isStringSelectMenu?.())&&!publicAction&&!context){await deny(i,'This battle belongs to another player or its lobby was replaced. Join the latest boss lobby.');return true;}
  const boss=publicLobby?.selectedBoss||context?.boss||'earth';
  if(replacing.has(boss)){await deny(i,'This boss lobby is being replaced. Please wait.');return true;}
  if(publicAction==='resume'&&!context){await deny(i,'No saved battle is available for this boss. Use Join Battle in the lobby.');return true;}
  if(!context){
   publicLobby=publicLobby||lobbies.get(boss);
   publicLobby.releaseOrphan?.(userId);
   context={boss,userId,lobby:publicLobby,controller:createPersonalRaidTest({...options,ownerId:userId,sharedLobby:publicLobby,characterStore,canResetClass:id=>![...testers.values()].some(c=>c.userId===id&&(c.controller.activeBattle||(c.boss!==boss&&c.pending)))}),messages:new Set(),touched:clock(),pending:0};
   testers.set(userId+':'+boss,context);
  }
  if(['join','join_paladin'].includes(publicAction)&&workshop.isOpen(userId)){await deny(i,'Your Workshop is open. Use Start Battle there, or close Workshop before joining.');return true;}
  if(['join','join_paladin'].includes(publicAction)&&!context.controller.activeBattle&&options.renderBattle!==false)return entryFlow.begin(i,context);
  context.touched=clock();context.pending++;
  try{return await context.controller.handle(scopedInteraction(i,context));}
  finally{context.pending--;}
 }};
}
module.exports={createRaidTest,COMMAND,payload,hasModeratorRole};

