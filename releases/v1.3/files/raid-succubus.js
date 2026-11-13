'use strict';
const map=structuredClone(require('./nameless-succubus-assets-v1/boss-art-map.json'));
map.states.enragedIdle.image='../succubus-enraged-idle-waist-v8.jpg';
map.states.enragedBasic2.image='../succubus-enraged-finger-v2.jpg';
map.states.groggy.image='../succubus-groggy-two-v2.jpg';
map.states.enragedGroggy.image='../succubus-groggy-two-v2.jpg';
const active=s=>s.config.boss==='nameless_succubus';
// A queued third strike is one normal attack on its own turn, never a flurry.
function isWingStrike(s,strike=s.director){return require('./raid-engine/enrage-stages.cjs').level(s)>0&&(strike?.hand==='wing'||strike?.comboIndex===3);}
function normalKey(s,strike){return isWingStrike(s,strike)?'basic3':strike?.hand==='left'?'basic1':'basic2';}
function stateKey(s,phase,last,preview=false){
 const rage=require('./raid-engine/enrage-stages.cjs').level(s)>0;
 if(s.bossHP<=0)return 'defeated';if(s.hp<=0)return 'playerExhausted';
 
 if(last?.ultimate)return s.config.job==='warrior'?'warriorUltimateHit':rage?'enragedGroggy':'groggy';
 if(last?.shockwaveInterrupted||last?.curseInterruptedNow||(!preview&&phase==='opening')||s.director?.phase==='opening')return rage?'enragedGroggy':'groggy';
 if(s.director?.phase==='enrage'||phase==='enrage')return 'enragedIdle';
 const upcoming=s.director?.phase;if(preview&&!last?.curseInterruptedNow&&!last?.shockwaveInterrupted)phase=upcoming;
 if(preview&&['warning','heavy'].includes(upcoming))return rage?'enragedHeavyPrepare':'heavyPrepare';
 if(preview&&['mark_warning','mark'].includes(upcoming))return rage?'enragedCursePrepare':'cursePrepare';
 let key=phase==='normal'?normalKey(s,preview?s.director:last):phase==='flurry'?'basic3':phase==='warning'?'heavyPrepare':phase==='heavy'?'heavy':['mark_warning','mark_prepare'].includes(phase)?'cursePrepare':phase==='mark'?'curse':phase?.startsWith('struggle')?'special':'idle';
 if(rage)key='enraged'+key[0].toUpperCase()+key.slice(1);
 if(!map.states[key])key='basic2';return key;
}
// Interactive artwork is a preview of the committed action, never the last result.
function nextArt(s){
 const phase=s.director?.phase||require('./raid-engine/progression-combat.cjs').phase(s),rage=require('./raid-engine/enrage-stages.cjs').level(s)>0;
 if(phase==='opening'){
  const turns=s.berserkerGroggy||1+(s.director?.queue||[]).filter(x=>x==='opening').length;
  return turns>1?['succubus-groggy-two-v2.jpg','GROGGY / '+turns+' TURNS LEFT']:['succubus-groggy-final-closeup.jpg','GROGGY / 1 TURN LEFT'];
 }
 if(phase==='enrage')return [idle(s),'ENRAGE / LEVEL '+require('./raid-engine/enrage-stages.cjs').level(s)];
 if(phase==='recovery')return [idle(s),'RECOVERY / NO BOSS ATTACK'];
 if(phase==='devil_offer')return [idle(s),"DEVIL'S OFFER"];
 if(phase==='struggle_end')return [rage?'succubus-enraged-special-charge-2.jpg':'succubus-special-charge-2.jpg','CRIMSON MIRAGE / RELEASE INCOMING'];
 let key=({normal:normalKey(s,s.director),flurry:'basic3',warning:'heavyPrepare',heavy:'heavy',mark_warning:'cursePrepare',mark_prepare:'cursePrepare',mark:'curse',struggle_start:'special',struggle:'special'})[phase]||'idle';
 if(rage)key='enraged'+key[0].toUpperCase()+key.slice(1);
 const def=map.states[key]||map.states[rage?'enragedBasic2':'basic2'];
 const label=({mark_warning:'CURSE PREPARATION / NOT YET INTERRUPTIBLE BY ORDINARY SKILLS',mark_prepare:'CURSE PREPARATION / ATTACK SKILL CAN INTERRUPT',mark:'CURSE RESOLUTION / INTERRUPT NOW'})[phase];
 return ['nameless-succubus-assets-v1/'+def.image,label||'NEXT ACTION / '+(def.name||key)];
}
function resultState(s,l){return {...s,director:{...s.director,phase:l.phase,hand:l.hand,comboIndex:l.comboIndex??0,enrageLevel:l.bossEnrageLevel??require('./raid-engine/enrage-stages.cjs').level(s)}};}
function art(s,resultOnly=false){const last=s.log.at(-1);
 if(resultOnly&&last)s=resultState(s,last);
 // The contract close-up returns to idle without changing the committed next action.
 if(!resultOnly&&s.offer?.screen==='active'&&s.director?.phase!=='enrage'&&last?.offerCinematic&&s.hp>0&&s.bossHP>0&&(!s.status||s.status==='active'))return [idle(s),'BATTLE READY'];
 if(!resultOnly&&(last||s.director?.phase)&&s.hp>0&&s.bossHP>0&&(!s.status||s.status==='active'))return nextArt(s);
 if(s.hp>0&&s.bossHP>0){
  if(last?.berserker?.action==='berserker_ultimate'&&resultOnly)return ['ragnarok-succubus-impact-v3.jpg','RAGNAROK / DIRECT HIT'];
  if(!resultOnly&&s.berserkerGroggy>0)return s.berserkerGroggy>1?['succubus-groggy-two-v2.jpg','GROGGY / 2 TURNS LEFT']:['succubus-groggy-final-closeup.jpg','GROGGY / 1 TURN LEFT'];
  if(last?.phase==='enrage'||(!resultOnly&&last?.enrageTransition))return [idle(s),'ENRAGED / LEVEL '+require('./raid-engine/enrage-stages.cjs').level(s)];
  if(last?.offerCinematic||(!resultOnly&&last?.phase==='opening'&&s.director?.phase!=='opening'))return [idle(s),'BATTLE READY'];
 }
 if(!last)return ['nameless-succubus-assets-v1/'+map.states.idle.image,'BATTLE READY / The succubus watches the challenger'];if(s.hp>0&&s.bossHP>0&&last?.offerCinematic)return ['nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedIdle':'idle'].image,'CONTRACT RESOLVED / BATTLE READY'];if(s.hp>0&&s.bossHP>0&&last?.phase==='recovery')return ['nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedIdle':'idle'].image,'RECOVERY COMPLETE / NO ATTACK LAST TURN'];if(last?.ultimate&&s.hp>0&&s.bossHP>0)return [s.config.job==='paladin'?'succubus-judgment-v2.jpg':'succubus-warrior-hit-v3.jpg',s.config.job==='paladin'?'JUDGMENT / DIRECT HIT':'RESONANT WAVE SLASH / DIRECT HIT'];if(last?.phase==='mark'&&!last.curseInterruptedNow&&s.hp>0&&s.bossHP>0)return ['nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedCurse':'curse'].image,last.emergencyEvaded?'LAST TURN / CURSE EVADED':'LAST TURN / CURSE RELEASED'];if(last?.phase==='heavy'&&s.hp>0&&s.bossHP>0)return ['nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedHeavy':'heavy'].image,'LAST TURN / HEAVY ATTACK RELEASED'];if((last?.phase==='struggle_end'||(last?.phase?.startsWith('struggle')&&last.emergencyEvaded))&&!last.shockwaveInterrupted&&(last.struggleSkills||0)<2&&s.hp>0&&s.bossHP>0)return ['nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedHeavy':'heavy'].image,'LAST TURN / CRIMSON MIRAGE RELEASED'];if(last?.phase==='enrage'&&s.hp>0&&s.bossHP>0)return [require('./raid-engine/enrage-stages.cjs').level(s)>=3?'succubus-enrage-maximum-v18.jpg':require('./raid-engine/enrage-stages.cjs').level(s)===2?'succubus-enrage-lv2-v18.jpg':'nameless-succubus-assets-v1/'+map.states.enragedIdle.image,'ENRAGED / NO BOSS ATTACK LAST TURN'];if(require('./raid-groggy-final').active(s,resultOnly))return ['succubus-groggy-final-closeup.jpg','GROGGY / 1 TURN LEFT'];if(!resultOnly&&!last?.curseInterruptedNow&&!last?.shockwaveInterrupted&&last?.phase!=='opening'&&['struggle_start','struggle_end'].includes(s.director?.phase))return [s.director.phase==='struggle_start'?'nameless-succubus-assets-v1/'+map.states[require('./raid-engine/enrage-stages.cjs').level(s)>0?'enragedSpecial':'special'].image:(require('./raid-engine/enrage-stages.cjs').level(s)>0?'succubus-enraged-special-charge-2.jpg':'succubus-special-charge-2.jpg'),'CRIMSON MIRAGE / Power gathers'];const key=stateKey(s,last?.phase,last,!resultOnly),def=map.states[key];return ['nameless-succubus-assets-v1/'+def.image,def.name||key];}
