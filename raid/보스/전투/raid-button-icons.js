const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Native emoji require no guild upload or extra permission. Optional custom IDs
// may be supplied later in raid-button-emoji.json without changing action IDs.
const defaults=Object.freeze({attack:'⚔️',charge:'🔥',blood_transfusion:'🩸',bloodletting:'🩸',shoulder_tackle:'🛡️',tackle:'🛡️',guard:'🛡️',magic_guard:'🔮',parry:'🛡️',magic_parry:'🛡️',thrust:'🔱',slash:'🌙',smash:'🔨',prayer:'✨',blessing:'✨',heal:'💚',ultimate:'💥',berserker_ultimate:'💥',resonant_wave:'💥',emergency_evade:'💨',cleanse:'💧',menu:'☰',battle:'↩️',equipment:'🛡️',skills:'📖',effects:'✨',retreat:'🚪',end_battle:'🚪',offer_yes:'✅',offer_no:'❌',offer_next:'▶️'});
const allowed=new Set(['charge','prayer','blessing','parry','magic_parry']);
let custom;try{custom=require('./raid-button-emoji.json');}catch{custom={};}
function emoji(action){if(!allowed.has(action))return undefined;if(['parry','magic_parry'].includes(action))return {name:'🛡️'};const value=custom[action];return value&&/^\d{17,20}$/.test(String(value.id))?{id:String(value.id),name:value.name||action,animated:!!value.animated}:{name:action==='menu'?'📋':defaults[action]||'🔹'};}
function decorate(node){if(!node||typeof node!=='object')return node;if(node.type===2&&node.custom_id){const action=node.custom_id.split(':').at(-1);if(allowed.has(action))node.emoji=['parry','magic_parry'].includes(action)?emoji(action):node.emoji||emoji(action);else delete node.emoji;}for(const c of node.components||[])decorate(c);return node;}
const MAX_BUTTONS_PER_ROW=3;
function limitRows(nodes){
 return nodes.flatMap(node=>{
  if(node.type===17)return [{...node,components:limitRows(node.components)}];
  if(node.type!==1||node.components.length<=MAX_BUTTONS_PER_ROW||node.components.some(c=>c.type!==2))return [node];
  const rows=[];
  for(let offset=0;offset<node.components.length;offset+=MAX_BUTTONS_PER_ROW){
   const components=node.components.slice(offset,offset+MAX_BUTTONS_PER_ROW);
   rows.push(offset===0?{...node,components}:{type:1,components});
  }
  return rows;
 });
}
module.exports={emoji,decorate,defaults,limitRows,MAX_BUTTONS_PER_ROW};
