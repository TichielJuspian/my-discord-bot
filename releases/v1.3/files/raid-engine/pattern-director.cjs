'use strict';
const stages=require('./enrage-stages.cjs');
// The next action is committed once, before its telegraph is displayed.
// Independent seeded RNG: reading a panel or rolling a critical cannot reroll it.
function roll(d){let x=d.rng;x^=x<<13;x^=x>>>17;x^=x<<5;d.rng=x>>>0;return d.rng/4294967296;}
function init(s){s.director={rng:(s.rng^0x73a9b217)>>>0||1,phase:'normal',hand:'right',lastHand:'left',queue:[],normalRun:0,curseUntil:0,waveUntil:0,enrageLevel:0,stageStart:1,stageDamage:0};s.director.hand=roll(s.director)<.5?'left':'right';if(require('./pattern-profiles.cjs').active(s)){require('./pattern-profiles.cjs').init(s);require(s.config.boss==='earth'?'./colossus-pattern-director.cjs':'./common-pattern-director.cjs').select(s);}return s;}
function chooseNext(s,last){const d=s.director;
 if(last.phase==='heavy')d.heavyUntil=s.turn+4;
 if(last.ultimate){
  d.rampageStrike=0;
  if(last.phase.startsWith('struggle'))d.waveUntil=s.turn+6;
  if(['mark_warning','mark_prepare','mark'].includes(last.phase))d.curseUntil=s.turn+4;
  d.queue=[];d.phase='normal';d.normalRun=0;d.hand=d.lastHand==='right'?'left':'right';return;
 }
 if(last.phase==='normal'){d.normalRun++;d.lastHand=last.hand;}else d.normalRun=0;
 if(last.phase==='mark'||last.curseInterruptedNow)d.curseUntil=s.turn+4;
 if(last.phase.startsWith('struggle')&&last.struggleSkills>=2){last.shockwaveInterrupted=true;d.waveUntil=s.turn+6;d.queue=s.config.boss==='earth'?[]:['opening'];d.phase='opening';d.hand=null;return;}
 if(last.phase==='struggle_end')d.waveUntil=s.turn+6;
 if(last.curseInterruptedNow||last.phase==='mark'||last.phase==='struggle_end'){d.queue=[];d.phase=s.config.boss==='earth'?'recovery':'normal';d.normalRun=0;d.hand=null;return;}
 if(d.queue.length){d.phase=d.queue.shift();d.rampageStrike=s.config.boss==='earth'&&d.phase==='heavy'?Math.min(3,(d.rampageStrike||0)+1):0;d.hand=d.phase==='normal'?(d.lastHand==='right'?'left':'right'):null;return;}
 if(last.phase==='heavy'&&s.config.boss!=='nameless_succubus'){const fullCombo=s.config.boss==='earth'&&d.rampageStrike===3;d.rampageStrike=0;d.phase='recovery';d.queue=[];d.hand=null;return;}
 if(last.phase==='opening'){d.phase=s.config.boss==='earth'?'recovery':'normal';d.hand=null;return;}
 if(last.phase==='recovery'){if(d.rampageActive){d.rampageActive=false;d.rampageFinished=true;}d.phase='normal';d.hand=d.lastHand==='right'?'left':'right';return;}
 const pool=[];
 if(d.normalRun<2)pool.push('normal','normal','normal','normal');
 const earth=s.config.boss==='earth',stage=stages.level(s);
 const canRampage=earth&&stage===1&&!d.rampages&&s.turn>=13&&s.turn<=22;
 if(s.turn>=(d.heavyUntil||0)&&(!earth||stage!==1||canRampage))pool.push('heavy','heavy');
 if(s.turn>=d.curseUntil&&s.energy>=1)pool.push('mark');
 // Two response actions; resources must be saved before the telegraph.
 if(s.turn>=d.waveUntil&&s.energy>=3)pool.push('struggle_start');
 if(!pool.length)pool.push('normal');
 d.phase=canRampage&&s.turn===22?'heavy':pool[Math.floor(roll(d)*pool.length)];
 if(s.config.boss==='earth'&&d.phase==='heavy')d.phase=stage===1?'rampage':'warning';
 if(earth&&d.phase==='rampage'){d.rampages=(d.rampages||0)+1;d.rampageActive=true;}
 if(['earth','nameless_succubus'].includes(s.config.boss)&&d.phase==='mark')d.phase='mark_warning';
 if(d.phase==='struggle_start')d.specialFailureDamage=['earth','nameless_succubus'].includes(s.config.boss)?require('./mechanic-rules.cjs').failureDamage(s):80+Math.max(0,s.turn+1-12)*10;
 d.hand=d.phase==='normal'?(d.lastHand==='right'?'left':'right'):null;
 d.rampageStrike=0;
 d.queue=d.phase==='rampage'?['warning','heavy','heavy','heavy']:d.phase==='warning'?['heavy']:d.phase==='mark_warning'?(s.config.boss==='nameless_succubus'?['mark_prepare','mark']:['mark']):d.phase==='struggle_start'?(earth?['struggle','struggle_end']:['struggle_end']):[];
}
function advance(s,last){
 if(require('./pattern-profiles.cjs').active(s))return require(s.config.boss==='earth'?'./colossus-pattern-director.cjs':'./common-pattern-director.cjs').advance(s,last);
 if(s.config.boss==='earth'&&stages.due(s)){s.director.pendingEnrageLevel=stages.level(s)+1;s.director.phase='enrage';s.director.queue=['normal'];s.director.hand=null;s.director.rampageActive=false;s.berserkerGroggy=0;return;}
 const d=s.director,earth=s.config.boss==='earth';
 if(earth&&last.phase==='heavy')last.rampageStrike=d.rampageStrike||0;
 // Commit the next transformation now; apply its level only when that turn resolves.
 if(earth&&last.phase==='recovery'&&d.rampageActive){d.rampageActive=false;d.rampageFinished=true;}
 const protectedSequence=earth&&(last.shockwaveInterrupted||last.curseInterruptedNow||d.rampageActive||d.queue.length||['opening','struggle_start','struggle','mark_warning'].includes(last.phase)||last.ultimate);
 if(earth&&last.phase!=='enrage'&&!protectedSequence&&stages.due(s)){
  d.pendingEnrageLevel=stages.level(s)+1;d.phase='enrage';d.hand=null;
  d.queue=['normal'];d.rampageStrike=0;
  s.berserkerGroggy=0;return;
 }
 if(last.phase==='enrage')d.enrageSeen=true;
 if(earth&&last.ultimate){
  d.rampageStrike=0;d.hand=null;d.normalRun=0;
  d.phase=s.berserkerGroggy>0?'opening':'recovery';
  d.queue=s.berserkerGroggy>1?Array(s.berserkerGroggy-1).fill('opening'):[];return;
 }
 if(last.ultimate){chooseNext(s,last);return;}
 const protectedContinuation=d.queue.length>0;
 chooseNext(s,last);
 if(require('./devil-offer.cjs').schedule(s,last,{protectedContinuation}))return;
 if(!['earth','nameless_succubus'].includes(s.config.boss)&&s.turn>=12&&!d.enrageSeen){d.enrageSeen=true;d.queue=['warning','heavy'];d.phase='enrage';d.hand=null;}
}
module.exports={init,advance};