function hint(s,phase){phase=s.director?.phase||phase;return ({normal:(isWingStrike(s)?'Ruby blades gather along her wings.':s.director?.hand==='left'?'Her crimson claws draw back.':'A ruby bolt gathers in her hand.'),flurry:'Ruby blades gather around her wings.',warning:'HEAVY PREPARATION',heavy:'WARNING - HEAVY ATTACK INCOMING',mark_warning:'A crimson sigil appears. Ordinary attack skills cannot interrupt yet.',mark_prepare:'She prepares Charm. An attack skill can interrupt now.',mark:'The sigil resolves. An attack skill can interrupt now.',struggle_start:'Ruby reflections gather around her.',struggle:'Her reflections flare with crimson light.',struggle_end:'The mirage is about to shatter!',opening:'The succubus staggers!',recovery:'She steadies her breathing. No boss attack.',enrage:'Her eyes blaze as crimson fury engulfs her.',devil_offer:'She suddenly stops attacking and smiles.'})[phase]||'Choose your next action.';}
function move(s,l){return map.states[stateKey(resultState(s,l),l.phase,l)]?.name||'NAMELESS SUCCUBUS';}
function idle(s){const level=require('./raid-engine/enrage-stages.cjs').level(s);return level>=3?'succubus-enrage-maximum-v18.jpg':level===2?'succubus-enrage-lv2-v18.jpg':level===1?'succubus-enraged-idle-waist-v8.jpg':'nameless-succubus-assets-v1/'+map.states.idle.image;}
module.exports={active,art,hint,move,idle,isWingStrike};
