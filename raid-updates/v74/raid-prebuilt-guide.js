'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');let valid;
function fingerprint(){return crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'raid-skill-guide.js'))).update(fs.readFileSync(path.join(__dirname,'berserker-guide.cjs'))).digest('hex');}
function assets(s,page){if(!['core','passives'].includes(page)||s.config.level<1)return null;if(valid===undefined){try{valid=JSON.parse(fs.readFileSync(path.join(__dirname,'skill-ready-manifest.json'),'utf8')).fingerprint===fingerprint();}catch{valid=false;}}if(!valid)return null;const job=s.config.job,skin=require('./raid-legendary-appearance').active(job,s.workshop?.equipped)?'legendary':'normal';try{return JSON.parse(fs.readFileSync(path.join(__dirname,'skill-ready-'+job+'-'+skin+'-'+page+'.json'),'utf8')).map(f=>({...f,attachment:Buffer.from(f.attachment,'base64')}));}catch{return null;}}
module.exports={assets,fingerprint};
