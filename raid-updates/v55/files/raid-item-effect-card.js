'use strict';
const M=require('./raid-workshop-model');
function sections(a,pending){
 const selected=pending?.action==='equip'?pending.value:null;if(pending&&!selected)return [];
 const ids=selected?[selected]:Object.values(a.equipped),out=[];
 if(ids.some(id=>/_legendary_(weapon|armor)$/.test(id||'')))out.push({title:'SET BONUS / LEGENDARY APPEARANCE',color:'#ffd365',lines:['Equip both class-exclusive weapon and armor to activate','the legendary appearance and skill effects.']});
 if(ids.includes('unique_relic')&&a.job!=='paladin')out.push({title:'TRINITY RELIC / CLASS EFFECT',color:'#ff6d83',lines:({warrior:['Crit Chance +35% / ATK +50.','Warrior-exclusive accessory stats.'],paladin:['Crit Chance +35% / ATK +50.','No additional skill effect.'],berserker:['Crit Chance +35% / ATK +50.','Grand Attack or Ragnarok: recover up to 2 energy.']})[a.job]});
 if(ids.includes('berserker_legendary_accessory'))out.push({title:'SOLAR WARCREST / ENERGY RETURN',color:'#ffd365',lines:['Crit Chance +35% / ATK +50.','Grand Attack or Ragnarok: recover up to 2 energy.']});
 if(ids.includes('paladin_legendary_weapon'))out.push({title:'SOLAR HAMMER / ENERGY RETURN',color:'#ffd365',lines:['Smash: 20% chance on cast to refund 1 energy.','Triggers independently on each cast.']});
 if(ids.includes('warrior_legendary_weapon'))out.push({title:'OCEAN BLADE / THRUST MASTERY',color:'#ffd365',lines:['Deep Thrust requires 15 evolution progress instead of 20.','Thrust +1 / Slash +2 progress before evolution.']});
 if(ids.includes('warrior_legendary_armor'))out.push({title:'OCEAN ARMOR / LAST RESOLVE',color:'#ffd365',lines:['Normal Parry uses the standard 60% damage reduction.','Total DEF contributes to Perfect chance and reduction.']});
 return out;
}
function svg(a,pending,y,text){let body='';for(const section of sections(a,pending)){body+=`<rect x="28" y="${y}" width="944" height="100" rx="12" fill="#142033" stroke="${section.color}" stroke-opacity=".55"/><rect x="28" y="${y+14}" width="4" height="72" rx="2" fill="${section.color}"/>`+text(48,y+29,section.title,17,section.color)+text(48,y+56,section.lines[0],18,'#e3edf9')+text(48,y+81,section.lines[1],18,'#b8ccdf');y+=112;}return {body,y};}
module.exports={sections,svg};
