'use strict';
const DAMAGE=[{normal:50,heavy:110,mechanicDamage:200},{normal:100,heavy:220,mechanicDamage:300},{normal:175,heavy:385,mechanicDamage:400},{normal:300,heavy:660,mechanicDamage:null}];
const level=s=>s.director?.enrageLevel||0;
// Shared Maximum growth: +one normal-stage base every three displayed turns.
// This is additive (6x, 7x, 8x...), not compound growth. Never reset for a new pattern.
const MAXIMUM_GROWTH=Object.freeze({turnInterval:3,entryMultiplier:6,increment:1});
function maximumSteps(s){if(level(s)!==3)return 0;const start=s.director?.stageStart,turn=s.turn;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(turn))return 0;return Math.max(0,Math.floor((turn-start)/MAXIMUM_GROWTH.turnInterval));}
function scaleAttack(s,raw){return level(s)===3?raw*(MAXIMUM_GROWTH.entryMultiplier+maximumSteps(s)*MAXIMUM_GROWTH.increment)/MAXIMUM_GROWTH.entryMultiplier:raw;}
function baseValues(s){const l=level(s),base=s.config?.boss==='nameless_succubus'?{normal:50,heavy:90}:{normal:50,heavy:110},ratio=[1,2,3.5,6][l];return {...DAMAGE[l],normal:base.normal*ratio,heavy:base.heavy*ratio};}
function values(s){const base=baseValues(s);return {...base,normal:scaleAttack(s,base.normal),heavy:scaleAttack(s,base.heavy)};}
function due(s){const l=level(s);if(require('./pattern-profiles.cjs').active(s)){const P=require('./pattern-profiles.cjs');P.ensure(s);return l===0?s.totals.damage>=15000:l===1?s.totals.damage>=50000:l===2&&s.turn-s.director.stageTurnStart>=30;}return l<3&&(s.turn>=[21,41,61][l]||s.totals.damage>=[4000,15000,40000][l]);}
function enter(s){const d=s.director;d.enrageLevel=Math.min(3,level(s)+1);d.stageStart=s.turn;d.stageDamage=s.totals.damage;d.rampages=0;d.rampageActive=false;d.rampageFinished=null;delete d.pendingEnrageLevel;}
module.exports={DAMAGE,level,values,due,enter,label:s=>['','ENRAGE � LEVEL 1','ENRAGE � LEVEL 2','ENRAGE � MAXIMUM'][level(s)],MAXIMUM_GROWTH,maximumSteps,baseValues,scaleAttack,maximumDue:()=>false,maximum:()=>false};
