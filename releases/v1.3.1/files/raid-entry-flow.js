"use strict";
const {randomBytes}=require('node:crypto'),M=require('./raid-workshop-model');
function create({characters,workshop,readLevel,start,valid,clock=Date.now,render=true}){
 const flows=new Map();
 const close=f=>f.reply?require('./raid-async').bounded(()=>f.reply.deleteReply()).catch(e=>{if(e.code!==10008)console.error('[RAID PREP CLOSE]',e.code||e.name);}):Promise.resolve();
 const button=(f,action,label,style=1)=>({type:2,style,label,custom_id:'raidprep:'+f.id+':'+action});
 function classes(f){
  const job=f.job||f.account?.job||'warrior',page=f.page||'core',files=[],components=[{type:10,content:'## CHOOSE YOUR CLASS\nExplore each class and its skills, start battle with your selected class. Class changes are FREE during testing.'}];
  const current=f.account||M.migrate(M.fresh(f.level),f.level);
  const preview=current.job===job?current:M.change(current,{action:'job',value:job,id:'class-preview',revision:current.revision},f.level,0);
  if(render){
   files.push({name:'entry-classes.png',attachment:require('./raid-workshop-render').render({account:preview,level:f.level,name:'Choose your class',view:'class'})});
   components.push({type:12,items:[{media:{url:'attachment://entry-classes.png'},description:'Blader / Paladin / Berserker'}]});
  }
  components.push({type:1,components:M.JOBS.map(j=>button(f,'job_'+j,require('./raid-class-name').title(j),j===job?1:2))});
  components.push({type:1,components:['passives','core','advanced','growth'].map((p,n)=>button(f,'guide_'+p,['Passives','Core skills','Advanced','Level unlocks'][n],page===p?1:2))});
  if(render){const state=M.battle(preview,f.level,f.context.boss);for(const file of require('./raid-skill-guide').assets(state,page)){files.push(file);components.push({type:12,items:[{media:{url:'attachment://'+file.name},description:file.description}]});}}
  components.push({type:1,components:[button(f,'choose','Start Battle',3),button(f,'cancel','Cancel',2)]});
  return {flags:32768,attachments:[],files,components,allowedMentions:{parse:[]}};
 }
 async function showClasses(i,f){if(!flows.has(f.id)||!valid(f.context)){await close(f);return;}await i.editReply(classes(f));if(!flows.has(f.id)||!valid(f.context))await close(f);}
 async function startSaved(i,f){
  if(!valid(f.context))throw Error('This raid has expired. Join the latest lobby.');
  await start(i,f.context);
  if(f.context.controller.activeBattle){characters.markRaidPrepared(i.guildId,i.user.id);flows.delete(f.id);return true;}
  return false;
 }
 async function begin(i,context){
  for(const [id,f]of flows)if(clock()-f.created>600000||!valid(f.context))flows.delete(id);
  const existing=[...flows.values()].find(f=>f.userId===i.user.id);if(existing){await i.reply({content:'Your preparation window is already open. Continue there or cancel it before joining again.',ephemeral:true});return true;}
  const f={id:randomBytes(6).toString('hex'),userId:i.user.id,guildId:i.guildId,context,created:clock(),reply:i,stage:'rules',busy:true};flows.set(f.id,f);
  try{
  await i.deferReply({ephemeral:true});
  f.levelLoad=readLevel(i.guildId,i.user.id).then(level=>({level}),()=>({failed:true}));
  const preload=await f.levelLoad;f.level=preload.level??await readLevel(i.guildId,i.user.id);
  if(!flows.has(f.id)||!valid(f.context)){await close(f);return true;}
  f.account=characters.workshopRead(i.guildId,i.user.id,f.level,true);f.job=f.account.job;
  let body=render?require('./raid-rules-card').payload(f.id,{neutral:true,job:'warrior',boss:context.boss,hp:context.lobby.remainingHP}):{components:[{type:10,content:'RAID RULES'},{type:1,components:[{type:2,style:1,label:'Continue',custom_id:'raidtest:rules:'+f.id+':start'}]}],flags:32768};
  function rewrite(c){if(c.custom_id===('raidtest:rules:'+f.id+':start')){c.custom_id='raidprep:'+f.id+':rules';c.label='Choose Character';}if(c.custom_id===('raidtest:rules:'+f.id+':cancel'))c.custom_id='raidprep:'+f.id+':cancel';if(c.components)c.components=c.components.filter(child=>child.custom_id!=='raidtest:rules:'+f.id+':class');for(const child of c.components||[])rewrite(child);}
  for(const c of body.components||[])rewrite(c);await i.editReply(body);if(!flows.has(f.id)||!valid(f.context))await close(f);return true;
  }catch(e){
   flows.delete(f.id);await close(f);console.error('[RAID PREPARATION DISPLAY]',e.code||e.name);
   const body={content:'Raid entry preparation could not be displayed. No battle has started. Use Join Battle in the boss lobby to try again.',ephemeral:true,allowedMentions:{parse:[]}};
   if(i.deferred||i.replied)await i.followUp(body).catch(()=>{});else await i.reply(body).catch(()=>{});return true;
  }finally{f.busy=false;}
 }
 async function handle(i){
  if(!i.customId?.startsWith('raidprep:'))return false;
  const [,id,action]=i.customId.split(':'),f=flows.get(id);
  if(!f||f.userId!==i.user.id||f.guildId!==i.guildId||clock()-f.created>600000||!valid(f.context)){await i.reply({content:'This entry screen has expired. Join the boss lobby again.',ephemeral:true});return true;}
  if(f.busy){await i.deferUpdate();return true;}f.busy=true;f.reply=i;
  try{
   if(action==='cancel'){flows.delete(id);await i.update({flags:32768,components:[{type:10,content:'Entry cancelled.'}],attachments:[]});return true;}
   if(action==='rules'&&f.stage==='rules'){f.stage='class';await i.deferUpdate();await showClasses(i,f);return true;}
   if(f.stage==='class'&&action.startsWith('job_')&&M.JOBS.includes(action.slice(4))){f.job=action.slice(4);await i.deferUpdate();await showClasses(i,f);return true;}
   if(f.stage==='class'&&action.startsWith('guide_')&&['passives','core','advanced','growth'].includes(action.slice(6))){f.page=action.slice(6);await i.deferUpdate();await showClasses(i,f);return true;}
   if(action==='choose'&&f.stage==='class'){
    await i.deferUpdate();const preload=await f.levelLoad,level=preload?.level??await readLevel(i.guildId,i.user.id),a=characters.workshopRead(i.guildId,i.user.id,level,true);
    if(!valid(f.context))throw Error('This raid has expired. Join the latest lobby.');
    if(a.job!==f.job)characters.workshopApply(i.guildId,i.user.id,level,{id:i.id,revision:a.revision,action:'job',value:f.job||a.job},0);
    await startSaved(i,f);return true;
   }
   await i.reply({content:'Continue from your latest entry screen.',ephemeral:true});return true;
  }catch(e){console.error('[RAID PREPARATION]',e.code||e.name);const body={content:e.message||'Preparation could not finish. Please try again.',ephemeral:true};if(i.deferred||i.replied)await i.followUp(body).catch(()=>{});else await i.reply(body).catch(()=>{});return true;}finally{f.busy=false;}
 }
 return {begin,handle,clear(){const old=[...flows.values()];flows.clear();return Promise.allSettled(old.map(close));},isOpen:userId=>[...flows.values()].some(f=>f.userId===userId&&clock()-f.created<=600000&&valid(f.context))};
}
module.exports={create};
