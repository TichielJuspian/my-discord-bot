'use strict';
// One instance per raid occurrence. Persistence is supplied by the future public raid service.
const clean=x=>String(x||'Adventurer').replace(/[@`*_~|<>\\\r\n]/g,'').slice(0,32);
const number=n=>Math.floor(n).toLocaleString('en-US');
function createBoard({clock=Date.now,bossName='Colossus',currentBoost=()=>null}={}){
 const members=new Map();
 const sorted=()=>[...members.values()].sort((a,b)=>b.damage-a.damage||a.joined-b.joined||a.id.localeCompare(b.id));
 const ranked=()=>{let place=0,last=null;return sorted().map((row,index)=>{if(row.damage!==last)place=index+1;last=row.damage;return {...row,rank:place};});};
 const displayed=()=>ranked().map(row=>{const info=currentBoost(row.id);return {...row,combatBoosterCount:row.boosterCount,boosterCount:info?.effectiveCount??null,booster:info?.active===true,boostKnown:!!info};});
 const boost=x=>x.boostKnown&&x.boosterCount===0?'':' | Current boosts: '+(x.boostKnown?x.boosterCount:'unavailable');
 const badge=x=>x.finalStrike?' · 🏁 FINAL STRIKE':x.cleared?' · ⚔️ CLEAR':'';
 function record({id,name,level,job='Warrior',damage,turn,status,booster,boosterCount,finalRound,cleared=false,finalStrike=false,aggregate=false,personalBest=false,attemptId=null}){
  if(!id||!Number.isSafeInteger(damage)||damage<0||!Number.isInteger(turn)||turn<0)throw new Error('Invalid raid contribution');
  const old=members.get(id);if(personalBest&&old&&(damage<old.damage||(damage===old.damage&&old.attemptId!==attemptId)))return false;if(!personalBest&&!aggregate&&old&&(turn<old.turn||(turn===old.turn&&status===old.status)||old.status!=='active'))return false;
  const entry={id,name:clean(name),level,job:clean(job),damage:Math.max(old?.damage||0,damage),turn,status,attemptId:personalBest?attemptId:old?.attemptId,finalRound:Math.max(!personalBest&&aggregate?(old?.finalRound||0):0,Number.isInteger(finalRound)?Math.max(0,finalRound):Math.max(0,turn-1)),boosterCount:Number.isSafeInteger(boosterCount)&&boosterCount>=0?boosterCount:(old?.boosterCount||0),booster:typeof booster==='boolean'?booster:old?.booster===true,joined:old?.joined??clock()};
  members.set(id,entry);
  entry.cleared=cleared;entry.finalStrike=finalStrike||old?.finalStrike===true;
  if(status!=='active'){entry.finished=clock();entry.reached=ranked().find(x=>x.id===id).rank;}
  return true;
 }
 function render(userId,page=null){
  const all=displayed(),detail=page!==null,p=detail?Math.max(0,Math.min(3,Math.floor(Number(page)||0))):0;
  const start=detail?p*25:0,rows=all.slice(start,start+(detail?25:10));
  const rank=all.findIndex(x=>x.id===userId),me=all[rank];
  const embeds=[{title:detail?'RAID RANKINGS':'WORLD BOSS / TOP 10',color:0xc9a967,description:rows.map(x=>`**#${x.rank} ${x.name}** · Lv.${x.level} ${require('./raid-class-name').name(x.job)} — **${number(x.damage)}** damage${badge(x)}${boost(x)}`).join('\n')||'No participants yet.',footer:{text:detail?`Page ${p+1}/4 • Rankings settle after admitted battles end`:'Rankings settle after admitted battles end'}}];
  if(!detail){
   embeds[0].fields=[{name:'TOTAL PARTICIPANTS',value:number(all.length)}];
   const recent=[...all].sort((a,b)=>b.joined-a.joined||a.id.localeCompare(b.id)).slice(0,4);
   embeds.push({title:'RECENT PARTICIPANTS',color:0x5865f2,description:recent.map(x=>`**${x.name}** · Lv.${x.level} ${require('./raid-class-name').name(x.job)}\n${number(x.damage)} damage · ${x.status==='active'?`In Battle · Currently #${x.rank}`:`${x.status==='defeated'?'Exhausted':'Finished'} · Reached #${x.reached}`}\nJoined <t:${Math.floor(x.joined/1000)}:R>`).join('\n\n')||'No recent participants.'});
  }
  embeds.push({title:'YOUR CONTRIBUTION',color:0x35b6aa,description:me?`**#${me.rank}** · **${number(me.damage)} damage**${badge(me)}${boost(me)}`:'You have not joined this raid.'});
  const button=(label,action,disabled=false)=>({type:2,style:2,label,custom_id:`raidtest:board:${action}`,disabled});
  return {embeds,components:[{type:1,components:detail?[button('Previous',(p+3)%4,p===0),button('Next',(p+1)%4,p===3),button('Overview','home'),button('Refresh',p)]:[button('View Rankings','0'),button('Refresh','home')]}],allowedMentions:{parse:[]}};
 }
 function image(userId,page=0,personal=true,segment=null){
  const all=displayed(),p=Math.max(0,Math.min(3,Math.floor(Number(page)||0))),rank=all.findIndex(x=>x.id===userId);
  return require('./raid-ranking-card').render(all.slice(p*25,p*25+25),{start:p*25,total:all.length,personal,segment,bossName,me:rank<0?null:all[rank]});
 }
 function visual(userId,page=0){
  const p=Math.max(0,Math.min(3,Math.floor(Number(page)||0))),old=render(userId,p);
  const files=Array.from({length:5},(_,i)=>({attachment:image(userId,p,true,i),name:`raid-rankings-${i}.png`}));
  return {embeds:files.map((f,i)=>({color:0xc9a967,image:{url:'attachment://'+f.name},...(i===4?{footer:{text:`Page ${p+1}/4 | 25 challengers per page`}}:{})})),files,attachments:[],components:old.components,allowedMentions:{parse:[]}};
 }
 return {record,render,image,visual,visibleIds:(userId,page=0)=>{const rows=ranked(),p=Math.max(0,Math.min(3,Math.floor(Number(page)||0)));return [...new Set([...rows.slice(p*25,p*25+25).map(x=>x.id),...(userId?[userId]:[])])];},has:id=>members.has(id),snapshot:()=>structuredClone([...members.values()]),restore:rows=>{members.clear();for(const row of rows||[])members.set(row.id,structuredClone(row));}};
}
module.exports={createBoard};
