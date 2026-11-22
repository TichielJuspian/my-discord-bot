const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const cache=new Map(),poses=new Set(['idle','attack','hit','blood-transfusion','charge-1','charge-2','charge-3','charged-attack-1','charged-attack-2','charged-attack-3','tackle','tackle-charge-1','tackle-charge-2','tackle-charge-3','enrage-idle','enrage-attack','enrage-hit','enrage-blood-transfusion','enrage-charge-1','enrage-charge-2','enrage-charge-3','enrage-charged-attack-2','enrage-charged-attack-3','enrage-tackle','enrage-tackle-charge-1','enrage-tackle-charge-2','enrage-tackle-charge-3','evade-white','ultimate-white','last_stand']);
// Camera windows in the original 512px sprite canvas; original art stays intact.
function camera(pose){
 if(pose==='ultimate-white')return {x:76,y:152,size:360};
 if(pose.includes('tackle'))return {x:250,y:265,size:240};
 if(/charged-attack-[23]$/.test(pose))return {x:130,y:190,size:320};
 if(pose==='attack'||pose==='enrage-attack'||pose.includes('charged-attack'))return {x:85,y:150,size:360};
 return {x:0,y:0,size:512};
}
function frame(pose){if(!poses.has(pose))return null;let f=cache.get(pose);if(f){cache.delete(pose);cache.set(pose,f);return f;}f=JSON.parse(fs.readFileSync(runtimePaths.join(runtimePaths.directory("."),'berserker-v2-'+pose+'.json'),'utf8'));f.cardPixels=z.inflateSync(Buffer.from(f.cardRgba,'base64'));f.cardView=camera(pose);cache.set(pose,f);while(cache.size>8)cache.delete(cache.keys().next().value);return f;}
module.exports={frame,camera};
