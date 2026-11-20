'use strict';
const fs = require('node:fs');
const path = require('node:path');
const index = require('./choice-index-l.json');
const cache = new Map();

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
  const visible = guideRecords(job, resolveTab(tab)).map(sheet);
  return {position:0, files:visible, visible};
}
function guideRecords(job, tab = null) {
  const key = Object.hasOwn(index, job) ? job : 'warrior';
  if (tab != null) return index[key][resolveTab(tab)];
  return ['core', 'passives', 'growth'].flatMap(p => index[key][p]);
}

function fullGuide(job) {
  return guideRecords(job).map(sheet);
}
function appendGuide(job, appendAsset) {
  guideRecords(job).forEach((record,index)=>{
    const id=100+index;
    appendAsset(record,id,()=>sheet(record));
  });
}

function guideBody(job) {
  const files=[],components=[];
  appendGuide(job,(record,_id,load)=>{files.push(load());components.push(gallery(record));});
  return {files,components};
}
module.exports = {reader, fullGuide, guideRecords, sheet, appendGuide, guideBody, tabs, labels, resolveTab, gallery};
