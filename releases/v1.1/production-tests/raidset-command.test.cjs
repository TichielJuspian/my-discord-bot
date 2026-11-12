'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRaidTest}=require('../raid-test');
const GUILD='guild',OWNER='owner';
function fixture(){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'gosu-command-'));let sent=0;let now=1700000000000;
 const ch={id:'raids',guildId:GUILD,async send(){sent++;return msg;},messages:{fetch:async()=>msg}};
 const msg={id:'m1',guildId:GUILD,url:'https://discord.invalid/raids/m1',async edit(){return msg},async delete(){}};
 const guild={channels:{fetch:async()=>ch}};
 const client={guilds:{fetch:async()=>guild},user:{id:'bot'}};
 const bot=createRaidTest({guildId:GUILD,ownerId:OWNER,lobbyStorageFile:path.join(folder,'lobby.json'),characterStorageFile:path.join(folder,'characters.json'),schedulerStorageFile:path.join(folder,'schedule.json'),clock:()=>now,renderBattle:false});
 const make=(commandName,userId=OWNER)=>({guildId:GUILD,channelId:'raids',channel:ch,client,user:{id:userId},commandName,deferred:false,edits:[],isChatInputCommand:()=>true,async deferReply(){this.deferred=true;},async reply(x){this.edits.push(x);},async editReply(x){this.edits.push(x);}});
 return {bot,client,make,get sent(){return sent},cleanup:()=>fs.rmSync(folder,{force:true,recursive:true})};}
test('/raidset is owner-only and repeated command does not replace the active lobby',async()=>{
 const x=fixture();try{await x.bot.start(x.client);
  A(x.bot.commands.some(c=>c.toJSON().name==='raidset'));
  A(x.bot.commands.some(c=>c.toJSON().name==='raidsetstop'));
  const unauthorized=x.make('raidset','stranger');await x.bot.handle(unauthorized);
  A.match(unauthorized.edits.at(-1).content,/only/i);A.equal(x.sent,0);
  const first=x.make('raidset');A.equal(await x.bot.handle(first),true);A.equal(x.sent,1);A.match(first.edits.at(-1),/Automatic raid mode enabled/);
  const second=x.make('raidset');await x.bot.handle(second);A.equal(x.sent,1);A.match(second.edits.at(-1),/Existing automatic raid was not reset/);
  const manual=x.make('raidtest');await x.bot.handle(manual);A.equal(x.sent,1);A.match(manual.edits.at(-1).content,/cannot reset/i);
 }finally{x.cleanup();}
});
