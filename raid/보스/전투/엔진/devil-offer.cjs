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
function copyEffect(o){return o?.remaining>0?{outgoing:o.outgoing||0,incoming:o.incoming||0,lifesteal:o.lifesteal||0,...(o.attack?{attack:o.attack}:{}),...(o.defense?{defense:o.defense}:{}),...(o.energyMultiplier>1?{energyMultiplier:o.energyMultiplier}:{}),remaining:o.remaining}:null;}
function ensureEffects(s){if(active(s)&&!Object.hasOwn(s,'offerEffects'))s.offerEffects=copyEffect(effects(s));return s;}

const outcomes={yes:[
 {weight:30,outgoing:.2,incoming:.3},
 {weight:30,outgoing:.1,incoming:.2},
 {weight:10,lifesteal:.02,charm:3},
 {weight:20,attack:.2,defense:-.2},
 {weight:10,outgoing:.3,incoming:.4}
],no:[
 {weight:10,drainEnergy:true},
 {weight:30,attack:-.2},
 {weight:20,energyMultiplier:2},
 {weight:30,outgoing:-.1},
 {weight:10,attack:-.3}
]};
const stat=(s,key)=>s.stats[key]*(1+(effects(s)?.[key]||0));
const energyCost=(s,base)=>base*(effects(s)?.energyMultiplier||1);
// Unmigrated pre-V2 battles retain their original result table. New supported
// Succubus sessions always use the three V2 adapters and the v4.1.1 table.
const legacyOutcomes={yes:[
 {weight:30,outgoing:.2,incoming:.2},{weight:30,outgoing:.3,incoming:.3},
 {weight:20,lifesteal:.05,charm:5},{weight:10,outgoing:-.2,incoming:-.2},{weight:10,outgoing:.2,lifesteal:.05}
],no:[
 {weight:30,outgoing:-.1,healRate:.1},{weight:10,healRate:.2},
 {weight:30,energyCost:2,healRate:.05},{weight:20,hpCost:.1,outgoing:.2},{weight:10,hpCost:.2}
]};
function pick(choice,roll,table=outcomes){if(!(roll>=0&&roll<1))throw Error('Invalid offer roll');let n=roll*100;for(const [index,result] of table[choice].entries()){n-=result.weight;if(n<0)return {...result,index};}throw Error('Invalid offer weights');}
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
function resolve(original,action,expectedTurn=original.turn,{legacy=false}={}){if(original.status!=='active'||expectedTurn!==original.turn||!pending(original)||!actions(original).includes(action))throw Error('Unavailable or stale offer action');const s=structuredClone(original);ensureEffects(s);
 if(action==='retreat'){s.status='retreated';return s;}
 if(action==='offer_continue'){s.offer.screen='choice';return s;}
 if(action==='offer_next'){s.offer.screen='active';require('./common-pattern-director.cjs').afterOffer(s);return s;}
 const choice=action==='offer_yes'?'yes':'no';
 // V2 third refusal is a contract-penalty receipt, not a normal NO outcome.
 // Preserve a prior ongoing modifier untouched; the engine owns the separate penalty.
 if(!legacy&&choice==='no'&&(s.contractRefusals||0)>=2){
  const scene={};for(const key of ['stage','guaranteed'])if(Object.hasOwn(s.offer,key))scene[key]=s.offer[key];
  s.offer={...scene,screen:'result',choice,thirdRefusal:true,remaining:0};
  log(s,action);
  return s;
 }
 const result=pick(choice,roll(s),legacy?legacyOutcomes:outcomes);
 const energyStart=s.energy,energyCost=legacy?Math.min(energyStart,result.energyCost||0):result.drainEnergy?energyStart:0,hpLoss=legacy?Math.floor(s.hp*(result.hpCost||0)):result.drainEnergy&&energyStart===0?Math.min(Math.max(0,s.hp-1),Math.floor(s.stats.hp*.1)):0;
 s.energy-=energyCost;s.hp-=hpLoss;
 const heal=Math.min(require('../../../클래스/광전사/berserker-rules.cjs').healCapacity(s),Math.floor(s.stats.hp*(result.healRate||0)));s.hp+=heal;s.totals.healing+=heal;
 if(result.charm)s.charmTurns=(s.charmTurns||0)+result.charm;
 const ongoing=!!(result.outgoing||result.incoming||result.lifesteal||result.attack||result.defense||result.energyMultiplier>1),remaining=ongoing?(choice==='yes'?3:4):0;
 // Preserve scene identity only; never spread previous modifier/result fields.
 const scene={};for(const key of ['stage','guaranteed'])if(Object.hasOwn(s.offer,key))scene[key]=s.offer[key];
 s.offer={...scene,...result,screen:'result',choice,remaining,heal,energyCost,hpLoss};
 s.offerEffects=copyEffect({...result,remaining});
 log(s,action,heal);const entry=s.log.at(-1);entry.energyStart=energyStart;entry.energyEnd=s.energy;
 if(energyCost)entry.energyEntries=[{reason:"Devil's Offer",applied:-energyCost,requested:legacy?-2:-energyCost}];
 return s;
}
function afterCombat(before,next){if(!active(next))return;require('./pattern-profiles.cjs').recordCombat(before,next);next.director.offerCombat=(before.director.offerCombat||0)+1;const previous=effects(before);next.offerEffects=previous?copyEffect({...previous,remaining:Math.max(0,previous.remaining-1)}):null;if(['active','result'].includes(next.offer?.screen))next.offer.remaining=next.offerEffects?.remaining||0;}
module.exports={stat,energyCost,active,quota,probability,guaranteedPending,onStageEnter,pending,init,schedule,actions,resolve,afterCombat,outcomes,pick,begin,effects,ensureEffects};
