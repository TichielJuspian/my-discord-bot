const runtimePaths = require("../../../runtime-paths.cjs");
'use strict';
// Pure, versioned in-memory boundary. No profile lookup, storage, client or reward access.
const {isDeepStrictEqual}=require('node:util');
const PHASES=new Set(['new','idle','defense','gimmick_a','gimmick_b','ultimate_bonus','stagger_a','stagger_b','ragnarok_b','ragnarok_a','ragnarok_defense_a','contract','contract_result','ended']);
function clone(value){
 const visiting=new Set();
 function check(v){if(v===undefined||v===null||['string','boolean'].includes(typeof v))return;if(typeof v==='number'){if(!Number.isFinite(v))throw TypeError('Non-finite runtime number');return;}if(typeof v!=='object'||visiting.has(v))throw TypeError('Runtime must be acyclic JSON data');const p=Object.getPrototypeOf(v);if(!Array.isArray(v)&&p!==null&&!(p?.constructor?.name==='Object'&&Object.getPrototypeOf(p)===null))throw TypeError('Runtime must contain plain objects');visiting.add(v);for(const x of Object.values(v))check(x);visiting.delete(v);}
 check(value);return JSON.parse(JSON.stringify(value));
}
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function validateState(s){
 if(!s||!s.config||!['warrior','paladin','berserker'].includes(s.config.job)||s.config.boss!=='nameless_succubus'||!integer(s.config.level,1,100))throw TypeError('Supported Succubus combat state required');
 if(!s.stats||!Number.isFinite(s.stats.hp)||s.stats.hp<=0||!Number.isFinite(s.hp)||s.hp<0||s.hp>s.stats.hp||!integer(s.bossHP)||!integer(s.bossMaxHP,1)||s.bossHP>s.bossMaxHP)throw TypeError('Invalid combat health');
 if(!integer(s.energy)||!integer(s.maxEnergy,1)||s.energy>s.maxEnergy||!integer(s.turn)||!integer(s.rng,0,0xffffffff))throw TypeError('Invalid combat resource or RNG state');
 if(!s.director||!integer(s.director.enrageLevel,0,3)||!s.totals||!integer(s.totals.damage)||!Array.isArray(s.log)||!['active','victory','defeated','ended','retreated'].includes(s.status))throw TypeError('Invalid combat state');
 return s;
}
function admitted(s){if(typeof s.entryRaidId!=='string'||!s.entryRaidId||typeof s.entryAttemptId!=='string'||!s.entryAttemptId||!integer(s.entryBossHP,1))throw TypeError('Existing admitted raid identity required');}
function prepare(initial){
 const s=validateState(clone(initial));admitted(s);
 if(s.combatVersion!==undefined||s.status!=='active'||s.hp<=0||s.bossHP<=0||s.turn>1||s.log.length||s.totals.damage||s.director.combatActions)throw TypeError('Only a fresh admitted attempt can enter v2 flow');
 if(!integer(s.maxEnergy,3,5))throw TypeError('Verified legacy Energy capacity required');
 s.combatVersion='2.0';s.maxEnergy+=2;s.energy=s.maxEnergy;s.energyRecoveryInterval=2;
 s.turn=0;s.phase='new';s.director.phase='idle';s.director.queue=[];s.director.combatActions=0;s.director.patternReadyAt={};
 if(s.config.job==='berserker'){s.berserkerCharge??=0;s.berserkerBloodEnergy??=0;s.berserkerGroggy=0;s.unguardedNormalHits??=0;s.tackleRound=null;s.tackleActive=false;s.berserkerGroggyPolicy='engine_openings';}
 return s;
}
function validateRuntime(state,value){
 const r=clone(value),s=validateState(state);
 if(r?.schema!=='gosu-succubus-flow'||r.version!==1||!['live','isolated'].includes(r.mode)||r.job!==s.config.job||typeof r.started!=='boolean'||!integer(r.completed)||typeof r.guarantee!=='boolean'||!integer(r.gimmickSkills,0,2)||!r.readyAt||!Array.isArray(r.frames)||r.frames.length>20)throw TypeError('Invalid v2 runtime envelope');
 if(!PHASES.has(s.phase)||![1,2].includes(s.energyRecoveryInterval))throw TypeError('Invalid v2 phase or recovery interval');
 if(r.mode==='live'){admitted(s);if(s.combatVersion!=='2.0')throw TypeError('Live v2 state marker required');}
 else if(s.combatVersion!==undefined||s.raidId!=='raid15-isolated')throw TypeError('Isolated runtime cannot contain live state');
 if((s.phase==='ended')!==(s.status!=='active'))throw TypeError('Runtime terminal status mismatch');
 if(r.started===(s.phase==='new'))throw TypeError('Runtime start state mismatch');
 for(const [key,value]of Object.entries(r.readyAt))if(!['N','H','C','G','S'].includes(key)||!integer(value))throw TypeError('Invalid cooldown runtime');
 if(r.completed!==s.director.combatActions)throw TypeError('Completed round count mismatch');
 if(r.pattern!==null){
  const p=r.pattern;if(!p||!['N','H','C','G','S'].includes(p.kind)||!isDeepStrictEqual(p,s.pattern))throw TypeError('Pattern snapshot mismatch');
  if(p.type!==({N:'physical',H:'magic',C:'status',G:'magic',S:'special'})[p.kind]||!integer(p.stage,0,3)||p.stage!==s.director.enrageLevel)throw TypeError('Invalid saved pattern type or stage');
  if(p.kind==='N'&&!integer(p.hits,1,p.stage===0?2:3))throw TypeError('Invalid saved combo count');
  if(p.kind==='G'&&p.required!==2)throw TypeError('Unsupported gimmick requirement');
 }
 if(s.phase==='ragnarok_defense_a'&&s.config.job!=='berserker')throw TypeError('Ragnarok defense opening requires Berserker');
 const phaseKinds={defense:['N','H','C'],ragnarok_defense_a:['N','H','C','G'],gimmick_a:['G'],gimmick_b:['G'],stagger_a:['G'],stagger_b:['G'],contract:['S'],contract_result:['S']};
 if(phaseKinds[s.phase]&&!phaseKinds[s.phase].includes(r.pattern?.kind))throw TypeError('Pending phase and pattern mismatch');
 if(['new','idle','ultimate_bonus','ragnarok_b','ragnarok_a'].includes(s.phase)&&r.pattern!==null)throw TypeError('Attack phase cannot retain a queued pattern');
 if(r.pattern?.kind!=='G'&&r.gimmickSkills!==0)throw TypeError('Unexpected gimmick progress');
 if(s.phase.startsWith('gimmick')&&(r.pattern.kind!=='G'||(s.gimmickHits||0)!==r.gimmickSkills))throw TypeError('Gimmick progress mismatch');
 for(const frame of r.frames)if(typeof frame?.kind!=='string'||typeof frame.interactive!=='boolean'||frame.state?.config?.job!==s.config.job||frame.state.turn>s.turn)throw TypeError('Invalid presentation snapshot');
 if(r.dealtTurn!==undefined&&(!integer(r.dealtTurn,-1,s.turn)||!Array.isArray(r.dealtHits)||r.dealtHits.length>32||r.dealtHits.some(h=>!integer(h.damage)||typeof h.critical!=='boolean')))throw TypeError('Invalid outgoing presentation ledger');
 const p=r.contractPolicy;if(p!==null&&(!p||!['battle','turns'].includes(p.duration)||!['multiply','replace'].includes(p.interaction)||(p.duration==='turns'&&!integer(p.turns,1))))throw TypeError('Invalid saved contract policy');
 return r;
}
const EXTERNAL=new Set(['stats','hp','baseHP','sharedBaseline','sharedBuffEffects','boosterBaseAttack','boosterCount','boosterAttackPercent','worldBossHP','personalBestDamage','bestImprovement','bossHP']);
const EXTERNAL_STATS=new Set(['hp','attack','crit','critDamagePercent']);
function replaceExternal(current,incoming){
 current=clone(current);const next=validateState(clone(incoming));
 for(const key of new Set([...Object.keys(current),...Object.keys(next)])){
  if(key==='stats'){for(const stat of new Set([...Object.keys(current.stats),...Object.keys(next.stats)])){if(!EXTERNAL_STATS.has(stat)&&!isDeepStrictEqual(current.stats[stat],next.stats[stat]))throw TypeError('Protected combat stat changed: '+stat);}}
  else if(!EXTERNAL.has(key)&&!isDeepStrictEqual(current[key],next[key]))throw TypeError('Protected combat state changed: '+key);
 }
 for(const key of ['worldBossHP','personalBestDamage','bestImprovement','boosterCount','boosterAttackPercent'])if(next[key]!==undefined&&!integer(next[key]))throw TypeError('Invalid external metadata: '+key);
 for(const key of ['hp','attack','crit','critDamagePercent'])if(!Number.isFinite(next.stats[key])||next.stats[key]<0)throw TypeError('Invalid external stat: '+key);
 if(!Number.isFinite(next.baseHP)||next.baseHP<=0)throw TypeError('Invalid external base HP');
 return next;
}
module.exports={clone,validateState,prepare,validateRuntime,replaceExternal};
