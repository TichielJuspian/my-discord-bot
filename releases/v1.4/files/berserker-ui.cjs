'use strict';
const C=require('./raid-critical-label');
const B=require('./raid-engine/berserker-rules.cjs');
function buttons(s,btn,showMenu=true){
 const row=components=>({type:1,components}),k=B.stage(s),ultimate=Math.max(0,(s.config.level>=90?2:1)-(s.ultimateUses||0)),evade=Math.max(0,(s.config.level>=100?2:1)-(s.emergencyUses||0));
 return [row([btn('attack',B.names[k],k?1:2),btn('charge',(['Charge','Charge Lv.2','Charge Max','Max Charge'][k])),btn('shoulder_tackle','Tackle / +1 Energy',1),btn('blood_transfusion','Blood Draw',1)]),row([...(s.config.level>=10?[btn('berserker_ultimate',ultimate?'Ragnarok · '+ultimate+' left':'Ultimate Used',3)]:[]),btn('emergency_evade',evade?'Evade · '+evade+' left':'Evade Used',3),...(showMenu?[btn('menu','Menu')]:[])])];
}
function effects(s){return B.isBerserker(s)?[
 ...(B.enraged(s)?[{name:'Enrage',shape:'bolt',count:1,bad:false,description:'ATK +80% (base ATK display unchanged) / Direct damage taken -60%'}]:[]),
 ...((s.berserkerBloodEnergy||0)>0?[{name:'Blood Draw',shape:'bolt',count:s.berserkerBloodEnergy,bad:false,description:'Next Grand Attack: '+Math.min(100,s.berserkerBloodEnergy*10)+'% guaranteed-critical proc; otherwise normal CRIT. No raw CRIT increase.'}]:[]),
 ...(B.stage(s)?[{name:'Charge',shape:'sword',count:B.stage(s),bad:false,description:'Next Attack: '+B.MULTIPLIERS[B.stage(s)]*100+'% ATK. Heavy or special hits can break charge.'}]:[])]:[];}
function title(l){const e=l.berserker;if(!e)return null;
 if(l.charmBlocked)return 'Charmed! Attack interrupted';
 if(e.action==='charge')return 'Charge '+(Math.min(3,e.chargeBefore+1+(e.chargeBonusUsed||0))===3?'Max':'Lv.'+Math.min(3,e.chargeBefore+1+(e.chargeBonusUsed||0)));
 if(e.action==='blood_transfusion')return 'Blood Draw / HP -'+e.selfDamage+' / Absorbed '+e.absorbedEnergy+' energy';
 if(e.action==='shoulder_tackle')return 'Tackle / Energy +'+e.energyGain+(e.chargeAfter>e.chargeBefore?' / Charge +1':'')+(e.chargeAfter?' · '+(e.chargeAfter===3?'Max':'Lv.'+e.chargeAfter)+' kept':'');
 if(e.action==='berserker_ultimate')return (l.critical?C.label(C.tier(l))+' ':'')+'Ragnarok! '+l.damage+' damage';
 return l.damage>0?(l.critical?C.label(C.tier(l))+' ':'')+e.attackName+'! '+l.damage+' damage':null;
}
function feed(m,s,l){if(!B.isBerserker(s))return m;const own=title(l);if(own)m.own=own;const details=[];if(l.berserker?.bloodEnergyUsed)details.push('Blood Draw: '+Math.min(100,l.berserker.bloodEnergyUsed*10)+'% guaranteed-critical proc (otherwise normal CRIT)');if(l.berserker?.chargeGained)details.push('Charge +'+l.berserker.chargeGained);if(l.berserker?.relicEnergyGain)details.push('Warcrest: Energy +'+l.berserker.relicEnergyGain);if(details.length)m.ownDetail=details.join(' / ');if(l.berserker?.action==='berserker_ultimate')m.boss='Ragnarok / Direct hit';
 if(l.groggy)m.boss='Groggy / No boss attack';
 if(s.berserkerGroggy>0&&s.status==='active'&&!s.offer?.screen?.match(/prelude|choice|result/)){m.storyLines=['The boss is groggy.'];m.secondary=s.berserkerGroggy+' turns remaining.';m.sub=m.storyLines[0];m.progress=null;m.mechanicText='';}
 if(l.berserker?.chargeBroken)m.bossDetail='Charge broken';
 return m;
}
module.exports={buttons,effects,title,feed};
