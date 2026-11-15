'use strict';
module.exports=source=>{
 const rep=(a,b)=>{if(!source.includes(a))throw Error('Warrior integration missing: '+a);source=source.replace(a,b);};
 source="const W=require('./warrior-rules.cjs');\n"+source;
 rep('function resourceCost(action,s){',"function resourceCost(action,s){if(W.active(s)&&action==='thrust'&&s.overheatTurns>0)return 0;if(W.active(s)&&action==='parry')return 0;if(action==='slash')return 1;");
 rep('return a.filter(action=>',"if(j==='warrior'){const gi=a.indexOf('guard');if(gi>=0)a.splice(gi,1);a.push('slash');}return a.filter(action=>");
 rep('s.energy-=energyCost;','s.energy-=energyCost;W.begin(s,action);');
 rep("job==='paladin'?9:7","job==='paladin'?9:6");
 rep("if(action==='thrust')damage=s.stats.attack*2;","if(action==='slash')damage=s.stats.attack*1.6;if(action==='thrust')damage=W.thrust(s);");
 const start=source.indexOf(" if(job==='warrior'&&s.config.warriorActiveV2&&s.parryAttackReady");
 if(start<0)throw Error('Missing legacy empowerment');const end=source.indexOf('s.parryAttackReady=false;}',start);source=source.slice(0,start)+source.slice(end+'s.parryAttackReady=false;}'.length);
 rep('const rawCrit=s.stats.crit+','const rawCrit=s.stats.crit+(W.active(s)?s.warriorEvent.thrustCrit:0)+');
 const ps=source.indexOf("if(action==='parry'&&s.config.warriorActiveV2&&hits>0)");const pe=source.indexOf('const counterTriggered=',ps);if(ps<0||pe<0)throw Error('Missing parry integration');
 // Natural evasion still qualifies an incoming attack for Blader Parry. Resolve once after all hits, preserving Evade accounting and mixed-hit RNG.
 source=source.slice(0,ps)+`if(action==='parry'&&s.config.warriorActiveV2&&(hits>0||(W.active(s)&&evades>0))){parryAttempted=true;const before=incoming;parryResult=W.parry(s,()=>random(s));incoming=Math.ceil(incoming*(100-s.warriorEvent.parryReduction*100)/100);blocked+=before-incoming;parryEnergy=parryResult==='perfect'?1:0;s.parryBlockedThisTurn=before-incoming;}
 `+source.slice(pe);
 rep("if(action==='parry'&&!parryAttempted)parryResult='no_contact';", "if(action==='parry'&&!parryAttempted)parryResult='failed';");
 rep('const counterTriggered=','const counterTriggered=false&&');
 source=source.replaceAll("['smash','thrust','arcane_strike'","['slash','smash','thrust','arcane_strike'");
 source=source.replaceAll("'attack','berserker_ultimate','thrust','smash'","'attack','berserker_ultimate','slash','thrust','smash'");
 rep('s.turn++;if(s.bossHP<=0)',"W.finish(s,action,incoming,()=>random(s));s.turn++;if(s.bossHP<=0)");
 rep('damage=Math.min(damage,s.bossHP);',"damage=Math.min(damage,s.bossHP);W.heal(s,action,damage);");
 rep('s.turn%(s.config.level>=30?2:3)===0',"s.turn%Math.max(1,(s.config.level>=30?2:3)-(W.active(s)&&s.warriorEvent?.wasHot?1:0))===0");
 return source;
};
