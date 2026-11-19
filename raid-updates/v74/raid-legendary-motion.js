'use strict';
const {inflateSync}=require('node:zlib'),packs=new Map();
const aliases={warrior:{ready:'idle',guard_prepare:'guard',guard_hold:'guard',guard_block:'guard',thrust_prepare:'thrust',thrust_hit:'thrust',parry_prepare:'parry',parry_success:'parry',stagger:'hit'},paladin:{guard:'guard_hold',ultimate:'judgment'},berserker:{ultimate:'ultimate-white',evade:'evade-white'}};
function frame(job,pose,equipped,enraged=false){
 if(!require('./raid-legendary-appearance').active(job,equipped))return null;
 if(job==='paladin'&&pose==='divine_smite')return require('./raid-divine-smite.json').legendary;
 const key=job==='berserker'&&(enraged||pose.startsWith('enrage-'))?'berserker-enrage':job;
 if(job==='berserker')pose=pose.replace(/^enrage-/,'').replace(/^tackle-charge-\d$/,'tackle');
 const fresh=job==='berserker'?{}:require('./raid-rework-poses-'+job+'-legendary.json');
 let f=fresh[pose];
 if(!f){
  if(!packs.has(key))packs.set(key,require('./raid-legendary-poses-'+key+'.json'));
  f=packs.get(key)[aliases[job]?.[pose]||pose];
 }
 if(!f)return null;
 if(!f.cardPixels)Object.defineProperty(f,'cardPixels',{value:inflateSync(Buffer.from(f.cardRgba,'base64'))});
 return f;
}
module.exports={frame};
