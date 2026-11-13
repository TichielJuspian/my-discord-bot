'use strict';
// Fixed-value role redesign. Offline only: no network, Discord or database.
const { effects } = require('./cooperation');
const JOBS={
 warrior:{name:'Blader',base:{attack:10,hp:140,defense:12},growth:{attack:2,hp:6,defenseEvery:2}},
 paladin:{name:'Paladin',base:{attack:10,hp:150,defense:10},growth:{attack:2,hp:7,defenseEvery:2}},
 spellblade:{name:'Spellblade',base:{attack:10,hp:115,defense:7},growth:{attack:2,hp:5,defenseEvery:3}},
 berserker:{name:'Berserker',base:{attack:10,hp:125,defense:8},growth:{attack:2,hp:6,defenseEvery:2}},
};
const GEAR={starter:{attack:20,hp:40,defense:4,counter:0,mitigation:0,rage:0,crit:0,critFlat:0,evasion:0,healing:0},rare:{attack:90,hp:100,defense:9,counter:20,mitigation:3,rage:1,crit:3,critFlat:20,evasion:3,healing:15},epic:{attack:200,hp:180,defense:15,counter:60,mitigation:6,rage:2,crit:6,critFlat:40,evasion:6,healing:30},legendary:{attack:300,hp:280,defense:24,counter:70,mitigation:10,rage:3,crit:10,critFlat:70,evasion:10,healing:50}};
const SPELLBLADE_GEAR={epic:{attack:160,critFlat:10,evasion:6},legendary:{attack:220,critFlat:20,evasion:6}};
const BOSSES={
 earth:{name:'Earth Colossus',favored:null,patterns:['normal','warning','heavy','opening','normal','curse']},
 dark:{name:'Dark Warden',favored:'paladin',patterns:['normal','curse','normal','flurry','opening','curse']},
 arcane:{name:'Arcane Sovereign',favored:'spellblade',patterns:['flurry','warning','heavy','opening','curse','normal']},
 frost:{name:'Frost Ravager',favored:'berserker',patterns:['curse','warning','heavy','opening','normal','normal']},
};
const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
function budget(level){if(!integer(level,1,100))throw Error('Invalid level');return 3*(level-1)+2*Math.floor(level/5);}
function create(input={},seed=1){const c={level:1,job:'warrior',gear:'starter',boss:'earth',power:0,focus:0,ruin:0,elements:true,...input};const points=budget(c.level);if(!JOBS[c.job]||!GEAR[c.gear]||!BOSSES[c.boss])throw Error('Invalid setup');if(![c.power,c.focus,c.ruin].every(n=>integer(n,0,300))||c.power+c.focus+c.ruin>points)throw Error('Invalid allocation');const j=JOBS[c.job],g={...GEAR[c.gear],...(c.job==='spellblade'?SPELLBLADE_GEAR[c.gear]:{})},n=c.level-1;
 const stats={attack:j.base.attack+j.growth.attack*n+g.attack+c.power,hp:j.base.hp+j.growth.hp*n+g.hp,defense:j.base.defense+Math.floor(n/j.growth.defenseEvery)+g.defense,crit:Math.min(100,5+c.focus+(c.job==='spellblade'?g.crit+Math.floor(n/5):0)),critFlat:2*c.ruin+(c.job==='spellblade'?g.critFlat:0),evasion:c.job==='spellblade'?Math.min(85,8+Math.floor(n/5)+g.evasion):0,counter:c.job==='warrior'?20+c.level+g.counter:0,mitigation:c.job==='warrior'?g.mitigation:0,rageGain:c.job==='berserker'?12+g.rage:0,healing:c.job==='paladin'?g.healing:0};
 let rng=(seed^0x9e3779b9)>>>0;rng=Math.imul(rng^(rng>>>16),0x21f0aaad)>>>0;return {config:c,stats,hp:stats.hp,bossHP:50000,energy:c.level>=40?5:c.level>=20?4:3,maxEnergy:c.level>=40?5:c.level>=20?4:3,baseHP:stats.hp,blessingBonus:0,holyTurns:0,weaponTurns:0,weaponUsed:false,controlImmune:false,now:c.now??0,raidId:c.raidId||'local',buffs:c.buffs||[],rage:0,turn:1,dodgeCooldown:0,parryCooldown:0,cooldown:0,signatureCooldown:0,signatures:0,barrierUsed:false,lastStand:false,curse:0,status:'active',rng:rng||1,totals:{damage:0,communityDamage:0,healing:0,counters:0,evades:0,selfDamage:0,blocked:0},log:[]};}
