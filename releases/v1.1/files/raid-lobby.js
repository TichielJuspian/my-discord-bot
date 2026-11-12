'use strict';
const fs=require('node:fs'),path=require('node:path'),{createBoard}=require('./raid-leaderboard');
const registry=require('./raid-boss-registry');
const text=content=>({type:10,content});
function createLobby({clock=Date.now,storageFile=null,boss='earth',claimCredit=(g,u,raidId)=>require('./raid-workshop-store').grantSpectatorClaim(g,u,raidId)}={}){
 const bossInfo=registry.requireEnabled(boss);
 const currentCounts=require('./booster-current-counts');
 const currentBoost=user=>guildId?currentCounts.peek(guildId,user):null;
 let board=createBoard({clock,currentBoost}),message=null,timer=null,joined=false,hp=require('./raid-boss-health').maximum(boss),id=String(clock()),publishing=false;
 let contributions={},personalBests={},recentAttempts={},rewardedParticipants=[],admittedUsers=new Set();
 let activeAttempts=new Map(),finalStrike=null,expiryTimer=null,buffTimer=null;
 const ATTEMPT_TTL=10*60*1000;
 const RAID_DURATION=23*60*60*1000;
 let openedAt=clock(),settlement=null,settling=null,raidTimer=null,scheduled=false;
 let accountingLoaded=false,guildId=null,messageId=null,channelId=null;
 let boostTimer=null,boostRefresh=null,boostDue=0,boostDirty=false;
 function armBoostDisplay(delay=60000){
  const due=clock()+delay;if(boostTimer&&boostDue<=due)return;
  if(boostTimer)clearTimeout(boostTimer);boostTimer=null;boostDue=due;
  if(!message||!guildId)return;
  boostTimer=setTimeout(()=>{boostTimer=null;boostDue=0;refreshBoostDisplay().catch(e=>console.error('[RAID BOOST DISPLAY]',e.code||e.name)).finally(()=>armBoostDisplay());},delay);boostTimer.unref?.();
 }
 async function prepareBoostDisplay(userId='',page=0){const boardAt=board,guildAt=guildId;if(guildAt)await currentCounts.prime(guildAt,boardAt.visibleIds(userId,page));return boardAt===board&&guildAt===guildId;}
 async function refreshBoostDisplay(){
  if(boostRefresh)return boostRefresh;
  boostDirty=false;boostRefresh=(async()=>{const messageAt=message;if(!messageAt||!await prepareBoostDisplay()||message!==messageAt)return;await messageAt.edit(body());})();
  try{await boostRefresh;}finally{boostRefresh=null;if(boostDirty)armBoostDisplay(1000);}
 }
 currentCounts.subscribe((g,u)=>{if(g===guildId&&message&&board.has(u)){boostDirty=true;armBoostDisplay(1000);}});
 const expired=()=>clock()>=openedAt+RAID_DURATION;
 function armRaid(){if(raidTimer)clearTimeout(raidTimer);raidTimer=null;if(!accountingLoaded||settlement?.done)return;
 raidTimer=setTimeout(()=>{raidTimer=null;refresh().catch(e=>console.error('[RAID REWARDS]',e.code||e.name)).finally(()=>armRaid());},Math.max(1000,(expired()||settlement)?60000:openedAt+RAID_DURATION-clock()));raidTimer.unref?.();}

 function armBuffExpiry(){
  if(buffTimer){clearTimeout(buffTimer);buffTimer=null;}
  const active=buffs.active();if(!message||!active.length)return;
  buffTimer=setTimeout(()=>{buffTimer=null;persist();refresh().catch(e=>console.error('[BUFF EXPIRY]',e.code||e.name));},Math.max(1,Math.min(...active.map(e=>e.expiresAt))-clock()));
  buffTimer.unref?.();
 }
 function pendingCount(){for(const [user,a]of activeAttempts)if(clock()-a.touched>ATTEMPT_TTL)activeAttempts.delete(user);return activeAttempts.size;}
 function entryCheck(userId){
  pendingCount();
  if(expired()||settlement)return {allowed:false,content:'This raid has ended. Rewards are settled from the final leaderboard.'};
  if(hp<=0)return {allowed:false,content:'The boss has been defeated. Entry is closed. Rewards are settled after admitted battles finish.'};
  const best=personalBests[userId]?.damage||0;
  return best>=hp?{allowed:false,content:`The boss has ${hp.toLocaleString('en-US')} HP remaining. You cannot retry this raid because you cannot exceed your personal best of ${best.toLocaleString('en-US')}.`}:{allowed:true,targetHP:hp};
 }
 function armExpiry(){
  if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}if(!pendingCount())return;
  const wait=Math.max(1,Math.min(...[...activeAttempts.values()].map(a=>a.touched+ATTEMPT_TTL-clock()+1)));
  expiryTimer=setTimeout(()=>{expiryTimer=null;pendingCount();if(hp<=0)refresh().catch(e=>console.error('[RAID SETTLEMENT]',e.code||e.name));armExpiry();},wait);expiryTimer.unref?.();
 }
 function admit(s,userId,attemptId){
  const check=entryCheck(userId);if(!check.allowed)return check;
  if(activeAttempts.has(userId))return {allowed:false,content:'You already have a battle. Use Join Battle to return to your current battle.'};
  activeAttempts.set(userId,{attemptId,targetHP:hp,touched:clock()});admittedUsers.add(userId);persist();armExpiry();
  return {allowed:true,state:{...s,entryRaidId:id,entryBossHP:hp,entryAttemptId:attemptId,worldBossHP:hp,bossHP:hp,bossMaxHP:require('./raid-boss-health').maximum(boss)}};
 }
 function abandon(s,userId){if(activeAttempts.get(userId)?.attemptId===s.entryAttemptId){activeAttempts.delete(userId);armExpiry();}}
 function touch(s,userId){if(expired()||settlement)return false;if(!s.entryRaidId||s.status!=='active')return true;pendingCount();const a=activeAttempts.get(userId);if(a?.attemptId!==s.entryAttemptId)return false;a.touched=clock();armExpiry();return true;}
 function syncHP(s,userId){
  const best=personalBests[userId]?.damage||0;
  if(s.entryRaidId===id&&Number.isSafeInteger(s.entryBossHP)){
   const attempt=activeAttempts.get(userId);if(attempt?.attemptId===s.entryAttemptId){attempt.touched=clock();armExpiry();}
   return {...s,worldBossHP:hp,personalBestDamage:best,bossHP:Math.max(0,s.entryBossHP-s.totals.damage)};
  }
  // Compatibility for legacy states; new entries always use admit's fixed HP snapshot.
  return {...s,worldBossHP:hp,personalBestDamage:best,bossHP:hp<=0?0:hp+Math.max(0,best-s.totals.damage)};
 }
 let selectedBoss=boss,lastSessionId=null,selectedTestLevel=null;
 let options=null,channel=null,ownerLevel=0,ownerUserId=null;
 let saved=null;try{if(storageFile)saved=JSON.parse(fs.readFileSync(storageFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const incompleteSaved=()=>!!saved&&(!Number.isSafeInteger(saved.hp)||saved.hp<0||!Array.isArray(saved.leaderboard));
 const restoreBlocked=i=>incompleteSaved()&&i.channel?.id===saved.channelId&&i.message?.id===saved.messageId;
 const packOptions=o=>({level:o?.getInteger('level')??null,upgrade:o?.getInteger('upgrade')??0,boss:o?.getString('boss')??'earth',parry:o?.getInteger('parry')??95});
 const unpackOptions=o=>({getInteger:n=>o[n]??null,getString:n=>o[n]??null,getBoolean:()=>false});
 function persist(){if(!storageFile||!accountingLoaded)return;saved={id,openedAt,settlement,messageId,channelId,guildId,ownerLevel,ownerUserId,selectedTestLevel,selectedBoss,scheduled,options:packOptions(options),hp,maxHP:require('./raid-boss-health').maximum(boss),contributions,admittedUsers:[...admittedUsers],contributionMode:'personal-best-v1',personalBests,finalStrike,recentAttempts,rewardedParticipants,buffs:buffs.snapshot(),leaderboard:board.snapshot()};fs.writeFileSync(storageFile+'.tmp',JSON.stringify(saved));fs.renameSync(storageFile+'.tmp',storageFile);}
 // Accounting is restored before contacting Discord. A missing or inaccessible UI
 // must never discard a frozen settlement or change its guild/receipt identity.
 function restoreAccounting(){
 if(accountingLoaded)return true;if(!saved||incompleteSaved())return false;
 guildId=saved.guildId;messageId=saved.messageId;channelId=saved.channelId;
 id=saved.id;openedAt=Number.isFinite(saved.openedAt)?saved.openedAt:(Number(String(id).slice(0,13))||clock());settlement=saved.settlement||(saved.openedAt===undefined&&saved.hp<=0?{done:true,legacy:true}:null);scheduled=!!saved.scheduled;ownerLevel=saved.ownerLevel;ownerUserId=saved.ownerUserId;selectedTestLevel=null;selectedBoss=boss;board=createBoard({clock,currentBoost,bossName:bossInfo.leaderboardName});options=unpackOptions(saved.options);hp=require('./raid-boss-health').restoreRemaining(saved,boss);contributions=saved.contributions||{};board.restore(saved.leaderboard||[]);
 // Preserve already-credited legacy totals and HP. Fresh raids start with an empty best ledger.
 finalStrike=saved.finalStrike||null;personalBests=saved.personalBests||Object.fromEntries((saved.leaderboard||[]).map(row=>[row.id,{damage:row.damage,attemptId:null,legacy:true}]));
 recentAttempts=saved.recentAttempts||{};rewardedParticipants=saved.rewardedParticipants||[];admittedUsers=new Set(saved.admittedUsers||Object.keys(saved.personalBests||{}));buffs=require('./raid-shared-buffs').create({clock,raidId:id,isComplete:()=>hp<=0});buffs.restore(saved.buffs);
 accountingLoaded=true;armRaid();return true;}
 async function restore(i){
 if(!restoreAccounting())return false;
 if(message)return true;
 if(i.channel?.id!==channelId)return false;
 // Never infer reward ownership from the triggering interaction or another guild.
 if(guildId&&i.channel.guildId&&i.channel.guildId!==guildId)throw Error('Raid guild mismatch');
 channel=i.channel;
 try{message=await channel.messages.fetch(messageId);}
 catch(e){if(e.code!==10008)throw e;message=null;}
 refresh().catch(e=>console.error('[RAID LOBBY RESTORE]',e.code||e.name));
 return !!message;
 }
 let buffs=require('./raid-shared-buffs').create({clock,raidId:id,isComplete:()=>hp<=0}),definitions=require('./raid-shared-buffs').DEFINITIONS;
 function body(initial=false){
  const complete=hp<=0,pending=pendingCount();
  const members=board.snapshot(),recent=members.filter(r=>r.damage>0).map(r=>({...r,finished:personalBests[r.id]?.updated||r.finished||r.joined})).sort((a,b)=>b.finished-a.finished).slice(0,4);
  const clean=value=>String(value||'Adventurer').replace(/[@*_`<>\r\n]/g,'');
  const recentCard=require('./raid-recent-card').asset(recent,clock());
  const recentPanel={type:12,items:[{media:{url:'attachment://'+recentCard.name},description:recentCard.description}]};
  const statusCard=require('./raid-lobby-card').asset({boss:selectedBoss,hp});
  const result={flags:32768,allowedMentions:{parse:[]},components:[
   {type:12,items:[{media:{url:'attachment://boss-entrance-static.jpg'},description:'BOSS APPEARS / EARTH COLOSSUS'}]},
   {type:17,accent_color:0xc9a967,components:[{type:12,items:[{media:{url:'attachment://'+statusCard.name},description:statusCard.description}]},{type:1,components:[{type:2,style:3,label:expired()&&hp>0?'Raid Failed':'Join Battle',disabled:expired()||!!settlement||hp<=0,custom_id:`raidtest:lobby:${id}:join`},{type:2,style:2,label:'Participants · '+members.length.toLocaleString('en-US'),emoji:{name:'👥'},custom_id:`raidtest:lobby:${id}:count`,disabled:true},...(scheduled&&complete?[{type:2,style:3,label:'Claim 100 P (nonparticipants)',custom_id:`raidtest:lobby:${id}:claim`}]:[])]}]},
   recentPanel,
   ...Array.from({length:5},(_,n)=>({type:12,items:[{media:{url:'attachment://raid-rankings-'+n+'.png'},description:'Hall of Challengers / ranks '+(n*5+1)+'-'+(n*5+5)}]})),
   {type:17,accent_color:0x35b6aa,components:[text('### RAID RESULTS'),text('Unlimited attempts. Only your best run counts. A new best removes only the improvement from boss HP.'),text('Updates when a personal best changes.')] }
  ]};
  const active=buffs.active();
  result.components.splice(2,0,{type:17,accent_color:0xb88be3,components:[text('### WORLD BUFFS'),text(active.length?active.map(e=>`**${definitions[e.kind].label}** · ${String(e.casterName).replace(/[@*_`<>]/g,'')} · Expires <t:${Math.floor(e.expiresAt/1000)}:R>`).join('\n'):'No active buffs.'),{type:1,components:Object.entries(definitions).map(([kind,d])=>({type:2,style:1,label:d.label+' · Lv '+d.level,custom_id:`raidtest:lobby:${id}:buff_${kind}`,disabled:expired()||!!settlement||complete||active.filter(e=>e.kind===kind).length>=require('./raid-shared-buffs').CAPS[kind]}))},text('-# 3 hours | Choose one buff per caster | Max stacks: HP 5 / ATK 3 / CRIT 1 · No turn or energy cost · Cast before battle.')]});
  const latest=active.at(-1);
  let broadcast=null;if(latest){broadcast=require('./raid-buff-announcement').payload(latest,clock()).files[0];result.components.splice(2,0,{type:12,items:[{media:{url:'attachment://'+broadcast.name},description:latest.casterName+' / '+definitions[latest.kind].label}]});}
  result.files=Array.from({length:5},(_,n)=>({attachment:board.image('',0,false,n),name:'raid-rankings-'+n+'.png'}));result.files.push(statusCard,recentCard);
  const lobbyVisual=registry.lobbyVisual(selectedBoss,complete);
  result.components[0].items[0]={media:{url:'attachment://'+lobbyVisual.uploadName},description:lobbyVisual.description};
  if(scheduled&&complete)result.components[1].components.push(text('Victory confirmed. Ranked rewards and loot settle at the 23-hour deadline. Nonparticipants may claim 100 P once before the next raid.'));
  if(scheduled&&!complete&&expired())result.components[1].components.push(text('Raid deadline reached. Failure rewards are paid automatically to ranked participants.'));
  if(complete){result.components[1].accent_color=0x7e91ac;const final=result.components.at(-1);final.components=[text(pending?'### RESULTS · BATTLES IN PROGRESS':'### FINAL RAID RESULTS'),text((pending?'Rankings are provisional until previously started battles end.':'Rankings are final.')+' Participants receive 1 Stat Potion. Use it in Workshop / Inventory.')];}
  else result.components.at(-1).components[1]=text('Best run per challenger · Equal damage shares a rank.');

  // Results panel is disabled while its design is being revised.
  result.components.pop();

  if(broadcast)result.files.push(broadcast);
  result.attachments=[];
  result.files.push({attachment:path.join(__dirname,lobbyVisual.file),name:lobbyVisual.uploadName});
  // Flat status and one compact native action row; recent activity stays separate from the total.
  const panel=result.components[1];result.components.splice(1,1,...panel.components);
  const recentIndex=result.components.indexOf(recentPanel);result.components.splice(recentIndex,1);result.components.splice(3,0,recentPanel);
  return result;
 }
 function retire(){
  // Never retire an unpaid scheduled raid.
  if(scheduled&&accountingLoaded&&!settlement?.done)throw Error('Cannot retire an unsettled scheduled raid');
  if(boostTimer)clearTimeout(boostTimer);boostTimer=null;
  if(raidTimer){clearTimeout(raidTimer);raidTimer=null;}settlement=null;accountingLoaded=false;guildId=null;messageId=null;channelId=null;
  if(buffTimer){clearTimeout(buffTimer);buffTimer=null;}
  if(storageFile&&fs.existsSync(storageFile)){fs.copyFileSync(storageFile,storageFile+'.previous');fs.unlinkSync(storageFile);}
  if(timer){clearTimeout(timer);timer=null;}saved=null;message=null;channel=null;
  if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}activeAttempts.clear();finalStrike=null;
  board=createBoard({clock,currentBoost});contributions={};personalBests={};recentAttempts={};rewardedParticipants=[];admittedUsers=new Set();joined=false;lastSessionId=null;
 }
 async function publish(i,readLevel,{freshOnly=false,scheduledRaid=false}={}){
  if(publishing){await i.reply({content:'The lobby is being prepared.',ephemeral:true});return false;}
  publishing=true;
  try{
   if(!i.deferred)await i.deferReply({ephemeral:true});
   if(!freshOnly){if(saved&&!message&&i.channel?.id!==saved.channelId){
    const oldChannel=await i.guild.channels.fetch(saved.channelId);
    await restore({channel:oldChannel});
   }else await restore(i);}
   restoreAccounting();
   // Finish an already due/frozen payout before replacing its only journal.
   // An unfinished, unexpired raid remains a manual cancellation with no payout.
   await distributePotions();
   const previous=message,previousState={accountingLoaded,guildId,messageId,channelId,openedAt,settlement,board,hp,id,options,channel,ownerUserId,ownerLevel,buffs,contributions,personalBests,recentAttempts,activeAttempts,finalStrike,rewardedParticipants,admittedUsers,scheduled};
   id=String(clock())+require('node:crypto').randomInt(100000,999999);
   openedAt=clock();settlement=null;scheduled=!!scheduledRaid;selectedTestLevel=null;selectedBoss=boss;
   options=unpackOptions({upgrade:0,boss,parry:95});
   board=createBoard({clock,currentBoost,bossName:bossInfo.leaderboardName});
   buffs=require('./raid-shared-buffs').create({clock,raidId:id,isComplete:()=>hp<=0});
   contributions={};personalBests={};recentAttempts={};rewardedParticipants=[];admittedUsers=new Set();activeAttempts=new Map();finalStrike=null;hp=require('./raid-boss-health').maximum(boss);channel=i.channel;ownerUserId=i.user.id;ownerLevel=0;
   let fresh;
   try{fresh=await channel.send(body(true));}
   catch(e){({accountingLoaded,guildId,messageId,channelId,openedAt,settlement,board,hp,id,options,channel,ownerUserId,ownerLevel,buffs,contributions,personalBests,recentAttempts,activeAttempts,finalStrike,rewardedParticipants,admittedUsers,scheduled}=previousState);throw e;}
   if(storageFile&&fs.existsSync(storageFile))fs.copyFileSync(storageFile,storageFile+'.previous');
   message=fresh;accountingLoaded=true;guildId=fresh.guildId||channel.guildId;messageId=fresh.id;channelId=channel.id;persist();armRaid();armBoostDisplay();if(timer){clearTimeout(timer);timer=null;}if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}joined=false;lastSessionId=null;
   let removed=true;
   if(previous&&!freshOnly)try{await previous.delete();}catch(e){if(e.code!==10008){removed=false;await previous.edit({components:[],attachments:[],content:'This raid lobby has been replaced: '+fresh.url}).catch(()=>{});}}
   if(!freshOnly)await i.editReply({content:'New '+bossInfo.shortName+' lobby and fresh leaderboard: '+fresh.url+(removed?'':' / Old lobby could not be deleted; its buttons are expired.')});
   return true;
  }finally{publishing=false;}
 }
 async function distributePotions(){
  if(settling)return settling;
  if(!accountingLoaded||settlement?.done||(scheduled&&!expired())||(!settlement&&!expired()&&(hp>0||pendingCount()>0)))return;
  if(!settlement){const version=scheduled?4:3;settlement={rewardVersion:version,success:hp<=0,done:false,rows:require('./raid-point-rewards').rewards(board.snapshot(),hp<=0,version).map(row=>({...row,basePoints:row.points}))};activeAttempts.clear();}
  // Persist the frozen journal on every retry before any external credit.
  persist();
  const frozen=settlement,raidId=id,guild=guildId;
  if(!guild)throw Error('Raid guild unavailable');
  settling=Promise.resolve().then(async()=>{await require('./raid-point-rewards').prepareSettlement(frozen,guild,persist);for(const row of frozen.rows){await require('./raid-workshop-store').grantRaidReward(guild,row.userId,boss+':'+raidId,row.points,frozen.success,row.bonus);}frozen.done=true;if(id===raidId)try{persist();}catch(e){frozen.done=false;throw e;}});
  try{await settling;}finally{settling=null;}
 }
 async function refresh(){try{await distributePotions();}finally{armRaid();}armBuffExpiry();if(message){const messageAt=message;await prepareBoostDisplay();if(message!==messageAt)return;try{message=await messageAt.edit(body());armBoostDisplay();}catch(e){if(e.code===10008){message=null;return;}if(e.rawError?.errors)console.error('[RAID LOBBY VALIDATION]',JSON.stringify(e.rawError.errors));throw e;}}}
 function record(active,ownerId,{finalize=false}={}){
  if(!accountingLoaded||settlement||expired())return;
  if(active.state.entryRaidId){
   const admitted=activeAttempts.get(ownerId);
   if(active.state.entryRaidId!==id||admitted?.attemptId!==active.id)return;
   admitted.touched=clock();
   // Keep admission until persistence succeeds, allowing an idempotent settlement retry.
  }
  // Release admission even when the challenger leaves before taking a turn.
  if(!finalize&&!active.state.log.some(l=>!l.offerCinematic&&l.action!=='retreat')){if(active.state.status!=='active'||active.state.log.at(-1)?.action==='retreat')abandon(active.state,ownerId);return;}
  lastSessionId=active.id;
  if(active.state.config.boss!==selectedBoss)return;
  joined=true;
  const previous=personalBests[ownerId]||{damage:0,attemptId:null},current=active.state.totals.damage;
  if(!Number.isSafeInteger(current)||current<0)throw Error('Invalid personal-best damage');
  const previousHP=hp,improvement=Math.max(0,current-previous.damage),delta=Math.min(hp,improvement);
  hp=Math.max(0,hp-delta);
  if(previousHP>0&&hp===0&&!finalStrike)finalStrike={userId:ownerId,attemptId:active.id};
  const firstFinal=finalize&&!Object.hasOwn(personalBests,ownerId),better=current>previous.damage,sameAttempt=previous.attemptId===active.id;
  if(better||firstFinal){personalBests[ownerId]={damage:current,attemptId:active.id,updated:clock()};contributions[ownerId]={userId:ownerId,damage:current};}
  active.state.worldBossHP=hp;active.state.personalBestDamage=Math.max(previous.damage,current);active.state.bestImprovement=delta;
  if(better||sameAttempt||firstFinal)board.record({id:ownerId,name:active.playerName,level:active.state.config.level,job:active.state.config.job==='berserker'?'Berserker':active.state.config.job==='paladin'?'Paladin':'Warrior',damage:Math.max(previous.damage,current),personalBest:true,attemptId:active.id,turn:active.state.turn,finalRound:active.state.log.filter(l=>!l.offerCinematic&&l.action!=='retreat').at(-1)?.turn??0,status:active.state.status,cleared:active.state.entryRaidId===id&&active.state.status==='victory',finalStrike:finalStrike?.userId===ownerId,booster:active.booster||active.state.boosterCount>0,boosterCount:active.state.boosterCount||0});
  if(active.state.status!=='active'||active.state.log.at(-1)?.action==='retreat')recentAttempts[ownerId]={name:active.playerName,damage:current,turn:active.state.log.filter(l=>!l.offerCinematic&&l.action!=='retreat').at(-1)?.turn??0,status:active.state.status,updated:clock()};
  persist();
  if(active.state.entryRaidId&&(active.state.status!=='active'||active.state.log.at(-1)?.action==='retreat')){activeAttempts.delete(ownerId);armExpiry();}
  if(hp<=0&&(previousHP>0||active.state.status!=='active'||pendingCount()===0)){if(timer){clearTimeout(timer);timer=null;}refresh().catch(e=>console.error('[RAID COMPLETE]',e.code||e.name));return;}
  if(!timer){timer=setTimeout(()=>{timer=null;refresh().catch(e=>console.error('[RAID LOBBY]',e.code||e.name));},300000);timer.unref?.();}
 }
 async function cast(i,kind,readLevel){
  if(hp<=0||expired()||settlement){await i.reply({content:'This raid has ended. World buffs are closed.',ephemeral:true,allowedMentions:{parse:[]}});return;}
  await i.deferReply({ephemeral:true});
  const level=await readLevel(i.guildId,i.user.id),d=definitions[kind];
  if(!d||level<d.level){await i.editReply({content:`This buff unlocks at server level ${d?.level||60}.`});return;}
  const {event,fresh,reason,retryAt}=buffs.cast({casterId:i.user.id,casterName:i.member?.displayName||i.user.globalName||i.user.username,level,kind});
  if(!fresh){await i.editReply({content:(reason==='stack_limit'?'This buff has reached its stack limit.':'You already have an active buff. Choose only one buff every 3 hours.')+` Available <t:${Math.ceil(retryAt/1000)}:R>.`});return;}
  // Casting is committed before any announcement: a failed upload never duplicates effects.
  // The committed event is displayed inside the shared lobby, not as a new message.
  persist();armBuffExpiry();
  await i.editReply({content:`${d.label} is active for 3 hours for all participants, including you. Expires <t:${Math.floor(event.expiresAt/1000)}:R>.`});
  await refresh();
 }
 function match(i){const m=/^raidtest:lobby:(\d+):(join|join_paladin|class|resume|participation|claim|rank|refresh|buff_protection|buff_rally|buff_blessing)$/.exec(i.customId||'');return m&&m[1]===id&&message&&i.message?.id===message.id?m[2]:null;}
 async function claim(i){
  if(!i.deferred)await i.deferReply({ephemeral:true});
  const userId=i.user?.id;
  if(!scheduled||hp!==0||!accountingLoaded||!userId||i.guildId!==guildId||clock()>=openedAt+RAID_DURATION+3600000){
   await i.editReply({content:'This spectator claim is unavailable or expired.'});return false;
  }
  // Lock out active attempts: their final score may arrive after the boss reaches 0 HP.
  if(admittedUsers.has(userId)||activeAttempts.has(userId)||board.snapshot().some(r=>r.id===userId&&r.damage>0)){
   await i.editReply({content:'You participated in this raid. Your ranked reward is paid automatically at the deadline; spectator claims cannot be combined.'});return false;
  }
  try{
   const received=await claimCredit(guildId,userId,id);
   await i.editReply({content:received?'100 P claimed for this successful raid. Thank you for joining the community!':'You already claimed your 100 P for this raid.'});
   return received;
  }catch(e){
   console.error('[RAID SPECTATOR CLAIM]',e?.code||e?.name);
   await i.editReply({content:'The claim could not be confirmed. Retrying the same button is safe; the wallet receipt prevents double credit.'});
   return false;
  }
 }
 function results(userId){
  const latest=recentAttempts[userId],best=board.snapshot().find(r=>r.id===userId),n=value=>Math.max(0,Math.floor(value||0)).toLocaleString('en-US');
  return {components:[{type:17,accent_color:0x35b6aa,components:[text('### RAID RESULTS'),text(best?'Personal best: **'+n(best.damage)+' damage / '+n(best.finalRound)+' turns**':'No personal best yet.'),text(latest&&latest.turn>0?'Previous run: **'+n(latest.damage)+' damage / '+n(latest.turn)+' turns**':'No previous completed run yet.')] }]};
 }
 return {claim,async closeUi(){if(message)await message.edit({components:[]});},settleRewards:distributePotions,get cycle(){return {id,openedAt,expiresAt:openedAt+RAID_DURATION,success:hp===0,settled:!!settlement?.done,scheduled,active:accountingLoaded};},async start(client){if(restoreAccounting()){refresh().catch(e=>console.error('[RAID RECOVERY]',e.code||e.name));if(channelId){const ch=await client.channels.fetch(channelId);await restore({channel:ch});}}},results,releaseOrphan(userId){activeAttempts.delete(userId);armExpiry();},admit,entryCheck,abandon,touch,get pendingBattles(){return pendingCount();},retire,get savedLocation(){return saved?{channelId:saved.channelId,messageId:saved.messageId}:null;},restoreBlocked,get url(){return message?.url||(saved?"https://discord.com/channels/"+saved.guildId+"/"+saved.channelId+"/"+saved.messageId:null);},restore,get explicitLevel(){return selectedTestLevel;},get selectedLevel(){return selectedTestLevel??Math.max(1,ownerLevel);},get selectedBoss(){return selectedBoss;},body,publish,record,refresh,match,cast,get remainingHP(){return hp;},syncHP,applyBuffs:s=>buffs.apply(s),get options(){return options;},rank:async(userId,page)=>{if(!await prepareBoostDisplay(userId,page))throw Error('Raid lobby was replaced; use the latest lobby.');return board.visual(userId,page);}};
}
module.exports={createLobby};

