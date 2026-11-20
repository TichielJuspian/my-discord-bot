const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
const stages=require('./enrage-stages.cjs');
const active=s=>s.config.boss==='nameless_succubus';
const quota=s=>[0,1,1,1][stages.level(s)];
// Scheduling is owned exclusively by the common pattern director.
const probability=s=>0;
const stageCount=s=>s.director.offerStageCounts?.[stages.level(s)]||0;
const guaranteedPending=s=>active(s)&&stageCount(s)<quota(s);
function onStageEnter(s){if(!active(s))return;const d=s.director,stage=stages.level(s);d.offerStageCounts={...(d.offerStageCounts||{}),[stage]:0};d.offers=0;}
const pending=s=>active(s)&&['prelude','choice','result'].includes(s.offer?.screen);
// The scene/result record and currently active numeric modifiers are independent.
// Explicit null prevents a result without modifiers from reviving a legacy buff.
function effects(s){
 if(!active(s))return s.offer?.screen==='active'&&s.offer.remaining>0?s.offer:null;
 if(Object.hasOwn(s,'offerEffects'))return s.offerEffects?.remaining>0?s.offerEffects:null;
 return ['active','result'].includes(s.offer?.screen)&&s.offer.remaining>0?s.offer:null;
}
function copyEffect(o){return o?.remaining>0?{outgoing:o.outgoing||0,incoming:o.incoming||0,lifesteal:o.lifesteal||0,remaining:o.remaining}:null;}
function ensureEffects(s){if(active(s)&&!Object.hasOwn(s,'offerEffects'))s.offerEffects=copyEffect(effects(s));return s;}

const outcomes={yes:[
 {weight:30,outgoing:.2,incoming:.2},
 {weight:30,outgoing:.3,incoming:.3},
 {weight:20,lifesteal:.05,charm:5},
 {weight:10,outgoing:-.2,incoming:-.2},
 {weight:10,outgoing:.2,lifesteal:.05}
],no:[
 {weight:30,outgoing:-.1,healRate:.1},
 {weight:10,healRate:.2},
 {weight:30,energyCost:2,healRate:.05},
 {weight:20,hpCost:.1,outgoing:.2},
 {weight:10,hpCost:.2}
]};
function pick(choice,roll){if(!(roll>=0&&roll<1))throw Error('Invalid offer roll');let n=roll*100;for(const [index,result] of outcomes[choice].entries()){n-=result.weight;if(n<0)return {...result,index};}throw Error('Invalid offer weights');}
function roll(s){let x=s.director.offerRandom??((s.rng??s.seed??1)^0x7f4a7c15);x=(Math.imul(x,1664525)+1013904223)>>>0;s.director.offerRandom=x;return x/4294967296;}
function init(s){if(active(s)){s.offerEffects=null;Object.assign(s.director,{enrageLevel:0,stageStart:1,stageDamage:0,offers:0,offerStageCounts:{},offerChanceRandom:((s.rng??1)^0x2c1b3c6d)>>>0});s.bossHP=require('../raid-boss-health.js').maximum('nameless_succubus');s.bossMaxHP=s.bossHP;}}
function log(s,action,heal=0){s.log.push({turn:s.turn,phase:action,action,damage:0,incoming:0,dot:0,mechanicDamage:0,counterDamage:0,heal,hp:s.hp,energyStart:s.energy,energyEnd:s.energy,energyEntries:[],offerCinematic:true});s.turn++;}
function begin(s,guaranteed){if(!active(s)||pending(s)||(s.status&&s.status!=='active'))throw Error('Unavailable offer entry');s.offerEffects=copyEffect(effects(s));const stage=stages.level(s),d=s.director;d.offers=(d.offers||0)+1;d.offerStageCounts={...(d.offerStageCounts||{}),[stage]:stageCount(s)+1};
 // Scene entry only. The pattern director starts the five-combat cooldown
 // after the result screen is completed, not on this cinematic entry.
 d.phase='devil_offer';d.queue=[];s.offer={screen:'prelude',stage,guaranteed:!!guaranteed};log(s,'devil_offer');
 const entry=s.log.at(-1);entry.offerStage=stage;entry.offerGuaranteed=!!guaranteed;
}
// Compatibility export: there is no independent chance or second scheduler.
function schedule(){return false;}
function actions(s){return s.offer?.screen==='prelude'?['offer_continue','retreat']:s.offer?.screen==='choice'?['offer_yes','offer_no','retreat']:['offer_next','retreat'];}
function resolve(original,action,expectedTurn=original.turn){if(original.status!=='active'||expectedTurn!==original.turn||!pending(original)||!actions(original).includes(action))throw Error('Unavailable or stale offer action');const s=structuredClone(original);ensureEffects(s);
 if(action==='retreat'){s.status='retreated';return s;}
 if(action==='offer_continue'){s.offer.screen='choice';return s;}
 if(action==='offer_next'){s.offer.screen='active';require('./common-pattern-director.cjs').afterOffer(s);return s;}
 const choice=action==='offer_yes'?'yes':'no',result=pick(choice,roll(s));
 const energyStart=s.energy,energyCost=Math.min(s.energy,result.energyCost||0),hpLoss=Math.floor(s.hp*(result.hpCost||0));
 s.energy-=energyCost;s.hp-=hpLoss;
 const heal=Math.min(require('../../../클래스/광전사/berserker-rules.cjs').healCapacity(s),Math.floor(s.stats.hp*(result.healRate||0)));s.hp+=heal;s.totals.healing+=heal;
 if(result.charm)s.charmTurns=(s.charmTurns||0)+result.charm;
 const ongoing=!!(result.outgoing||result.incoming||result.lifesteal),remaining=ongoing?(choice==='yes'?3:4):0;
 // Preserve scene identity only; never spread previous modifier/result fields.
 const scene={};for(const key of ['stage','guaranteed'])if(Object.hasOwn(s.offer,key))scene[key]=s.offer[key];
 s.offer={...scene,...result,screen:'result',choice,remaining,heal,energyCost,hpLoss};
 s.offerEffects=copyEffect({...result,remaining});
 log(s,action,heal);const entry=s.log.at(-1);entry.energyStart=energyStart;entry.energyEnd=s.energy;
 if(energyCost)entry.energyEntries=[{reason:"Devil's Offer",applied:-energyCost,requested:-2}];
 return s;
}
function afterCombat(before,next){if(!active(next))return;require('./pattern-profiles.cjs').recordCombat(before,next);next.director.offerCombat=(before.director.offerCombat||0)+1;const previous=effects(before);next.offerEffects=previous?copyEffect({...previous,remaining:Math.max(0,previous.remaining-1)}):null;if(['active','result'].includes(next.offer?.screen))next.offer.remaining=next.offerEffects?.remaining||0;}
module.exports={active,quota,probability,guaranteedPending,onStageEnter,pending,init,schedule,actions,resolve,afterCombat,outcomes,pick,begin,effects,ensureEffects};
