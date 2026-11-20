'use strict';
// Presentation only: use resolved hit records; never roll or advance combat.
function thrustPose(s){let count=0;for(const l of [...s.log].reverse()){if(l.displayOnly)continue;if(l.action==='thrust'&&!l.reaction&&['defense','result','gimmick_a','gimmick_b'].includes(l.phase))continue;if(l.action!=='thrust')break;count++;}return count%2===0&&count>0?'deep_thrust':'thrust';}
function select(a){
 const s=a.state,frame=a.cardFrame,l=frame?.lastTurn?.log||frame?.log||s.log.at(-1)||{},d=l.defenseLog||l;
 if(s.hp<=0&&!frame?.aborted)return 'defeat';
 if(frame?.aborted)return 'idle';
 if(frame?.kind==='curse_interrupted'&&s.config.job==='warrior'&&l.action==='thrust')return 'idle';
 if(frame?.interactive&&s.lastStand&&s.hp===1)return 'last_stand';
 if(frame?.interactive)return s.config.job==='warrior'&&s.overheatTurns>0?'trance':'idle';
 if(frame?.kind==='evaded'||l.emergencyEvaded||l.action==='emergency_evade')return 'evade';
 if(frame?.kind==='curse_release'&&frame.lastTurn?.curseLanded)return 'heavy_hit';
 const receiving=frame?['boss_attack','gimmick_release'].includes(frame.kind):(d.incoming>0||d.mechanicDamage>0||d.evades>0);
 if(receiving){
  const hit=frame?.lastTurn?.hits?.[(frame.hitIndex||1)-1],incoming=hit?hit.incoming:d.incoming||d.mechanicDamage||0;
  if(hit?hit.evaded:(!incoming&&d.evades>0&&!d.blocked))return 'evade';
  if((d.lastStandTriggered||l.lastStandTriggered)&&s.hp===1)return 'last_stand';
  const parry=hit?.parryResult??d.parryResult;
  if(parry==='perfect')return 'perfect_parry';
  if(parry==='success')return 'parry';
  if(d.matched===true&&d.blocked>0&&['guard','magic_guard'].includes(d.action))return 'guard';
  if(incoming>0){const kind=frame?.pattern?.kind||frame?.lastTurn?.pattern?.kind||s.pattern?.kind;return ['H','G'].includes(kind)||frame?.kind==='gimmick_release'||d.mechanicDamage>0||['heavy','special','gimmick'].includes(d.phase)?'heavy_hit':'hit';}
  if(d.parryResult==='success')return 'parry';
  if(['guard','magic_guard'].includes(d.action))return 'guard';
 }
 if(l.lastStandTriggered&&s.hp===1)return 'last_stand';
 if(frame?.characterPose==='hit'||frame?.characterPose==='enrage-hit')return 'hit';
 if(l.ultimate||['ultimate','resonant_wave','berserker_ultimate'].includes(l.action))return 'ultimate';
 if(l.graceProc||l.paladin?.divineGrace)return 'divine';
 if(l.charmBlocked)return 'idle';
 return ({charge:'charge',blood_transfusion:'blood_draw',bloodletting:'blood_draw',shoulder_tackle:'tackle',attack:'attack',slash:'slash',thrust:thrustPose(s),parry:l.parryResult==='perfect'?'perfect_parry':'parry',magic_parry:l.parryResult==='perfect'?'perfect_parry':'parry',guard:'guard',magic_guard:'guard',prayer:'blessing',blessing:'blessing',smash:'smash',heal:'heal'})[l.action]||(s.config.job==='warrior'&&s.overheatTurns>0?'trance':'idle');
}
module.exports={select};
