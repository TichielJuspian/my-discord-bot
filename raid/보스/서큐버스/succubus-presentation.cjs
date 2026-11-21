const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Compatibility adapter for the frozen Succubus event vocabulary. New bosses
// supply stable IDs directly; they do not add branches to the shared renderer.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const EFFECTS=Object.freeze({
  'Focus':{effectId:'warrior.focus',shape:'eye',stack:'bladerFocus'},
  'Sharp Eye':{effectId:'warrior.sharp_eye',shape:'sword',file:'sharp-eye.png'},
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
const chargeKey=n=>Number.isInteger(n)&&n>=1&&n<=3?'berserker.charge.'+n:'berserker.charge';
const CARD_ICON=Object.freeze({'warrior.focus':'blader_focus','berserker.charge.1':'berserker_charge_1','berserker.charge.2':'berserker_charge_2','berserker.charge.3':'berserker_charge_3'});
const CARD_ASSET_DIR=path.join(__dirname,'../../클래스/card-v23/assets');
const SPRITE_SIZE=38*38*4;
let sprites;
function cardSprite(key){
 if(!Object.hasOwn(CARD_ICON,key))return null;
 if(!sprites){
  sprites=zlib.inflateSync(fs.readFileSync(path.join(CARD_ASSET_DIR,'v352-effect-icons.rgba.deflate')),{maxOutputLength:4*SPRITE_SIZE});
  if(sprites.length!==4*SPRITE_SIZE)throw Error('Invalid v3.5.2 card effect art');
 }
 const i=Object.keys(CARD_ICON).indexOf(key);return sprites.subarray(i*SPRITE_SIZE,(i+1)*SPRITE_SIZE);
}
const BY_ID=new Map(Object.values(EFFECTS).map(e=>[e.effectId,e]));
function gainedEffect(name,state) {
  const definition=EFFECTS[name];
  if (!definition) throw new TypeError('Unregistered Succubus effect: '+name);
  const stacks=state.config?.job==='warrior' && definition.stack && Number.isInteger(state[definition.stack]) && state[definition.stack]>0 ? state[definition.stack] : null;
  return {effectId:definition.effectId,iconKey:name==='Charge'?chargeKey(state.berserkerCharge):definition.effectId,name:state.config?.job==='warrior'?definition.name||name:name,
    source:'player',target:'player',kind:'buff',change:'gained',shape:definition.shape,stacks,turns:null};
}
// Single immutable icon definition and lazy resolution for the battle log and native lower status rows.
// Discord bindings below are the verified preexisting app emoji IDs; never derive IDs from assets.
const DISCORD_ICON=Object.freeze({});
const EXTRA_FILE=Object.freeze({'shared.server_booster':'discord-boost.png','succubus.contract_vulnerability':'contract-vulnerability.png','succubus.devils_contract':'contract-vulnerability.png'});
const GLYPHS=Object.freeze({'warrior.focus':'↑','berserker.charge':'◆','berserker.enrage':'↑','berserker.tackle_defense':'↑'});
const ICONS=new Map();
function resolveEffectIcon(key){
 if(!key)return null;
 if(ICONS.has(key))return ICONS.get(key);
 let location=null;
 const named=Object.hasOwn(CARD_ICON,key)?CARD_ICON[key]:null;
 if(named)location=path.join(CARD_ASSET_DIR,named+'.png');
 else if(key==='succubus.charm')location=runtimePaths.join(runtimePaths.directory('raid15'),'..','succubus-art-20261113','Status-Curse Icon Charm.png');
 else {
  const name=BY_ID.get(key)?.file||(Object.hasOwn(EXTRA_FILE,key)?EXTRA_FILE[key]:null);
  if(name)location=runtimePaths.join(runtimePaths.directory('raid15'),'assets',name);
 }
 const art=location&&fs.existsSync(location)?fs.readFileSync(location):null;
 const emoji=Object.hasOwn(DISCORD_ICON,key)?DISCORD_ICON[key]:null;
 const glyph=Object.hasOwn(GLYPHS,key)?GLYPHS[key]:/^berserker\.charge\.[123]$/.test(key)?GLYPHS['berserker.charge']:null;
 const icon=art||emoji||glyph?Object.freeze({art,glyph,emojiName:named,custom:!!emoji,card:cardSprite(key),discord:emoji?`<${emoji.animated?'a':''}:${emoji.name}:${emoji.id}>`:glyph}):null;
 // Keys are controlled effect IDs. Unknown effects retain legacy fallback; don't cache them.
 if(icon)ICONS.set(key,icon);
 return icon;
}
const readEffectIcon=key=>resolveEffectIcon(key)?.art||null;
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
  return {...row,effectId,iconKey:effectId==='berserker.charge'?chargeKey(row.count??state.berserkerCharge):effectId,target:'player',source:row.bad||row.group==='contract'?'boss':null,
    // A legacy contract can mix advantages and penalties. Do not invent one
    // polarity for it; new explicit contracts must describe each real effect.
    ...(row.group==='contract'?{}:{kind:row.bad||row.group==='debuff'?'debuff':'buff'}),stacks:row.count??null};
}
module.exports={EFFECTS,gainedEffect,readEffectIcon,resolveEffectIcon,playerSkillId,bossSkillId,activeEffect,charmEffect};
