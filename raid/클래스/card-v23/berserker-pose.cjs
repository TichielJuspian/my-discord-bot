'use strict';
const B=require('../광전사/berserker-rules.cjs');
function select(a,selected){
 const s=a.state,f=a.cardFrame,l=f?.lastTurn?.log||f?.log||s.log.at(-1)||{},e=l.berserker||s.berserkerEvent||{},d=l.defenseLog||l;
 if(['defeat','evade','last_stand','ultimate'].includes(selected))return selected;
 const prefix=B.enraged(s)?'enrage_':'';
 if(f?.aborted)return prefix+'idle';
 const charge=B.stage(s);
 if(f?.interactive||selected==='idle')return prefix+(charge?'charge_'+charge:'idle');
 if(['hit','heavy_hit'].includes(selected))return ['shoulder_tackle','tackle'].includes(d.action)&&!d.chargeBroken?prefix+'tackle':selected;
 if(selected==='attack'){const released=Math.min(3,Math.max(0,Number(e.released)||0));return prefix+(released?'charged_attack_'+released:'attack');}
 if(selected==='charge')return prefix+'charge_'+Math.max(1,B.stage(s));
 if(['blood_draw','tackle'].includes(selected))return prefix+selected;
 return prefix+'idle';
}
module.exports={select};
