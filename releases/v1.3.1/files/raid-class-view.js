'use strict';
const guide=require('./raid-skill-guide');
const title=job=>job==='berserker'?'Berserker':job==='paladin'?'Paladin':'Blader';
function payload(token,profile,{job=profile.job||'warrior',page='overview',level=1,testing=false}={}){
 const button=(action,label,style=2,disabled=false)=>({type:2,style,label,custom_id:'raidtest:class:'+token+':'+action,disabled});
 const state=require('./raid-engine/progression-combat.cjs').create(require('./raid-test-build').config(job,level),1);
 const files=[require('./raid-class-card').asset({level,job,current:profile.job}),...(page==='overview'?[]:guide.assets(state,page))];
 const media=f=>({type:12,items:[{media:{url:'attachment://'+f.name},description:f.description}]});
 const controls=[media(files[0]),
  {type:1,components:[button('warrior','Blader',job==='warrior'?1:2),button('paladin','Paladin',job==='paladin'?1:2),button('berserker','Berserker',job==='berserker'?1:2)]},
  ...files.slice(1).map(media),
  {type:1,components:[button('passives','Passives',page==='passives'?1:2),button('core','Core skills',page==='core'?1:2),button('advanced','Advanced',page==='advanced'?1:2),button('growth','Level unlocks','growth'===page?1:2)]}];
 if(testing)controls.push({type:10,content:(profile.job?'Current class: **'+title(profile.job)+'** · ':'')+'Free class selection during testing.'});
 else if(!profile.job)controls.push({type:10,content:'Confirm this class to continue.'});
 else controls.push({type:10,content:'Current class: **'+title(profile.job)+'**'});
 controls.push({type:1,components:[...(job&&(!profile.job||testing)?[button('choose','Confirm '+title(job),3)]:[]),button('cancel','Close')]});
 return {flags:32768,files,attachments:[],allowedMentions:{parse:[]},components:controls};
}
module.exports={payload};
