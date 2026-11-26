'use strict';
// Labels consume authoritative receipts. Damage, RNG and skills remain engine-owned.
function from(frame,model){
 const e=frame.lastTurn,l=e?.log||frame.log||{},attack=l.attackLog||l,def=l.defenseLog||l,p=model.actors.player,b=model.actors.boss;
 const result={player:{},boss:{},turn:frame.state.turn,enrage:frame.state.director?.enrageLevel||0};
 if(frame.kind==='contract')return {...result,player:{text:p.action.label},boss:{text:b.action.label}};
 if(!e)return result;
 const ultimateImpact=frame.kind==='gimmick_release'||e.event==='gimmick_release';
 const received=(actor,target)=>({stamp:target==='player'&&def.parryResult==='failed'?(actor.receipt?.amount>0?'hit':/Evad|Miss/i.test(actor.action.label)?'miss':'hit'):/Failed/i.test(actor.action.label)?'hit':actor.action.label.includes('Perfect')?'perfect_parry':/Parry/.test(actor.action.label)?'parry':/Block/i.test(actor.action.label)?'block':/Evad|Miss/i.test(actor.action.label)?'miss':'hit',receipt:actor.receipt||actor.extra?.receipt});
 if(p.receipt){result.player=received(p,'player');result.boss={stamp:e.event==='gimmick_release'?'ultimate':'attack',damage:p.receipt.amount};}
 else if(b.receipt||b.extra?.receipt){result.boss=received(b,'boss');result.player={stamp:attack.ultimate?'ultimate':attack.critical?'critical':'attack',damage:result.boss.receipt.amount,...(Number(attack.berserker?.released)===3?{emphasis:true}:{})};}
 const currentHit=e.hits?.[(frame.hitIndex||1)-1];
 if(frame.kind==='boss_attack'&&currentHit&&p.receipt){
  if(currentHit.evaded)result.player={stamp:'miss',receipt:p.receipt};
  else if(def.tackle)result.player={text:'Tackle!',receipt:p.receipt};
 }
 if(attack.charmBlocked&&!p.receipt)result.player={text:'Charmed'};
 if(!ultimateImpact&&e.event==='curse_release'){result.player={stamp:e.curseLanded?'cursed':'miss'};result.boss={text:'Curse!'};}
 if(!ultimateImpact&&['curse_interrupted','gimmick_success'].includes(e.event))result.boss={text:'Interrupted!',receipt:b.receipt||b.extra?.receipt};
 if(e.event==='cancelled'){result.player={stamp:'ultimate',damage:Math.max(0,attack.damage||0)};if(!result.boss.receipt)result.boss={text:'Cancelled'};}
 if(e.event==='contract'){result.player={stamp:'debuffed'};result.boss={text:(e.contract||frame.state.offer)?.choice==='yes'?'Accepted':'Refused'};}
 const supportOnly=['charge','blood_transfusion','bloodletting','blessing','prayer','heal','purification'].includes(attack.requestedAction||attack.action)&&!(attack.damage>0);
 if(e.event==='support'||supportOnly&&['reaction','gimmick_prepare'].includes(e.event)){
  // Support casts have no outgoing hit receipt. Real incoming boss attacks are
  // handled by their own attack/release events and remain visible.
  result.player={};result.boss={};
 }
 if(e.event==='evaded'&&e.pattern?.kind==='C'){result.player={stamp:'miss'};result.boss={text:'Curse evaded'};}
 // Guard failures still receive their true hit; the existing detail line keeps
 // the type mismatch explanation, instead of showing a successful Block stamp.
 if(def.matched===false&&p.receipt&&result.player.stamp!=='miss'&&!/Evad|Miss/i.test(p.action.label))result.player.stamp='hit';
 if(ultimateImpact){result.player=p.receipt?received(p,'player'):{};result.boss={stamp:'ultimate',damage:p.receipt?.amount??0};}
 return result;
}
module.exports={from};
