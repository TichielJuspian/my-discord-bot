'use strict';
const fs = require('node:fs');
const path = require('node:path');
const index = require('./choice-index-l.json');
const cache = new Map();
const supersededRagnarok = 'berserker-part-2-choice-l.png';
const berserkerCoreContinuation = [
  '### Berserker · Core Skills (continued)',
  '**Blood Draw** · Up to 6 Energy',
  'Spend 25% of your current HP without dying. Gain 1 Charge per 3 Energy spent. Each Energy gives your next basic or charged attack +5% critical chance. The bonus stacks up to +50% and ends when you attack.',
  '**Ragnarok** *(Ultimate)* · 1/battle',
  'Deal 250% ATK damage. Grants one guaranteed follow-up attack with 50% more damage. Cancel the current attack or mechanic.',
  '**Emergency Evade** · 1/battle',
  'Evade the current attack and mechanic failure damage. Prevent new curses this turn and keep Charge.',
  '### Charge rules',
  '**Charge loss:** Two consecutive unguarded normal hits, or one unguarded heavy or special hit, clear Charge.',
  '**Charge retention:** Tackle and Emergency Evade preserve Charge. Charged Attacks spend all Charge.',
].join('\n');

const tabs = Object.freeze(['passives', 'core', 'growth']);
const labels = Object.freeze({passives:'Passives',core:'Core Skills',growth:'Level Unlocks'});
const resolveTab = tab => tabs.includes(tab) ? tab : 'core';
const gallery = (f,id,url='attachment://'+f.name) => ({type:12,...(id===undefined?{}:{id}),items:[{media:{url},description:f.description}]});

function sheet(record) {
  if (!cache.has(record.name)) {
    cache.set(record.name, {...record, attachment: fs.readFileSync(path.join(__dirname, record.name))});
  }
  return cache.get(record.name);
}

function reader(job, tab) {
  const visible = guideRecords(job, resolveTab(tab)).filter(record=>record.name!==supersededRagnarok).map(sheet);
  return {position:0, files:visible, visible};
}
function guideRecords(job, tab = null) {
  const key = Object.hasOwn(index, job) ? job : 'warrior';
  if (tab != null) return index[key][resolveTab(tab)];
  return ['core', 'passives', 'growth'].flatMap(p => index[key][p]);
}

function fullGuide(job) {
  return guideRecords(job).filter(record=>record.name!==supersededRagnarok).map(sheet);
}
function appendGuide(job, appendAsset, appendText) {
  guideRecords(job).forEach((record,index)=>{
    const id=100+index;
    if(record.name===supersededRagnarok){appendText({type:10,id,content:berserkerCoreContinuation});return;}
    appendAsset(record,id,()=>sheet(record));
  });
}

function guideBody(job) {
  const files=[],components=[];
  appendGuide(job,(record,_id,load)=>{files.push(load());components.push(gallery(record));},part=>components.push(part));
  return {files,components};
}
module.exports = {reader, fullGuide, guideRecords, sheet, appendGuide, guideBody, tabs, labels, resolveTab, gallery};
