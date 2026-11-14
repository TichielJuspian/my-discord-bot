'use strict';
const {randomBytes,randomInt}=require('node:crypto'),M=require('./raid-workshop-model'),P=require('./raid-engine/slot-progression.cjs');
const Boost=require('./raid-workshop-boost');
const {WORKSHOP_CHANNELS}=require('./community-command-access');
const COMMAND={name:'workshop',default_member_permissions:null,description:'Manage equipment, enhancements, Stat Potions and class.',dm_permission:false};
const BLOCKED='A raid action is in progress. Please finish it and try /workshop again.';
const OPEN='Your Workshop is already open. Close that window before opening another. It closes automatically after 2 minutes of inactivity.';
const OPENING='Your Workshop is still opening. Please wait for that request to finish.';
const text=content=>({type:10,content}),row=components=>({type:1,components});
function createWorkshop({guildId='495716062097309697',store=require('./raid-workshop-store'),readServerLevel=require('./raid-server-level').readServerLevel,clock=Date.now,render=true,setTimer=setTimeout,clearTimer=clearTimeout,beforeOpen=async()=>{},readBoostCount=(...args)=>require('./booster-current-counts').read(...args)}={}){
 const sessions=new Map(),owners=new Map(),openings=new Map(),IDLE_MS=120000;
 async function close(s){
  if(s.closed)return;s.closed=true;clearTimer(s.timer);sessions.delete(s.id);s.entry?.cancel?.();
  if(owners.get(s.key)===s)owners.delete(s.key);
  s.mediaPool=null;s.pendingMedia=null;s.draft=null;s.pending=null;
  const reply=s.reply;s.reply=null;
  try{await require('./raid-async').bounded(()=>reply.deleteReply());}catch{try{await require('./raid-async').bounded(()=>reply.editReply({flags:32768,attachments:[],components:[text('Workshop closed. Open /workshop to return.')]}));}catch{}}
  // Render caches already have bounded sizes; retain them across panel closures.
 }
 function arm(s){clearTimer(s.timer);if(s.closed)return;s.touched=clock();s.timer=setTimer(()=>{void close(s);},IDLE_MS);s.timer?.unref?.();}
 function payload(s){return require('./raid-workshop-view').payload(s,{render});}
 async function refreshBalance(s){if(s.view==='enhance'){try{s.pointsBalance=await store.readBalance?.(s.guild,s.user)??null;}catch{s.pointsBalance=null;}}}
 async function renderPayload(s){return render?require('./raid-workshop-worker').render(s):payload(s);}
 async function handle(i,entry=null){
  const mode='workshop';
  const command=(i.isChatInputCommand?.()&&i.commandName==='workshop')||i.customId==='workshop:open'||!!entry;
  if(!command&&!i.customId?.startsWith('workshop:'))return false;
  if(i.guildId!==guildId||!i.user?.id){await i.reply({content:'Use this command in the raid server.',ephemeral:true});return true;}
  if(command&&mode!=='class'&&!entry&&!WORKSHOP_CHANNELS.includes(i.channelId)){await i.reply({content:'Use /workshop in '+WORKSHOP_CHANNELS.map(id=>'<#'+id+'>').join(', ')+'.',ephemeral:true,allowedMentions:{parse:[]}});return true;}
  try{
   if(command){
    const openedAt=clock(),key=i.guildId+':'+i.user.id,opening={};
    if(owners.has(key)||openings.has(key)){const content=owners.get(key)?.published?OPEN:OPENING;if(i.deferred||i.replied)await i.followUp({content,ephemeral:true});else await i.reply({content,ephemeral:true});return true;}
    openings.set(key,opening);
    const blocked=!entry&&await beforeOpen(i.user.id,mode);
    if(blocked){openings.delete(key);const content=typeof blocked==='string'?blocked:BLOCKED;if(i.deferred||i.replied)await i.followUp({content,ephemeral:true});else await i.reply({content,ephemeral:true});return true;}
    if(!i.deferred)await i.deferReply(mode==='class'||i.customId==='workshop:open'||entry?{ephemeral:true}:undefined);
    const level=entry?.level??await readServerLevel(i.guildId,i.user.id),account=entry?.account??await store.read(i.guildId,i.user.id,level,true);
    const loadedAt=clock();
    if(openings.get(key)!==opening){await i.deleteReply().catch(()=>{});return true;}
    openings.delete(key);
    const s={classChangeCost:await store.classCost?.(i.guildId,i.user.id)??0,mode,entry,published:false,id:randomBytes(6).toString('hex'),user:i.user.id,guild:i.guildId,level,account,name:i.member?.displayName||i.user.globalName||i.user.username,boostCount:0,boostUnavailable:true,view:mode==='class'?'class':'equipment',inventoryFilter:'all',inventoryPage:0,touched:clock()};
    s.key=key;s.reply=i;sessions.set(s.id,s);owners.set(key,s);
    await Boost.refresh(s,i.member,readBoostCount);
    if(s.closed||sessions.get(s.id)!==s||owners.get(s.key)!==s)return true;
    Boost.stats(M.battle(s.account,s.level).stats,s);
    const body=await renderPayload(s),renderedAt=clock();
    if(s.closed)return true;
    require('./raid-workshop-view').remember(s,await i.editReply(body));
    if(s.closed){await require('./raid-async').bounded(()=>i.deleteReply()).catch(()=>{});return true;}
    console.info('[WORKSHOP OPEN]',JSON.stringify({loadMs:loadedAt-openedAt,renderMs:renderedAt-loadedAt,publishMs:clock()-renderedAt,totalMs:clock()-openedAt,bytes:(body.files||[]).reduce((n,f)=>n+f.attachment.length,0)}));
    s.published=true;arm(s);
    return true;
   }
   const match=/^workshop:([a-f0-9]{12}):([a-z0-9_:]+)$/.exec(i.customId),s=match&&sessions.get(match[1]);
   if(s&&s.user!==i.user.id){await i.deferUpdate();return true;}
   if(!s||s.closed||s.guild!==i.guildId){await i.reply({content:'This panel has expired. Open /workshop.',ephemeral:true});return true;}
   if(s.busy){await i.deferUpdate();if(match[2]==='use_potion'){s.potionQueue??=[];if(s.potionQueue.length<100)s.potionQueue.push(i);}return true;}
   require('./raid-workshop-view').remember(s,i.message);
   s.busy=true;clearTimer(s.timer);
   try{
    const action=match[2]==='enhance_scroll'?'enhance':match[2],fast=false;
    let acknowledged=true;
    if(!i.deferred&&!i.replied)await i.deferUpdate();
    s.touched=clock();s.notice=null;s.enhancementResult=null;if(action!=='use_potion')s.potionResult=null;
    if(action==='back_battle'){
     if(!s.entry?.back)throw Error('No saved battle.');
     await s.entry.back(i);s.closed=true;clearTimer(s.timer);sessions.delete(s.id);if(owners.get(s.key)===s)owners.delete(s.key);s.reply=null;return true;
    }
    if(action==='start_battle'){
     if(!s.entry)throw Error('Join the boss lobby to start a battle.');
     s.level=await readServerLevel(s.guild,s.user);s.account=await store.read(s.guild,s.user,s.level,true);
     if(s.draft||s.pending||!M.ready(s.account,s.level))throw Error('Save or cancel your pending changes before starting.');
     if(await s.entry.start(i)){s.closed=true;clearTimer(s.timer);sessions.delete(s.id);if(owners.get(s.key)===s)owners.delete(s.key);s.reply=null;}
     return true;
    }
    if(action==='close'){await close(s);return true;}
    await Boost.refresh(s,i.member,readBoostCount);
    if(s.closed||sessions.get(s.id)!==s||owners.get(s.key)!==s)return true;
    Boost.stats(M.battle(s.account,s.level).stats,s);
    if(action==='use_potion'){const before=M.battle(s.account,s.level).stats;s.account=await store.apply(s.guild,s.user,s.level,{action:'potion',id:i.id,revision:s.account.revision},randomInt(0,1000000)/1000000);const after=M.battle(s.account,s.level).stats,key=s.account.lastPotion.key;Boost.pair([before,after],s);s.potionResult={...s.account.lastPotion,before:before[key]||0,after:after[key]||0};s.view='equipment';s.pending=null;}
    else if(action==='navigate'){if(!['home','equipment','enhance','class'].includes(i.values?.[0]))throw Error('Invalid page');s.view=i.values[0];s.pending=null;s.draft=null;}
    else if(['home','equipment','enhance','class'].includes(action)){s.view=action;s.pending=null;s.draft=null;}
    else if(action.startsWith('filter_')){const filter=action.slice(7);if(!['all',...M.SLOTS,'consumable'].includes(filter))throw Error('Invalid filter');s.inventoryFilter=filter;s.inventoryPage=0;s.pending=null;}
    else if(action==='inventory_next'||action==='inventory_prev'){s.inventoryPage=Math.max(0,(s.inventoryPage||0)+(action==='inventory_next'?1:-1));s.pending=null;}
    else if(action.startsWith('stat_')){const key=action.slice(5);if(!['power','focus','ruin'].includes(key))throw Error('Invalid stat');s.stat=key;}
    else if(action==='stat'){if(!['power','focus','ruin'].includes(i.values?.[0]))throw Error('Invalid stat');s.stat=i.values[0];}
    else if(['add1','add5','add10','add20'].includes(action)){
     const d={...(s.draft||s.account.allocation)},left=M.remaining({...s.account,allocation:d},s.level),amount=Number(action.slice(3));
     if(amount<=0||amount>left)throw Error('Not enough unspent points. Reset Stats to reallocate.');
     d[s.stat||'power']+=amount;s.draft=d;s.pending=null;
    }else if(action==='clear'){s.draft=null;s.pending=null;}
    else if(action==='save'&&s.draft)s.pending={action:'allocate',value:{...s.draft},label:'Save this attribute allocation? Cost: FREE.'};
    else if(action==='reset')s.pending={action:'reset',label:'Refund all '+M.used(s.account)+' invested points? Cost: FREE.'};
    else if(action==='testkit'){s.account=await store.apply(s.guild,s.user,s.level,{action:'testkit',id:i.id,revision:s.account.revision},0);s.pending=null;s.notice='Epic test equipment claimed.';}
    else if(action.startsWith('guide_')){const page=action.slice(6);if(!['core','passives','advanced','growth'].includes(page))throw Error('Invalid guide page');s.guidePage=page;s.guideIndex=0;}
    else if(action.startsWith('job_')){s.classChangeCost=await store.classCost?.(s.guild,s.user)??0;s.pending={action:'job',value:action.slice(4),label:'Change to '+require('./raid-class-name').upper(action.slice(4))+'? '+require('./raid-test-gear').changeNotice()+' Used Stat Potions are returned and their stat gains reset. Cost: '+s.classChangeCost.toLocaleString('en-US')+' P. Confirm to charge exactly once.'};}
    else if(action==='item'||action.startsWith('equip_')){
     const id=action.startsWith('equip_')?action.slice(6):i.values?.[0],item=M.ITEMS[id];if(!item||!(s.account.inventory[id]>0))throw Error('Item unavailable');if(item.job&&item.job!==s.account.job)throw Error('This item belongs to another class.');
     s.pending={action:'equip',value:id};
    }else if(action.startsWith('remove_')){const slot=action.slice(7);if(!M.SLOTS.includes(slot))throw Error('Invalid slot');s.account=await store.apply(s.guild,s.user,s.level,{action:'unequip',value:slot,id:i.id,revision:s.account.revision},0);s.pending=null;s.notice=null;}
    else if(action==='toggle_scroll'){if(s.pending?.action!=='enhance')throw Error('Select an enhancement slot.');if(s.account.slots[s.pending.value]>=20)throw Error('Scroll limit: +20.');s.pending.useScroll=!s.pending.useScroll;}
    else if(action.startsWith('upgrade_')){const slot=action.slice(8);if(!M.SLOTS.includes(slot))throw Error('Invalid slot');s.pending={action:'enhance',value:slot};}
    else if(action==='sell'){if(s.pending?.action!=='equip')throw Error('Select an inventory item first.');s.pending={action:'sell',value:s.pending.value};}
    else if(action==='unequip'){const filter=s.inventoryFilter||'all';s.account=await store.apply(s.guild,s.user,s.level,{action:'unequip',value:filter,id:i.id,revision:s.account.revision},0);s.pending=null;s.notice=null;}
    else if(action==='cancel'){s.pending=null;}
    else if(action==='confirm'){
     if(!s.pending)throw Error('Select a change first.');
     if(s.pending.action==='sell')throw Error('Selling is locked during the design preview.');
     const level=s.pending.action==='enhance'?s.level:await readServerLevel(s.guild,s.user);s.level=level;
     if(s.pending.action==='job'){
      s.classChangeCost=await store.classCost?.(s.guild,s.user)??0;
      if(s.classChangeCost>0){const available=await store.readBalance(s.guild,s.user);if(available===null||available<s.classChangeCost)throw Error('Class change requires '+s.classChangeCost+' points. No changes were made.');}
     }
     if(s.pending.action==='enhance'){
      await refreshBalance(s);
      const q=P.quote(s.account.slots[s.pending.value]+1,s.account.enhancementFailures?.[s.pending.value]||0);
      if(s.pointsBalance===null)throw Error('The points balance is unavailable. No enhancement was attempted.');
      if(s.pointsBalance<q.cost)throw Error('Not enough points. This attempt costs '+q.cost+' P. No enhancement was attempted.');
     }
     s.account=await store.apply(s.guild,s.user,level,{...s.pending,id:i.id,revision:s.account.revision},randomInt(0,1000000)/1000000);
     if(s.pending.action==='enhance'){
      s.enhancementResult={...s.account.lastEnhancement};
     }else s.enhancementResult=null;
     s.notice=null;s.classChangeCost=await store.classCost?.(s.guild,s.user)??0;
     s.pending=s.pending.action==='enhance'&&s.account.slots[s.pending.value]<P.MAX?{action:'enhance',value:s.pending.value}:null;s.draft=null;
    }
    if(!s.closed){
     await refreshBalance(s);
     const started=clock(),body=await renderPayload(s),renderMs=clock()-started;
     if(s.closed)return true;
     if(fast&&!body.files?.length){await i.update(body);s.mediaPool=s.pendingMedia;s.pendingMedia={};}
     else{if(!acknowledged)await i.deferUpdate();require('./raid-workshop-view').remember(s,await i.editReply(body));}
     console.log('[WORKSHOP TIMING]',JSON.stringify({action,renderMs,publishMs:clock()-started-renderMs,uploadBytes:(body.files||[]).reduce((n,f)=>n+f.attachment.length,0),uploadFiles:(body.files||[]).map(f=>f.name.split('-').slice(0,2).join('-')),reused:body.attachments.length,knownMedia:Object.values(s.mediaPool||{}).filter(m=>m.id).length,memory:process.memoryUsage(),cache:s.renderCache||{},sessions:sessions.size}));
    }
   }catch(e){
    if(s.closed)return true;
    if(!i.deferred&&!i.replied)await i.deferUpdate();
    s.pending=null;s.draft=null;s.account=await store.read(s.guild,s.user,s.level,true);s.notice=e.rawError||e.code===50035?'The equipment panel could not update. Reopen /workshop and try again.':e.message;
    await refreshBalance(s);
    require('./raid-workshop-view').remember(s,await i.editReply(await renderPayload(s)));
   }finally{s.busy=false;arm(s);if(!(s.account.potions>0))s.potionQueue=[];if(!s.closed&&s.potionQueue?.length)void handle(s.potionQueue.shift());}
  }catch(e){if(command){const key=i.guildId+':'+i.user.id;openings.delete(key);const failed=owners.get(key);if(failed&&failed.reply===i)await close(failed);}console.error('[WORKSHOP]',e.code||e.name,JSON.stringify(e.rawError?.errors||{}));const body={content:'Workshop is temporarily unavailable. Your saved character has not been reset. Try /workshop again.',allowedMentions:{parse:[]}};if(i.deferred||i.replied)await i.followUp({...body,ephemeral:true}).catch(()=>{});else await i.reply({...body,ephemeral:true}).catch(()=>{});}
  return true;
 }
 return {isOpening:userId=>openings.has(guildId+':'+userId)||(owners.has(guildId+':'+userId)&&!owners.get(guildId+':'+userId).published),isOpen:userId=>owners.has(guildId+':'+userId)||openings.has(guildId+':'+userId),closeAll:async()=>{openings.clear();await Promise.allSettled([...sessions.values()].map(close));},commands:[{toJSON:()=>structuredClone(COMMAND)}],handle,payload};
}
module.exports={createWorkshop,COMMAND};

