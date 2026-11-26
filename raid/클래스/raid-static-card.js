const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const {inflateSync}=require('node:zlib');
const {effect}=require('../보스/전투/raid-action-effects.js');
const art=require('../보스/전투/raid-ui-art.js');

function select(s){if(s.hp>0&&s.log.at(-1)?.lastStandTriggered)return {lastStand:true};if(s.config.job==='berserker')return {berserkerPose:require('./광전사/berserker-rules.cjs').pose(s)};
 const l=s.log.at(-1)||{};
 if(s.hp<=0)return {pose:'exhausted'};
 if(l.lastStandTriggered&&['warrior','paladin'].includes(s.config.job))return {lastStand:true};
 // Unblockable mechanic damage takes priority over the chosen Guard,
 // passive proc, attack or counter pose. Do not show a successful block.
 if((l.mechanicDamage||0)>0&&!l.emergencyEvaded)return s.config.job==='paladin'?{paladinPose:'hit',fx:'hit'}:{pose:'hit',fx:'hit'};
 if(s.config.job==='paladin'){
  if(l.ultimate)return {paladinPose:'judgment'};
  if(l.emergencyEvaded)return {paladinPose:'evade'};
  if(l.action==='prayer')return {paladinPose:'protection'};
  if(l.action==='smash')return {paladinPose:(l.paladin?.divineSmite||require('./성기사/paladin-rules.cjs').evolved(s))?'divine_smite':'holy_smash'};
  if(l.graceProc)return {paladinPose:'divine_grace'};
  if(l.action==='guard')return {paladinPose:l.incoming>0||l.blocked>0?'guard_block':'guard_hold'};
  if(l.incoming>0)return {paladinPose:'hit',fx:'hit'};
  if(l.action==='attack')return {paladinPose:'attack',fx:'slash'};
  return {paladinPose:'idle'};
 }
 if(l.ultimate)return {ultimate:true};
 if(l.emergencyEvaded||l.action==='emergency_evade')return {emergency:true};
 if(l.action==='parry'){
  if(l.parryResult==='perfect')return {pose:'parry_perfect',fx:'perfect'};
  if(l.parryResult==='success')return {pose:'parry_success',fx:'parry'};
  return {pose:'parry_failed',label:'PARRY FAILED'};
 }
 if(l.counterDamage>0)return {pose:'counter',fx:'counter'};
 if(l.action==='guard')return {pose:['normal','flurry','heavy'].includes(l.phase)?'guard_block':'guard_hold',fx:['normal','flurry','heavy'].includes(l.phase)?'guard':null};
 if(l.action==='slash')return {pose:'slash'};
 if(l.action==='thrust')return {pose:l.warrior?.deep?'deep_thrust':'thrust_hit',fx:'thrust'};
 if(l.incoming>0)return {pose:'hit',fx:'hit'};
 if(l.action==='attack')return {attack:true,fx:'slash'};
 return {};
}
const { encodeRgba: png } = require('../png-codec.cjs');
function asset(a){
 const s=a.state,l=s.log.at(-1),key=JSON.stringify([s.turn,s.totals?.damage,s.hp,s.energy,s.maxEnergy,s.stats,s.config.job,s.config.level,s.config.ruin,s.config.ruinPercentPerPoint,a.playerName,l,s.attackEnchant||0,s.sharedBuffEffects,a.booster,s.boosterCount,s.config.boss==='nameless_succubus'?[s.offer,require('../보스/전투/엔진/devil-offer.cjs').effects(s)]:s.offer,s.parryAttackReady,s.marks,s.charmTurns,s.workshop?.equipped]);
 if(a.staticCardCache?.key===key)return a.staticCardCache.asset;
 if(s.config.job==='berserker'&&select(s).berserkerPose==='enrage-charged-attack-1'){
  const current=require('./card-v23/renderer.cjs').frenzyReleasedStageOneAsset(a);
  if(current){a.staticCardCache={key,asset:current};return current;}
 }
 try{const large=require('./raid-battle-illustration.js').asset(a);if(large){a.staticCardCache={key,asset:large};return large;}}catch(error){console.warn('[RAID ILLUSTRATION FALLBACK]',error.code||error.name);}
 const chosen=require('./검사/raid-warrior-art.js').forState(s,select(s)),frames=require('../보스/전투/데이터/raid-action-frames.json');
 if(chosen.lastStand){const result={name:'challenger-current.png',attachment:require('./raid-last-stand.js').card(a),description:'LAST STAND / '+s.config.job+' refuses to fall / HP '+s.hp+' / '+s.stats.hp};a.staticCardCache={key,asset:result};return result;}

 
 const improvedPose=chosen.berserkerPose||chosen.paladinPose||chosen.pose||(chosen.emergency?'evade':chosen.ultimate?'ultimate':chosen.attack?'attack':'idle');
 const legendary=require('./raid-legendary-motion.js').frame(s.config.job,improvedPose,s.workshop?.equipped,s.config.job==='berserker'&&require('./광전사/berserker-rules.cjs').enraged(s));
 const improved=legendary||require('./raid-portrait-quality.js').frame(s.config.job,improvedPose);const pf=improved?null:s.config.job==='berserker'?require('./광전사/이미지/berserker-live-frames.json'):s.config.job==='paladin'?require('./성기사/이미지/paladin-live-frames.json'):null;
 const cardFrame=improved||(pf?(pf[chosen.berserkerPose||chosen.paladinPose||chosen.pose||'idle']||pf.idle):null);
 const encoded=cardFrame?.cardRgba|| (pf?(pf[chosen.berserkerPose||chosen.paladinPose||chosen.pose||'idle']?.rgba||pf.idle.rgba):chosen.emergency?require('../보스/전투/데이터/raid-emergency-frame.json').rgba:chosen.ultimate?require('../보스/전투/데이터/raid-ultimate-frame.json').rgba:chosen.attack?require('../보스/전투/데이터/raid-motion-frames.json')[5].rgba:frames[chosen.pose]?.rgba);
 // A supplied motion portrait replaces every pixel of the default portrait.
 // Render only the underlying card instead of decoding artwork that is discarded.
 const cardSvg=encoded?require('../보스/전투/raid-profile-card.js')(a,''):null;
 const base=encoded?new (require('@resvg/resvg-js').Resvg)(cardSvg,require('../보스/전투/raid-name-fonts.js').options(cardSvg)).render().pixels:Buffer.from(art.profile(a,true));
 if(encoded){
  const sourceSize=cardFrame?.cardSize||80;
  const p=cardFrame?.cardPixels||inflateSync(Buffer.from(encoded,'base64')),fx=chosen.fx&&!legendary&&!(improved&&s.config.job==='warrior')?effect(chosen.fx,2):null;
  const box=require('../보스/전투/raid-metal-ui.js').CARD.portrait;
  for(let y=0;y<box.height;y++)for(let x=0;x<box.width;x++){const sourceX=Math.min(sourceSize-1,Math.max(0,Math.floor(((cardFrame?.cardView?.x||0)+(x/box.width)*(cardFrame?.cardView?.size||512))*sourceSize/512))),sourceY=Math.min(sourceSize-1,Math.max(0,Math.floor(((cardFrame?.cardView?.y||0)+(y/box.height)*(cardFrame?.cardView?.size||512))*sourceSize/512))),i=(sourceY*sourceSize+sourceX)*4,j=((y+box.y)*640+x+box.x)*4,alpha=p[i+3]/255;
   for(let k=0;k<3;k++){base[j+k]=Math.round(p[i+k]*alpha+[16,25,47][k]*(1-alpha));if(fx){const fi=(Math.floor(y*80/box.height)*80+Math.floor(x*80/box.width))*4,f=fx[fi+3]/255;base[j+k]=Math.round(fx[fi+k]*f+base[j+k]*(1-f));}}base[j+3]=255;
  }
 }
 const result={name:'challenger-current.png',attachment:png(base,640,base.length/(640*4))};
 a.staticCardCache={key,asset:result};return result;
}
module.exports={asset,select};


