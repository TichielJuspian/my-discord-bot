'use strict';
const B=require('./raid-booster');
function count(s){return !s.boostUnavailable&&Number.isSafeInteger(s.boostCount)&&s.boostCount>=0?s.boostCount:0;}
function stats(stats,s){pair([stats],s);return stats;}
function pair(items,s){try{const values=items.map(stats=>B.attack(stats.attack,count(s)));items.forEach((stats,i)=>{stats.attack=values[i];});}catch{s.boostUnavailable=true;s.boostCount=0;}}
function label(s){if(s.boostUnavailable)return 'Boost count unavailable; showing attack without boost.';const n=count(s);return 'Boosts '+n+' | ATK +'+(n*10)+'% | x'+(1+n/10);}
async function refresh(s,member,read){try{const r=await read(s.guild,s.user,{member});if(!Number.isSafeInteger(r.effectiveCount)||r.effectiveCount<0)throw Error('Invalid boost count');s.boostCount=r.effectiveCount;s.boostUnavailable=false;}catch{s.boostCount=0;s.boostUnavailable=true;}}
module.exports={count,stats,pair,label,refresh};
