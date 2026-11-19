'use strict';
const M=require('./raid-workshop-model');
function sections(a,pending){
 const selected=pending?.action==='equip'?pending.value:null;if(pending&&!selected)return [];
 const ids=selected?[selected]:Object.values(a.equipped),out=[];
 for(const id of ids){const item=M.ITEMS[id];if(!item)continue;if(item.quality)out.push({title:item.name.toUpperCase()+' / '+item.quality.toUpperCase()+' ROLL',color:item.rarity==='Epic'?'#c17aff':'#65adff',lines:['Quality '+item.roll+'/100. Rolled stats are permanent.', 'Stat range: 90% to 110% of base. Equipping never rerolls.']});
 if(item.damagePercent)out.push({title:'DAMAGE BONUS',color:'#ffd365',lines:['All outgoing attack damage +'+item.damagePercent+'%.','Applied before actual damage and life-steal are resolved.']});}

 if(ids.some(id=>/_legendary_(weapon|armor)$/.test(id||'')))out.push({title:'SET BONUS / LEGENDARY APPEARANCE',color:'#ffd365',lines:['Equip both class-exclusive weapon and armor to activate','the legendary appearance and skill effects.']});
 return out;
}
function svg(a,pending,y,text){let body='';for(const section of sections(a,pending)){body+=`<rect x="28" y="${y}" width="944" height="100" rx="12" fill="#142033" stroke="${section.color}" stroke-opacity=".55"/><rect x="28" y="${y+14}" width="4" height="72" rx="2" fill="${section.color}"/>`+text(48,y+29,section.title,17,section.color)+text(48,y+56,section.lines[0],18,'#e3edf9')+text(48,y+81,section.lines[1],18,'#b8ccdf');y+=112;}return {body,y};}
module.exports={sections,svg};
