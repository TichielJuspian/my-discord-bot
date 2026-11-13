'use strict';
const path=require('node:path');
function display(a){
 const s=a.state,l=s.log.at(-1);
 const attack=l?.action==='attack'&&l.damage>0;
 const hp=Math.max(0,Math.min(10,Math.ceil(s.hp/Math.max(1,s.stats.hp)*10)));
 return {type:9,components:[
  {type:10,content:`### TURN ${s.turn} · BLADER Lv. ${s.config.level}\n**${String(a.playerName||'Gosu General').replace(/[*_`~<>]/g,'')}**`},
  {type:10,content:`**HP ${s.hp} / ${s.stats.hp}**\n${'🟩'.repeat(hp)}${'⬛'.repeat(10-hp)}\n**ENERGY ${s.energy} / ${s.maxEnergy}** ${'🔹'.repeat(s.energy)}${'▫️'.repeat(Math.max(0,s.maxEnergy-s.energy))}\n-# ATK ${s.stats.attack} · DEF ${s.stats.defense} · CRIT ${s.stats.crit}%`}
 ],accessory:{type:11,media:{url:'attachment://'+(attack?'warrior-attack.gif':'warrior-idle.png')},description:attack?'Blader sword slash — last action, animation repeats':'Blader ready stance'}};
}
function assets(){return ['warrior-attack.gif','warrior-idle.png'].map(name=>({attachment:path.join(__dirname,name),name}));}
module.exports={display,assets};
