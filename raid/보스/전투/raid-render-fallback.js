const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Keep committed state and usable controls even when native rendering is unavailable.
function render(p,{view=null}={}){
 const s=p.frame.state,l=p.frame.lastTurn?.log||p.frame.log||s.log.at(-1)||{};
 const text=content=>({type:10,content});
 const lines=[`**${s.config.boss==='earth'?'Earth Colossus':'Nameless Succubus'} · Turn ${s.turn}**`,`Boss HP ${s.worldBossHP??s.bossHP} / ${s.bossMaxHP}`,`**${s.config.job} · Level ${s.config.level}**`,`HP ${s.hp} / ${s.stats.hp} · Energy ${s.energy} / ${s.maxEnergy}`,`Damage dealt ${l.damage||0} · Damage received ${l.incoming||0}`,`Total damage ${s.totals?.damage||0}`,'Image temporarily unavailable. Your battle is saved.'];
 const buttons=(p.ready?p.actions:[]).map(action=>({type:2,style:2,label:action.replace(/_/g,' '),custom_id:`raidtest:${p.id}:${p.revision}:${action}`}));
 if(p.ready)buttons.push({type:2,style:2,label:view==='menu'?'Close Menu':'Menu',custom_id:`raidtest:${p.id}:${p.revision}:${view==='menu'?'battle':'menu'}`});
 if(view==='menu'||s.status!=='active')for(const [action,label]of (s.status==='active'?[['skills','Skill guide'],['retreat','End battle']]:[['retreat','End battle']]))buttons.push({type:2,style:action==='retreat'?4:2,label,custom_id:`raidtest:${p.id}:${p.revision}:${action}`});
 const ButtonRows=require('./raid-button-icons.js');
 const actions=buttons.length?ButtonRows.limitRows([{type:1,components:buttons}]):[];
 actions.forEach(ButtonRows.decorate);
 const components=[text(lines.join('\n')),...actions,require('./흐름/status-panels.cjs').buildBattleStatusPanel(s)];
 return {flags:32768,attachments:[],files:[],components,allowedMentions:{parse:[]}};
}
module.exports={render};
