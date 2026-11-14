'use strict';
const fs=require('node:fs'),path=require('node:path'),{createBoard}=require('./raid-leaderboard');
const text=content=>({type:10,content});
function createLobby({clock=Date.now,storageFile=null,boss='earth'}={}){
 let board=createBoard({clock}),message=null,timer=null,joined=false,hp=require('./raid-boss-health').maximum(boss),id=String(clock()),publishing=false;
 let contributions={},personalBests={},recentAttempts={},rewardedParticipants=[];
 let activeAttempts=new Map(),finalStrike=null,expiryTimer=null,buffTimer=null;
 const ATTEMPT_TTL=24*60*60*1000;
 function armBuffExpiry(){
  if(buffTimer){clearTimeout(buffTimer);buffTimer=null;}
  const active=buffs.active();if(!message||!active.length)return;
  buffTimer=setTimeout(()=>{buffTimer=null;persist();refresh().catch(e=>console.error('[BUFF EXPIRY]',e.code||e.name));},Math.max(1,Math.min(...active.map(e=>e.expiresAt))-clock()));
  buffTimer.unref?.();
 }
 function pendingCount(){for(const [user,a]of activeAttempts)if(clock()-a.touched>ATTEMPT_TTL)activeAttempts.delete(user);return activeAttempts.size;}
 function entryCheck(userId){
  pendingCount();
  if(hp<=0)return {allowed:false,content:'The boss has been defeated. Only the participation reward is available. Participants receive one Stat Potion in Workshop / Inventory.'};
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
  activeAttempts.set(userId,{attemptId,targetHP:hp,touched:clock()});armExpiry();
  return {allowed:true,state:{...s,entryRaidId:id,entryBossHP:hp,entryAttemptId:attemptId,worldBossHP:hp,bossHP:hp,bossMaxHP:require('./raid-boss-health').maximum(boss)}};
 }
 function abandon(s,userId){if(activeAttempts.get(userId)?.attemptId===s.entryAttemptId){activeAttempts.delete(userId);armExpiry();}}
 function touch(s,userId){if(!s.entryRaidId||s.status!=='active')return true;pendingCount();const a=activeAttempts.get(userId);if(a?.attemptId!==s.entryAttemptId)return false;a.touched=clock();armExpiry();return true;}
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
 function persist(){if(!storageFile||!message)return;saved={id,messageId:message.id,channelId:channel.id,guildId:message.guildId||channel.guildId,ownerLevel,ownerUserId,selectedTestLevel,selectedBoss,options:packOptions(options),hp,maxHP:require('./raid-boss-health').maximum(boss),contributions,contributionMode:'personal-best-v1',personalBests,finalStrike,recentAttempts,rewardedParticipants,buffs:buffs.snapshot(),leaderboard:board.snapshot()};fs.writeFileSync(storageFile+'.tmp',JSON.stringify(saved));fs.renameSync(storageFile+'.tmp',storageFile);}
 async function restore(i){if(incompleteSaved())return false;if(message)return true;if(!saved)return false;if(i.channel?.id!==saved.channelId)return false;try{message=await i.channel.messages.fetch(saved.messageId);}catch(e){if(e.code===10008){saved=null;return false;}throw e;}channel=i.channel;id=saved.id;ownerLevel=saved.ownerLevel;ownerUserId=saved.ownerUserId;selectedTestLevel=null;selectedBoss=boss;board=createBoard({clock,bossName:selectedBoss==='nameless_succubus'?'Nameless Succubus':'Colossus'});options=unpackOptions(saved.options);hp=require('./raid-boss-health').restoreRemaining(saved,boss);contributions=saved.contributions||{};board.restore(saved.leaderboard||[]);
 // Preserve already-credited legacy totals and HP. Fresh raids start with an empty best ledger.
 finalStrike=saved.finalStrike||null;personalBests=saved.personalBests||Object.fromEntries((saved.leaderboard||[]).map(row=>[row.id,{damage:row.damage,attemptId:null,legacy:true}]));
 recentAttempts=saved.recentAttempts||{};rewardedParticipants=saved.rewardedParticipants||[];buffs=require('./raid-shared-buffs').create({clock,raidId:id,isComplete:()=>hp<=0});buffs.restore(saved.buffs);
 refresh().catch(e=>console.error('[RAID LOBBY RESTORE]',e.code||e.name));return true;}
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
   {type:17,accent_color:0xc9a967,components:[{type:12,items:[{media:{url:'attachment://'+statusCard.name},description:statusCard.description}]},{type:1,components:[{type:2,style:3,label:'Join Battle',custom_id:`raidtest:lobby:${id}:join`},{type:2,style:2,label:'Participants � '+members.length.toLocaleString('en-US'),emoji:{name:'??'},custom_id:`raidtest:lobby:${id}:count`,disabled:true}]}]},
   recentPanel,
   ...Array.from({length:5},(_,n)=>({type:12,items:[{media:{url:'attachment://raid-rankings-'+n+'.png'},description:'Hall of Challengers / ranks '+(n*5+1)+'-'+(n*5+5)}]})),
   {type:17,accent_color:0x35b6aa,components:[text('### RAID RESULTS'),text('Unlimited attempts. Only your best run counts. A new best removes only the improvement from boss HP.'),text('Updates when a personal best changes.')] }
  ]};
  if(selectedBoss==='nameless_succubus'){
   result.components[0].items[0]={media:{url:'attachment://succubus-entrance.jpg'},description:'Nameless Succubus'};
  }
  const active=buffs.active();
  result.components.splice(2,0,{type:17,accent_color:0xb88be3,components:[text('### WORLD BUFFS'),text(active.length?active.map(e=>`**${definitions[e.kind].label}** � ${String(e.casterName).replace(/[@*_`<>]/g,'')} � Expires <t:${Math.floor(e.expiresAt/1000)}:R>`).join('\n'):'No active buffs.'),{type:1,components:Object.entries(definitions).map(([kind,d])=>({type:2,style:1,label:d.label+' � Lv '+d.level,custom_id:`raidtest:lobby:${id}:buff_${kind}`,disabled:complete||active.filter(e=>e.kind===kind).length>=require('./raid-shared-buffs').CAPS[kind]}))},text('-# 3 hours | Choose one buff per caster | Max stacks: HP 5 / ATK 3 / CRIT 1 � No turn or energy cost � Cast before battle.')]});
  const latest=active.at(-1);
  let broadcast=null;if(latest){broadcast=require('./raid-buff-announcement').payload(latest,clock()).files[0];result.components.splice(2,0,{type:12,items:[{media:{url:'attachment://'+broadcast.name},description:latest.casterName+' / '+definitions[latest.kind].label}]});}
  result.files=Array.from({length:5},(_,n)=>({attachment:board.image('',0,false,n),name:'raid-rankings-'+n+'.png'}));result.files.push(statusCard,recentCard);
  const defeated=selectedBoss==='nameless_succubus'?require('./raid-succubus').art({config:{boss:selectedBoss},bossHP:0,hp:1,log:[{phase:'normal'}],director:{phase:'normal',enrageLevel:0,queue:[]},status:'victory'})[0]:'boss-defeated-v5-discord.jpg';
  const entrance=complete?'boss-surrendered.jpg':selectedBoss==='nameless_succubus'?'succubus-entrance-static.jpg':'boss-entrance-static.jpg',imagePath=complete?defeated:entrance;
  result.components[0].items[0]={media:{url:'attachment://'+entrance},description:(complete?'BOSS SURRENDERED / RAID COMPLETE / ':'WARNING / BOSS APPEARS / ')+(selectedBoss==='earth'?'EARTH COLOSSUS':'NAMELESS SUCCUBUS')};
  if(complete){result.components[1].accent_color=0x7e91ac;const final=result.components.at(-1);final.components=[text(pending?'### RESULTS � BATTLES IN PROGRESS':'### FINAL RAID RESULTS'),text((pending?'Rankings are provisional until previously started battles end.':'Rankings are final.')+' Participants receive 1 Stat Potion. Use it in Workshop / Inventory.')];}
  else result.components.at(-1).components[1]=text('Best run per challenger � Equal damage shares a rank.');

  // Personal results belong to the existing private battle panel.
  if(!complete)result.components.pop();

  if(broadcast)result.files.push(broadcast);
  result.attachments=[];
  result.files.push({attachment:path.join(__dirname,imagePath),name:entrance});
  // Flat status and one compact native action row; recent activity stays separate from the total.
  const panel=result.components[1];result.components.splice(1,1,...panel.components);
  const recentIndex=result.components.indexOf(recentPanel);result.components.splice(recentIndex,1);result.components.splice(3,0,recentPanel);
  return result;
 }
 function retire(){
  if(buffTimer){clearTimeout(buffTimer);buffTimer=null;}
  if(storageFile&&fs.existsSync(storageFile)){fs.copyFileSync(storageFile,storageFile+'.previous');fs.unlinkSync(storageFile);}
  if(timer){clearTimeout(timer);timer=null;}saved=null;message=null;channel=null;
  if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}activeAttempts.clear();finalStrike=null;
  board=createBoard({clock});contributions={};personalBests={};recentAttempts={};rewardedParticipants=[];joined=false;lastSessionId=null;
 }
 async function publish(i,readLevel,{freshOnly=false}={}){
  if(publishing){await i.reply({content:'The lobby is being prepared.',ephemeral:true});return false;}
  publishing=true;
  try{
   if(!i.deferred)await i.deferReply({ephemeral:true});
   if(!freshOnly){if(saved&&!message&&i.channel?.id!==saved.channelId){
    const oldChannel=await i.guild.channels.fetch(saved.channelId);
    await restore({channel:oldChannel});
   }else await restore(i);}
   const previous=message,previousState={board,hp,id,options,channel,ownerUserId,ownerLevel,buffs,contributions,personalBests,recentAttempts,activeAttempts,finalStrike,rewardedParticipants};
   id=String(clock())+require('node:crypto').randomInt(100000,999999);
   selectedTestLevel=null;selectedBoss=boss;
   options=unpackOptions({upgrade:0,boss,parry:95});
   board=createBoard({clock,bossName:boss==='nameless_succubus'?'Nameless Succubus':'Colossus'});
   buffs=require('./raid-shared-buffs').create({clock,raidId:id,isComplete:()=>hp<=0});
   contributions={};personalBests={};recentAttempts={};rewardedParticipants=[];activeAttempts=new Map();finalStrike=null;hp=require('./raid-boss-health').maximum(boss);channel=i.channel;ownerUserId=i.user.id;ownerLevel=0;
   let fresh;
   try{fresh=await channel.send(body(true));}
   catch(e){({board,hp,id,options,channel,ownerUserId,ownerLevel,buffs,contributions,personalBests,recentAttempts,activeAttempts,finalStrike,rewardedParticipants}=previousState);throw e;}
   if(storageFile&&fs.existsSync(storageFile))fs.copyFileSync(storageFile,storageFile+'.previous');
   message=fresh;persist();if(timer){clearTimeout(timer);timer=null;}if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}joined=false;lastSessionId=null;
   let removed=true;
   if(previous&&!freshOnly)try{await previous.delete();}catch(e){if(e.code!==10008){removed=false;await previous.edit({components:[],attachments:[],content:'This raid lobby has been replaced: '+fresh.url}).catch(()=>{});}}
   if(!freshOnly)await i.editReply({content:'New '+(boss==='earth'?'Colossus':'Succubus')+' lobby and fresh leaderboard: '+fresh.url+(removed?'':' / Old lobby could not be deleted; its buttons are expired.')});
   return true;
  }finally{publishing=false;}
 }
 async function distributePotions(){
  if(hp>0||!message)return;
  const guild=message.guildId||channel?.guildId;if(!guild)return;const rewardRaidId=id,recipients=Object.entries(personalBests);
  // Saved contributions and per-account receipts make repeated refresh/restarts safe.
  let changed=false;
  for(const [user,entry]of recipients)if(entry.damage>0&&(id!==rewardRaidId||!rewardedParticipants.includes(user))){
   await require('./raid-workshop-store').grantRaidPotion(guild,user,boss+':'+rewardRaidId);if(id===rewardRaidId&&!rewardedParticipants.includes(user)){rewardedParticipants.push(user);changed=true;}
  }
  if(changed&&id===rewardRaidId)persist();
 }
 async function refresh(){await distributePotions();armBuffExpiry();if(message){try{message=await message.edit(body());}catch(e){if(e.rawError?.errors)console.error('[RAID LOBBY VALIDATION]',JSON.stringify(e.rawError.errors));throw e;}}}
 function record(active,ownerId,{finalize=false}={}){
  if(!message)return;
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
  if(hp<=0){await i.reply({content:'This raid is complete. The boss has surrendered.',ephemeral:true,allowedMentions:{parse:[]}});return;}
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
 function match(i){const m=/^raidtest:lobby:(\d+):(join|join_paladin|class|resume|participation|rank|refresh|buff_protection|buff_rally|buff_blessing)$/.exec(i.customId||'');return m&&m[1]===id&&message&&i.message?.id===message.id?m[2]:null;}
 function results(userId){
  const latest=recentAttempts[userId],best=board.snapshot().find(r=>r.id===userId),n=value=>Math.max(0,Math.floor(value||0)).toLocaleString('en-US');
  return {components:[{type:17,accent_color:0x35b6aa,components:[text('### RAID RESULTS'),text(best?'Personal best: **'+n(best.damage)+' damage / '+n(best.finalRound)+' turns**':'No personal best yet.'),text(latest&&latest.turn>0?'Previous run: **'+n(latest.damage)+' damage / '+n(latest.turn)+' turns**':'No previous completed run yet.')] }]};
 }
 return {results,releaseOrphan(userId){activeAttempts.delete(userId);armExpiry();},admit,entryCheck,abandon,touch,get pendingBattles(){return pendingCount();},retire,get savedLocation(){return saved?{channelId:saved.channelId,messageId:saved.messageId}:null;},restoreBlocked,get url(){return message?.url||(saved?"https://discord.com/channels/"+saved.guildId+"/"+saved.channelId+"/"+saved.messageId:null);},restore,get explicitLevel(){return selectedTestLevel;},get selectedLevel(){return selectedTestLevel??Math.max(1,ownerLevel);},get selectedBoss(){return selectedBoss;},body,publish,record,refresh,match,cast,get remainingHP(){return hp;},syncHP,applyBuffs:s=>buffs.apply(s),get options(){return options;},rank:(userId,page)=>board.visual(userId,page)};
}
module.exports={createLobby};

