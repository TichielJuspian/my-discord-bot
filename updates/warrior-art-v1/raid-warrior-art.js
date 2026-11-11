'use strict';
// Presentation only. No combat imports, state writes, randomness, network or DB access.
const {inflateSync}=require('node:zlib');
let pack; const frames=new Map();
const aliases=Object.freeze({ready:'idle',attack:'slash',guard:'parry_success',guard_prepare:'parry_success',guard_hold:'parry_success',guard_block:'parry_success',thrust:'thrust_a',thrust_prepare:'thrust_a',thrust_hit:'thrust_a',deep_thrust:'deep_thrust_a',parry:'parry_success',parry_prepare:'parry_success',parry_failed:'hit',stagger:'hit',counter:'thrust_a',perfect_parry:'parry_perfect',ultimate_evade:'evade'});
function data(){
 if(!pack){pack=require('./raid-warrior-art-v1.json');if(pack.schema!==1||pack.cardSize!==128)throw Error('Invalid warrior artwork bundle');}
 return pack;
}
function frame(pose,legendary=false){
 const skin=legendary?'legendary':'normal',name=aliases[pose]||pose,key=skin+':'+name;
 if(frames.has(key))return frames.get(key);
 const value=data().skins[skin][name];if(!value)return null;
 const pixels=inflateSync(Buffer.from(value.cardRgba,'base64'));
 if(pixels.length!==128*128*4)throw Error('Invalid warrior RGBA frame: '+key);
 const out=Object.freeze({...value,cardPixels:pixels,cardSize:128,cardView:Object.freeze({x:0,y:0,size:512})});
 frames.set(key,out);return out;
}
function forState(state,chosen){
 if(state.config.job!=='warrior')return chosen;
 if(chosen.lastStand){const {lastStand,...rest}=chosen;return {...rest,pose:'last_stand'};}
 // Respect the existing priority for death, mechanic damage, ultimate and evasion.
 if(!['thrust_hit','deep_thrust'].includes(chosen.pose))return chosen;
 const logs=state.log||[];let count=0;
 for(let i=logs.length-1;i>=0;i--){if(logs[i].action!=='thrust')break;count++;}
 const variant=count>0&&count%2===0?'b':'a';
 return {...chosen,pose:(chosen.pose==='deep_thrust'?'deep_thrust_':'thrust_')+variant};
}
const skillIcons=Object.freeze({Slash:'slash',Thrust:'thrust','Deep Thrust':'deep_thrust',Parry:'parry','Perfect Parry':'perfect_parry','Resonant Wave Slash':'ultimate','Emergency Evade':'evade'});
function icon(skill,x,y,size=44){
 const key=skillIcons[skill];if(!key)return '';
 if(![x,y,size].every(Number.isFinite)||size<=0)throw Error('Invalid icon rectangle');
 return `<image x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" href="data:image/png;base64,${data().icons[key]}"/>`;
}
module.exports={frame,forState,icon};
