'use strict';
function intent(s,p){
 const succ=s.config.boss==='nameless_succubus',hand=s.director?.hand||'right';
 if(succ&&s.director?.phase)p=s.director.phase;
 const groggy=s.berserkerGroggy||1+(s.director?.queue||[]).filter(x=>x==='opening').length;
 const sweep=s.director?.rampageStrike===2;
 const col={
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
 const demon={
 normal:succ&&require('./raid-succubus').isWingStrike(s)?'Ruby blades gather along her wings.':hand==='left'?'She draws her crimson claws back to strike.':'A ruby spark gathers at her raised fingertip.',
 flurry:'Ruby blades gather around her wings.',
 warning:'She raises her hands, gathering crimson light.',
 heavy:'The crimson sphere above her swells violently.',
 mark_warning:'Curse preparation: a crimson sigil appears.',
 mark_prepare:'Curse preparation: Charm is charging.',
 mark:'Curse resolution: the sigil begins to flare.',
 struggle_start:'Ruby reflections gather around her wings.',
 struggle:'Her reflections shimmer with rising power.',
 struggle_end:'Her blazing reflections close in around you.',
 opening:groggy>1?'She sways, her wings hanging loosely.':'Her wings tremble as she struggles to rise.',
 recovery:'She lowers her arms and steadies her breathing.',
 enrage:'Her eyes blaze as crimson fury engulfs her.',
 devil_offer:'She suddenly stops attacking and smiles.'
 };
 let title='NEXT ACTION';
 if(p==='heavy')title='WARNING - HEAVY ATTACK INCOMING';
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
 const secondary=succ?({mark_warning:'Ordinary attack skills cannot interrupt yet.',mark_prepare:'An attack skill can interrupt now.',mark:'An attack skill can interrupt now.'})[p]:null;
 return {title,lines:[(succ?demon:col)[p]||'Its gaze locks onto you.'],...(secondary?{secondary}:{})};
}
module.exports={intent};