function random(s){let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function phase(s){const p=BOSSES[s.config.boss].patterns;return p[(s.turn-1)%p.length];}
function values(s){const l=s.config.level,chargeBonus={starter:0,rare:40,epic:140,legendary:250}[s.config.gear];return {counterBonus:40+3*l,stanceBlock:50,fortressBlock:160,heal:60+2*l+s.stats.healing,procHeal:15+Math.floor(l/2)+s.stats.healing,procChance:20,bloodCost:30+Math.floor(l/8),bloodRage:25,arcaneBonus:10+2*l,burst:[0,6*l+chargeBonus,13*l+2*chargeBonus,21*l+3*chargeBonus],signature:{warrior:200+4*l,paladin:150+5*l,spellblade:200+4*l,berserker:400+10*l+2*chargeBonus}[s.config.job]+(l>=70?100:0)};}
function resourceCost(action){return ['attack','guard','parry','dodge','retreat'].includes(action)?0:action==='signature'?3:['fortress','barrier','burst2','burst3'].includes(action)?2:1;}
function actions(s){if(s.status!=='active')return [];const a=['attack','guard','retreat'],j=s.config.job,v=values(s);if(j==='spellblade'&&!s.dodgeCooldown)a.push('dodge');if(j!=='spellblade'&&!s.parryCooldown)a.push('parry');if(!s.cooldown&&s.energy>=1){if(j==='warrior')a.push('counter','fortress');if(j==='paladin'&&s.hp<s.stats.hp)a.push('heal');if(j==='spellblade')a.push('arcane_strike');}if(s.config.level>=50&&s.energy>=1&&!s.weaponUsed)a.push('enchant');if(s.config.level>=10&&s.energy>=1&&!s.cooldown&&s.hp<s.stats.hp)a.push('first_aid');if(j==='spellblade'&&!s.barrierUsed&&s.energy>=1)a.push('barrier');if(j==='berserker'){if(!s.cooldown&&s.energy>=1&&s.hp>v.bloodCost)a.push('blood');for(let k=1;k<=3;k++)if(s.rage>=k*25&&s.energy>=1)a.push('burst'+k);}if(s.energy>=1&&s.config.level>=60&&s.signatures<(s.config.level>=90?2:1)&&!s.signatureCooldown&&(j!=='berserker'||s.rage>=50))a.push('signature');return a.filter(action=>s.energy>=resourceCost(action));}
function step(original,action,expectedTurn=original.turn,now=original.now){if(expectedTurn!==original.turn||!actions(original).includes(action))throw Error('Unavailable or stale action');const s=structuredClone(original);if(!Number.isSafeInteger(now)||now<s.now)throw Error('Invalid battle clock');s.now=now;const support=effects(s.buffs,s.raidId,now);const maxHP=Math.floor(s.baseHP*(1+support.hpBonus));if(maxHP!==s.stats.hp){s.hp=Math.min(maxHP,Math.floor(s.hp*maxHP/s.stats.hp));s.stats.hp=maxHP;}s.blessingBonus=support.hpBonus;if(action==='retreat'){s.status='retreated';return s;}const {job,level}=s.config,v=values(s),p=phase(s);let damage=0,heal=0,block=action==='guard'?Math.floor(s.stats.defense*.5):0,stance=false,barrier=false,selfDamage=0,charge=0;
 s.energy-=resourceCost(action);
 if(action==='enchant'){s.weaponTurns=3;s.weaponUsed=true;}
 if(action==='first_aid')heal=35+Math.floor(level/10)*5;
 if(action==='attack')damage=s.stats.attack;
 if(action==='counter'){block=v.stanceBlock;stance=true;}
 if(action==='fortress'){block=v.fortressBlock;}
 if(action==='heal'){heal=v.heal;s.holyTurns=3;}
 if(action==='arcane_strike'){damage=s.stats.attack+v.arcaneBonus;}
 if(action==='barrier'){barrier=true;s.barrierUsed=true;damage=s.stats.attack;}
 if(action==='blood'){selfDamage=v.bloodCost;s.hp-=selfDamage;s.rage=Math.min(100,s.rage+v.bloodRage);}
 if(action.startsWith('burst')){charge=Number(action.slice(-1));s.rage-=charge*25;damage=s.stats.attack+v.burst[charge];}
 if(action==='signature'){s.signatures++;damage=s.stats.attack+v.signature;if(job==='warrior')block=80;if(job==='berserker')s.rage-=50;}
 // Fixed skill/gear values; cooperative attack bonus applies once to the attack component.
 let critical=false;if(damage>0){if(s.holyTurns>0){damage+=20+3*level;s.holyTurns--;}damage+=Math.floor((s.stats.attack+(s.weaponTurns>0?50:0))*(1+support.attackBonus))-s.stats.attack;if(s.weaponTurns>0)s.weaponTurns--;if(p==='opening')damage+=40;const critChance=Math.min(100,s.stats.crit+(action==='arcane_strike'?15:0));critical=random(s)<critChance/100;if(critical)damage=Math.floor(damage*(job==='spellblade'?1.45:1.2))+s.stats.critFlat;if(s.config.elements&&BOSSES[s.config.boss].favored===job)damage=Math.floor(damage*1.1);}
 damage=Math.min(damage,s.bossHP);s.bossHP-=damage;s.totals.damage+=damage;
 if(job==='paladin'&&damage>0&&random(s)<v.procChance/100)heal+=v.procHeal;
 const actualHeal=Math.min(s.stats.hp-s.hp,Math.max(0,heal-Math.max(0,s.turn-12)*6));s.hp+=actualHeal;s.totals.healing+=actualHeal;s.totals.selfDamage+=selfDamage;
 let statusEffect=null,communityDamage=0;const roll=random(s);if(!s.controlImmune&&roll<support.stun)statusEffect='stun';else if(!s.controlImmune&&roll<support.stun+support.blind)statusEffect='blind';else if(roll>=support.stun+support.blind&&roll<support.stun+support.blind+support.confusion)statusEffect='confusion';s.controlImmune=['stun','blind'].includes(statusEffect);
 if(statusEffect==='confusion'&&s.bossHP>0){communityDamage=Math.min(100,s.bossHP);s.bossHP-=communityDamage;s.totals.communityDamage+=communityDamage;}
 let dodgeResult=null,dodgePerfectRolled=false,dodgeResource=0;
 let parryResult=null,parryEnergy=0,parryAttempted=false;
 let incoming=0,dot=0,hits=0,evades=0,counterDamage=0,blocked=0,rageEarned=0;
 if(s.bossHP>0){
  const enraged=Math.max(0,s.turn-12),extra=enraged*10;
  const attacks=['stun','blind'].includes(statusEffect)?[]:p==='normal'?[40+extra]:p==='heavy'?[90+extra]:p==='flurry'?[22+extra,22+extra,22+extra]:[];
  for(const [hitIndex,raw] of attacks.entries()){let mitigated=Math.max(1,Math.floor(raw*(1-support.damageReduction))-s.stats.defense-s.stats.mitigation-block);if(barrier){blocked+=mitigated;continue;}if(random(s)<(action==='dodge'?Math.min(85,42+s.stats.evasion):s.stats.evasion)/100){
    evades++;
    if(action==='dodge'){
      if(!dodgePerfectRolled){dodgePerfectRolled=true;dodgeResult=random(s)<.2?'perfect':'success';if(dodgeResult==='perfect')dodgeResource=1;}
    }
    continue;
  }if(action==='parry'&&hitIndex===0){
    parryAttempted=true;
    if(random(s)<.5){
      if(random(s)<.2){parryResult='perfect';blocked+=mitigated;mitigated=0;parryEnergy=2;}
      else {parryResult='success';const remaining=Math.ceil(mitigated*.4);blocked+=mitigated-remaining;mitigated=remaining;parryEnergy=1;}
    }else parryResult='failed';
  }
  incoming+=mitigated;if(mitigated>0)hits++;}
  if(s.curse>0){dot=barrier?0:16+2*enraged;if(barrier)blocked+=16+2*enraged;s.curse--;}
  s.hp=Math.max(0,s.hp-incoming-dot);
  if(s.hp===0&&level>=100&&!s.lastStand){s.hp=1;s.lastStand=true;}
  if(s.hp>0&&job==='warrior'&&hits>0){counterDamage=s.stats.counter+(stance?v.counterBonus:0);if(s.config.elements&&BOSSES[s.config.boss].favored===job)counterDamage=Math.floor(counterDamage*1.1);counterDamage=Math.min(counterDamage,s.bossHP);s.bossHP-=counterDamage;s.totals.damage+=counterDamage;s.totals.counters++;}
  if(job==='berserker'&&s.hp>0){rageEarned=Math.min(30,hits*s.stats.rageGain);s.rage=Math.min(100,s.rage+rageEarned);}
  if(p==='curse'&&s.hp>0&&statusEffect!=='stun')s.curse=job==='paladin'?2:3;
 }
 if(action==='dodge'&&!dodgeResult)dodgeResult=hits>0?'failed':'no_contact';
 const dodgeEnergy=s.hp>0&&s.bossHP>0?Math.min(s.maxEnergy-s.energy,dodgeResource):0;
 s.energy+=dodgeEnergy;
 s.dodgeCooldown=action==='dodge'?3:Math.max(0,s.dodgeCooldown-1);
 if(action==='parry'&&!parryAttempted)parryResult='no_contact';
 if(s.hp>0&&s.bossHP>0)s.energy=Math.min(s.maxEnergy,s.energy+parryEnergy);
 s.parryCooldown=action==='parry'?3:Math.max(0,s.parryCooldown-1);
 s.totals.evades+=evades;s.totals.blocked+=blocked;
 s.log.push({dodgeResult,dodgeEnergy,parryResult,parryEnergy,statusEffect,communityDamage,support,turn:s.turn,phase:p,action,damage,counterDamage,critical,heal:actualHeal,selfDamage,incoming,dot,hits,evades,blocked,rageEarned,rage:s.rage,hp:s.hp,curse:s.curse,charge});
 s.cooldown=['counter','fortress','arcane_strike','blood'].includes(action)?3:action==='heal'?4:action==='first_aid'?2:Math.max(0,s.cooldown-1);s.signatureCooldown=action==='signature'?8:Math.max(0,s.signatureCooldown-1);if(s.turn%3===0&&s.hp>0&&s.bossHP>0)s.energy=Math.min(s.maxEnergy,s.energy+1);s.turn++;if(s.bossHP<=0)s.status='victory';else if(s.hp<=0)s.status='defeated';return s;
}
function policy(s,style='balanced'){const p=phase(s),a=actions(s),j=s.config.job,v=values(s);if(style==='attack')return 'attack';if(a.includes('enchant')&&p==='warning')return 'enchant';if(a.includes('signature')&&(p==='opening'||(j==='warrior'&&p==='heavy')))return 'signature';
 if(j==='warrior'){if(p==='heavy'&&a.includes('fortress')&&s.hp<200)return 'fortress';if(['heavy','flurry'].includes(p)&&a.includes('counter'))return 'counter';}
 if(j==='paladin'&&a.includes('heal')&&s.hp<s.stats.hp-v.heal&&p!=='heavy')return 'heal';
 if(j==='spellblade'){if(a.includes('barrier')&&((p==='heavy'&&s.hp<250)||(p==='flurry'&&s.hp<180)))return 'barrier';if(a.includes('arcane_strike')&&p!=='heavy')return 'arcane_strike';}
 if(j==='berserker'){if(p==='opening'){for(const k of [3,2,1])if(a.includes('burst'+k))return 'burst'+k;}if(s.hp<220&&a.includes('burst1')&&p!=='heavy')return 'burst1';if(p==='warning'&&s.rage<50&&s.hp>v.bloodCost+250&&a.includes('blood'))return 'blood';}
 if(p==='heavy')return j==='spellblade'&&a.includes('dodge')?'dodge':'guard';return 'attack';}
function run(c,seed=1,style='balanced'){let s=create(c,seed);while(s.status==='active'){if(s.turn>500)throw Error('Diagnostic safety fuse');s=step(s,policy(s,style));}return s;}
module.exports={resourceCost,JOBS,GEAR,SPELLBLADE_GEAR,BOSSES,budget,create,values,phase,actions,step,policy,run};
