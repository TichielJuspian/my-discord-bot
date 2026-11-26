'use strict';
const fs=require('node:fs'),path=require('node:path'),cache=new Map();
const portraits=Object.freeze({paladin:"paladin-choice-v430.png",berserker:"berserker-choice-v430.png",warrior:"blader-choice-v430.png"});
function asset(job,metadataOnly=false){const name=job==='banner'?"choice-banner-v430.png":(Object.hasOwn(portraits,job)?portraits[job]:portraits.paladin);if(!metadataOnly&&!cache.has(name))cache.set(name,fs.readFileSync(path.join(__dirname,name)));return {name,attachment:metadataOnly?undefined:cache.get(name),description:job==='banner'?'Choose your class':job+' class portrait'};}
module.exports={asset};
