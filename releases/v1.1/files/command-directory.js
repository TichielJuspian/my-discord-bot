'use strict';
const command=data=>({toJSON:()=>({...data,dm_permission:false})});
const commands=[command({name:'level',description:'View your server level and XP.',options:[{type:6,name:'user',description:'Member to view'}]}),command({name:'setlevel',description:'[Dev] Set a member server level and matching XP.',default_member_permissions:'8',options:[{type:6,name:'user',description:'Member to restore',required:true},{type:4,name:'level',description:'New server level (0-1000)',required:true,min_value:0,max_value:1000},{type:3,name:'reason',description:'Reason for this correction',max_length:200}]})];
const totalXP=level=>100*level*level;
const progress=d=>({current:Math.max(0,(d?.xp||0)-totalXP(d?.level||0)),required:100*(2*(d?.level||0)+1)});
const HIDDEN_HELP=new Set(['shop','level','giftsetup','giftpanel','giftqueue','giftverify','giftextra']);
function category(c){if(['prune','kick','ban','mute','unmute','unban'].includes(c.name))return 'Moderator';if(['setlevel','givepoints','pointtake','raidtest'].includes(c.name)||c.name.startsWith('gift')&&c.name!=='gift'||BigInt(c.default_member_permissions||0)>0n||/\[(Admin|Dev|Owner)\]/i.test(c.description||''))return 'Developer';return 'Everyone';}
function helpPayload(catalog,operator){
 const groups={Everyone:[],Moderator:[],Developer:[]},seen=new Set();
 for(const c of catalog){if(HIDDEN_HELP.has(c.name)||seen.has(c.name))continue;seen.add(c.name);
 const options=(c.options||[]).filter(o=>o.type===1||o.type===2);
 const label='/'+c.name+(options.length?' '+options.map(o=>o.name).join(' | '):'');
 groups[category(c)].push('\x60'+label+'\x60 — '+String(c.description||'').replace(/\[(Admin|Dev|Owner|Mod)\]\s*/g,''));
 }
 const embeds=[];for(const [name,rows] of Object.entries(groups)){
 const intro=name==='Developer'?'Bot developer access required.':name==='Moderator'?'Moderator access required. Role hierarchy and bot permissions apply.':'Available to all members.';
 let page=intro;for(const row of rows){if(page.length+row.length+1>3500){embeds.push({title:name,description:page,color:0x6688ee});page='';}page+='\n'+row;}embeds.push({title:name,description:page,color:0x6688ee});
 }
 return {content:'**GENBOT COMMANDS**',embeds,flags:64,allowedMentions:{parse:[]}};
}
function create({operatorId,guildId,catalog}){let xp,audit;
async function init(db){xp=db.collection('user_xp');audit=db.collection('level_adjustments');}
async function set({userId,level,actor,reason}){if(!Number.isInteger(level)||level<0||level>1000)throw Error('Invalid level');const key={guildId,userId};const before=await xp.findOne(key);await xp.updateOne(key,{$set:{level,xp:totalXP(level)},$max:{levelRewardHighWater:Math.max(level,before?.level||0)}},{upsert:true});const after=await xp.findOne(key);if(after.level!==level||after.xp!==totalXP(level))throw Error('Level verification failed');await audit.insertOne({guildId,userId,actor,reason,before:{level:before?.level??0,xp:before?.xp??0},after:{level:after.level,xp:after.xp},at:new Date()});return after;}
async function handle(i){const chat=i.isChatInputCommand?.();if(!(chat&&['help','level','setlevel'].includes(i.commandName))&&i.customId!=='community:guide')return false;const reply=content=>i.reply({content,flags:64,allowedMentions:{parse:[]}});if(i.guildId!==guildId){await reply('Use this command in the server.');return true;}if(i.commandName==='help'||i.customId==='community:guide'){await i.reply(helpPayload(catalog(),operatorId));return true;}if(i.commandName==='setlevel'&&i.user.id!==operatorId){await reply('Only the bot developer can use /setlevel.');return true;}await i.deferReply({flags:64});const user=i.options.getUser('user')||i.user;try{if(user.bot)throw Error('Select a member account.');await i.guild.members.fetch(user.id);if(i.commandName==='level'){const d=await xp.findOne({guildId,userId:user.id});await i.editReply({content:`${user.username} / Level **${d?.level||0}** / ${(d?.xp||0).toLocaleString('en-US')} total XP\nNext level: ${progress(d).current.toLocaleString('en-US')} / ${progress(d).required.toLocaleString('en-US')} XP`,allowedMentions:{parse:[]}});}else{const d=await set({userId:user.id,level:i.options.getInteger('level'),actor:i.user.id,reason:i.options.getString('reason')||'Developer correction'});await i.editReply({content:`Level updated: ${user.id} → **${d.level}** / ${d.xp.toLocaleString('en-US')} XP`,allowedMentions:{parse:[]}});}}catch(e){console.error('[LEVEL COMMAND]',e.name,e.code||'');await i.editReply({content:'Could not complete the level request. Check the member and try again.'});}return true;}
return {commands,init,handle};}
module.exports={create,commands,category,helpPayload,totalXP};
