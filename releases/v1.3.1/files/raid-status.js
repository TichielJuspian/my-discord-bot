'use strict';
const path=require('node:path');
function bar(value,max,size=10){const n=Math.max(0,Math.min(size,Math.ceil(value/Math.max(1,max)*size)));return '▰'.repeat(n)+'▱'.repeat(size-n);}
function display(active,p,boss,phase,initial){
 const s=active.state,last=s.log.at(-1),ended=s.status!=='active';
 const energy=Math.max(0,Math.min(s.maxEnergy,s.energy));
 p.content='**GEN RAID** · Private test · No rewards';
 p.embeds=[{title:boss,color:0xc9a967,image:{url:'attachment://raid-art.png'}},{
  title:`⚔️ ${active.playerName||'Gosu General'} · Lv.${s.config.level} Blader`,color:ended?0x64748b:0x35b6aa,
  description:`❤️ **HP ${s.hp} / ${s.stats.hp}**\n${bar(s.hp,s.stats.hp)}\n\n💠 **Energy ${s.energy} / ${s.maxEnergy}**\n${'🔷'.repeat(energy)}${'◇'.repeat(s.maxEnergy-energy)}`,
  fields:[
   {name:'👹 Boss HP',value:`${bar(s.bossHP,s.bossMaxHP||require('./raid-boss-health').maximum(s.config.boss))} **${s.bossHP.toLocaleString()} / ${s.bossMaxHP||require('./raid-boss-health').maximum(s.config.boss)}**`},
   {name:ended?'🏁 Result':'⚠️ Next pattern',value:ended?s.status.toUpperCase():phase},
   {name:'⚔️ Attack / 🛡️ Defense / ✨ Crit',value:`**${s.stats.attack}** / **${s.stats.defense}** / **${s.stats.crit}%** · Slots +${s.enhancements.weapon}`},
   {name:'Skills',value:`⚔️ **Thrust · 2 energy** — ATK × 2 + Level\n🛡️ **Guard** — defend this turn\n✨ **Parry · 1 energy** — ${Math.round(s.config.warriorParryChance*100)}% success; perfect parry restores 1 energy.`},
   ...(last?[{name:`Turn ${last.turn} · ${last.action.replaceAll('_',' ')}`,value:`💥 Damage **${last.damage}** · Counter **${last.counterDamage}**\n💔 Taken **${last.incoming}** + ongoing **${last.dot}** + mechanic **${last.mechanicDamage||0}**${last.parryResult?'\nParry: **'+last.parryResult+'**':''}`}]:[])
  ],footer:{text:`Total damage ${s.totals.damage} · Turn ${s.turn} · No action = no turn passes`}
 }];
 // Button edits preserve the existing attachment; no rendering or re-upload.
 if(initial){p.attachments=[];p.files=[{attachment:path.join(__dirname,'raid-maple.png'),name:'raid-art.png'}];}
 return p;
}
module.exports={display,bar};
