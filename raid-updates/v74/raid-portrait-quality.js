'use strict';
const packs=new Map();
function frame(job,pose){
 if(job==='paladin'&&pose==='divine_smite')return require('./raid-divine-smite.json').normal;
 if(job==='berserker')return require('./raid-berserker-art').frame(pose);
 if(!['warrior','paladin','berserker'].includes(job))return null;
 const fresh=require('./raid-rework-poses-'+job+'.json');if(fresh[pose])return fresh[pose];
 if(!packs.has(job))packs.set(job,require('./raid-portraits-'+job+'.json'));
 const aliases=job==='warrior'?{guard_prepare:'guard',guard_hold:'guard',guard_block:'guard',thrust_prepare:'thrust',thrust_hit:'thrust',parry_prepare:'parry',stagger:'hit',ready:'idle'}:{};
 return packs.get(job)[aliases[pose]||pose]||null;
}
module.exports={frame};
