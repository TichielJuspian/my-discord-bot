const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Compatibility adapter for the frozen Succubus event vocabulary. New bosses
// supply stable IDs directly; they do not add branches to the shared renderer.
const fs=require('node:fs'),path=require('node:path');
const EFFECTS=Object.freeze({
  'Focus':{effectId:'warrior.focus',shape:'eye',stack:'bladerFocus'},
  'Sharp Eye':{effectId:'warrior.sharp_eye',shape:'sword',file:'sharp-eye.png',stack:'sharpEye'},
  'Hone':{effectId:'warrior.hone',shape:'star',file:'hone.png',stack:'hone'},
  'Sixth Sense':{effectId:'warrior.sixth_sense',shape:'eye',file:'sixth-sense.png'},
  'Thrust Defense':{effectId:'warrior.thrust_defense',name:'Defense Up',shape:'shield',file:'defense-up.png'},
  'Defense Up':{effectId:'warrior.thrust_defense',shape:'shield',file:'defense-up.png'},
  'BLADE TRANCE':{effectId:'warrior.blade_trance',shape:'bolt',file:'blade-trance.png'},
  'Blessing':{effectId:'paladin.blessing',shape:'shield',file:'paladin-blessing.png'},
  'Divine Punishment':{effectId:'paladin.divine_punishment',shape:'star',file:'paladin-divine-punishment.png'},
  'Divine Grace':{effectId:'paladin.divine_grace',shape:'star',file:'paladin-divine-grace.png'},
  'Charge':{effectId:'berserker.charge',shape:'sword'},
  'Blood Draw':{effectId:'berserker.blood_draw',shape:'bolt',file:'berserker-blood-draw.png'},
  'Enrage':{effectId:'berserker.enrage',shape:'bolt'},
  'Tackle Defense':{effectId:'berserker.tackle_defense',shape:'shield'},
});
const BY_ID=new Map(Object.values(EFFECTS).map(e=>[e.effectId,e]));
function gainedEffect(name,state) {
  const definition=EFFECTS[name];
  if (!definition) throw new TypeError('Unregistered Succubus effect: '+name);
  const stacks=state.config?.job==='warrior' && definition.stack && Number.isInteger(state[definition.stack]) && state[definition.stack]>0 ? state[definition.stack] : null;
  return {effectId:definition.effectId,iconKey:definition.effectId,name:state.config?.job==='warrior'?definition.name||name:name,
    source:'player',target:'player',kind:'buff',change:'gained',shape:definition.shape,stacks,turns:null};
}
function readEffectIcon(iconKey) {
  if(iconKey==='succubus.charm'){
    const location=runtimePaths.join(runtimePaths.directory("raid15"),'..','succubus-art-20261113','Status-Curse Icon Charm.png');
    return fs.existsSync(location)?fs.readFileSync(location):null;
  }
  const file=BY_ID.get(iconKey)?.file;
  if (!file) return null;
  const location=runtimePaths.join(runtimePaths.directory("raid15"),'assets',file);
  return fs.existsSync(location)?fs.readFileSync(location):null;
}
function charmEffect(){return {effectId:'succubus.charm',iconKey:'succubus.charm',source:'boss',target:'player',kind:'debuff',change:'gained',name:'Charm',shape:'eye',stacks:null,turns:null,statChanges:[]};}
function playerSkillId(log,state) {
  const action=log?.interruptStrike?'interrupt_strike':log?.action==='thrust'&&log.warrior?.deep?'deep_thrust':log?.action||'idle';
  return 'player.'+state.config.job+'.'+action;
}
function bossSkillId(event,combo) {
  if (!event) return 'succubus.idle';
  const pattern=event.pattern?.kind;
  return 'succubus.'+(pattern||event.event||'idle').toLowerCase()+(combo?'.hit_'+combo.index:'');
}
// Old active-status descriptors have labels rather than IDs. Recognized rows
// receive stable keys only at this compatibility boundary. Unknown legacy rows
// retain their old fallback; new recipientEffects must always carry explicit IDs.
function activeEffect(row,state) {
  const shared={Protection:'shared.protection','Battle Rally':'shared.battle_rally',Booster:'shared.server_booster','Server Booster':'shared.server_booster',
    'Attack Enchant':'shared.attack_enchant','Parry Empowerment':'shared.parry_empowerment',Charm:'succubus.charm',
    "Devil's Contract":'succubus.devils_contract','Contract Vulnerability':'succubus.contract_vulnerability',Sandstorm:'colossus.sandstorm'};
  let effectId=shared[row.name]||EFFECTS[row.name]?.effectId;
  if(row.name==='Blessing'&&row.shape==='star')effectId='shared.blessing';
  if(!effectId)return null;
  return {...row,effectId,iconKey:effectId,target:'player',source:row.bad||row.group==='contract'?'boss':null,
    // A legacy contract can mix advantages and penalties. Do not invent one
    // polarity for it; new explicit contracts must describe each real effect.
    ...(row.group==='contract'?{}:{kind:row.bad||row.group==='debuff'?'debuff':'buff'}),stacks:row.count??null};
}
module.exports={EFFECTS,gainedEffect,readEffectIcon,playerSkillId,bossSkillId,activeEffect,charmEffect};
