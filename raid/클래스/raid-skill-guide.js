'use strict';
const Guide=require('./selection-reader.cjs');
const resolvePage=(_state,tab)=>Guide.resolveTab(tab);
const pages=()=>[...Guide.tabs];
const assets=state=>Guide.guideBody(state.config.job).files;
const components=state=>Guide.guideBody(state.config.job).components;
function payload(a){
 const {files,components}=Guide.guideBody(a.state.config.job);
 const button=(id,label,style=2)=>({type:2,style,label,custom_id:(a.namespace||'raidtest')+':'+a.id+':'+(a.uiRevision??a.state.turn)+':'+id});
 return {flags:32768,attachments:[],files,allowedMentions:{parse:[]},components:[{type:17,components:[
  ...components,{type:1,components:[button('battle','Close Skill Guide')]}]}]};
}
module.exports={components,payload,pages,resolvePage,assets};
