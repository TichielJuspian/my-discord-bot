'use strict';
function intent(s,p){
 const succ=s.config.boss==='nameless_succubus',hand=s.director?.hand||'right';
 if(succ&&require('./raid-succubus').patternUpdating(s))return {title:'NEXT ACTION / PATTERN UPDATING',lines:['The attack sequence is being updated.'],secondary:'Choose an action to refresh the pattern without spending a turn.'};
 if(succ){const next=s.director?.phase||p,normal=require('./raid-engine/enrage-stages.cjs').level(s)===0,warning=normal&&['heavy','mark'].includes(next),secondary=normal?normalHint(s,next):'';return {title:warning?'NEXT ACTION / WARNING':'NEXT ACTION',lines:[require('./raid-succubus').hint(s)],...(secondary?{secondary}:{})};}
 if(succ&&s.director?.phase)p=s.director.phase;
 const groggy=s.berserkerGroggy||1+(s.director?.queue||[]).filter(x=>x==='opening').length;
 const sweep=s.director?.rampageStrike===2;
 const col={
 idle:'It watches the challenger. No attack this turn.',
 normal:'The Colossus raises its '+hand+' arm.',
 flurry:'It draws both arms back in quick succession.',
 rampage:s.config.boss==='earth'?'Rampage preparation. No attack this turn.':'It grits its teeth and clenches both fists.',
 warning:s.config.boss==='earth'?'Heavy preparation. No attack this turn.':'It lifts both arms high overhead.',
 heavy:s.config.boss==='earth'&&s.director?.rampageStrike>0?'Rampage '+s.director.rampageStrike+'/3: '+(sweep?'a sweeping arm attack.':'both arms slam down.'):sweep?'It sweeps its massive arm across the ground.':'It slams both arms down.',
 mark_warning:'Its chest crystal gathers an ominous power.',
 mark:'Dark power spills from its chest crystal.',
 struggle_start:'It spreads its arms as the earth trembles.',
 struggle:'The ground shudders beneath its glowing fists.',
 struggle_end:'A violent tremor swells beneath your feet.',
 opening:groggy>1?'It reels, its massive arms hanging limp.':'It sways, still unable to regain its footing.',
 recovery:s.config.boss==='earth'?'It pauses. No attack; normal damage received.':'It plants its feet and steadies its body.',
 enrage:'The Colossus burns with greater fury.'
 };
 let title='NEXT ACTION';
 if(p==='idle')title='BATTLE READY / NO ATTACK';
 if(p==='heavy')title=succ?'NEXT ACTION / HEAVY ATTACK INCOMING':'WARNING - HEAVY ATTACK INCOMING';
 if(p==='mark')title='WARNING - CURSE INCOMING';
 if(succ&&p==='mark_warning')title='CURSE PREPARATION';
 if(succ&&p==='mark_prepare')title='CURSE PREPARATION / INTERRUPT NOW';
 if(succ&&p==='mark')title='CURSE RESOLUTION / INTERRUPT NOW';
 if(succ&&p==='devil_offer')title="NEXT ACTION / DEVIL'S OFFER";
 if(['struggle','struggle_end'].includes(p))title=succ?'WARNING - CRIMSON MIRAGE INCOMING':'WARNING - SHOCKWAVE INCOMING';
 if(p==='opening')title='GROGGY - '+groggy+' TURN'+(groggy===1?'':'S')+' LEFT';
 if(p==='recovery')title='RECOVERY';
 if(!succ&&s.config.boss==='earth'){
  if(p==='rampage')title='NEXT ACTION / RAMPAGE PREPARATION';
  if(p==='warning')title='NEXT ACTION / HEAVY PREPARATION';
  if(p==='heavy'&&s.director?.rampageStrike>0)title='WARNING - RAMPAGE STRIKE '+s.director.rampageStrike+'/3';
  if(p==='recovery')title='RECOVERY / NO ATTACK';
 }
 if(p==='enrage')title='ENRAGE';
 const secondary=null;
 return {title,lines:[col[p]||'Its gaze locks onto you.'],...(secondary?{secondary}:{})};
}

function normalHint(s,phase){
 if(phase==='heavy')return 'Warning / Defend to reduce damage.';
 if(phase==='mark')return s.config.job==='berserker'?'Warning / Land a charged attack to interrupt the curse.':'Warning / Land an attack skill to interrupt the curse.';
 if(!phase.startsWith('struggle'))return '';
 const count=phase==='struggle_start'?0:s.struggleSkills||0,remaining=require('./raid-engine/mechanic-rules.cjs').remaining(s),needed=Math.max(0,2-count);
 const actions=require('./raid-engine/progression-combat.cjs').actions(s),ultimate=actions.includes('resonant_wave')||actions.includes('berserker_ultimate'),evade=actions.includes('emergency_evade');
 const fallback=ultimate&&evade?'Use an ultimate or evade to avoid the blast.':ultimate?'Use an ultimate to interrupt.':evade?'Evade to avoid the blast.':'The blast cannot be interrupted now.';
 if(s.config.job==='berserker'){
  const charge=s.berserkerCharge||0;
  if(charge>=needed&&needed>0)return 'Land a charged attack to interrupt.';
  if(remaining>1&&charge===1)return 'Charge, then attack to interrupt.';
  if(remaining>1&&s.energy>=4&&actions.includes('blood_transfusion'))return 'Use Blood Draw, then attack to interrupt.';
  return fallback;
 }
 if(count>=1)return 'Land one more attack skill to interrupt.';
 return remaining>1?'Land attack skills on both turns to interrupt.':fallback;
}
module.exports={intent};
