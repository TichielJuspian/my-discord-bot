'use strict';
const DAMAGE=[{normal:50,heavy:110,mechanicDamage:200},{normal:100,heavy:220,mechanicDamage:300},{normal:175,heavy:385,mechanicDamage:400},{normal:300,heavy:660,mechanicDamage:null}];
const level=s=>s.director?.enrageLevel||0;
function values(s){const l=level(s),n=l===3?Math.max(0,Math.floor((s.turn-s.director.stageStart)/3)):0,base=s.config?.boss==='nameless_succubus'?{normal:50,heavy:90}:{normal:50,heavy:110},ratio=[1,2,3.5,6][l]+n;return {...DAMAGE[l],normal:base.normal*ratio,heavy:base.heavy*ratio};}
function due(s){const l=level(s);return l<3&&(s.turn>=[21,41,61][l]||s.totals.damage>=[4000,15000,40000][l]);}
function enter(s){const d=s.director;d.enrageLevel=Math.min(3,level(s)+1);d.stageStart=s.turn;d.stageDamage=s.totals.damage;d.rampages=0;d.rampageActive=false;d.rampageFinished=null;delete d.pendingEnrageLevel;}
module.exports={DAMAGE,level,values,due,enter,label:s=>['','ENRAGE · LEVEL 1','ENRAGE · LEVEL 2','ENRAGE · MAXIMUM'][level(s)],scaleAttack:(s,raw)=>raw,maximumDue:()=>false,maximum:()=>false};
