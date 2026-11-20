const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const M=require('./raid-workshop-model.js');
// Presentation only: workshop accounts never enter an active battle.
function session(a){
 const s=a.state,account=M.fresh(s.config.level);
 account.job=s.config.job;
 account.slots={...account.slots,...s.enhancements};
 return {account,level:s.config.level,view:a.view,inventoryPage:0,pending:null};
}
function asset(a){
 const inventory=a.view==='inventory',s=session(a);
 return {name:inventory?'raid-inventory.png':'raid-equipment.png',
 attachment:inventory?require('./raid-workshop-visuals.js').render('inventory',s):require('./raid-workshop-render.js').render(s),
 description:inventory?'Battle inventory':'Battle equipment / Weapon, armor, accessory'};
}
function panel(a){const f=asset(a);return {files:[f],components:[{type:17,accent_color:0xc9a967,components:[{type:12,items:[{media:{url:'attachment://'+f.name},description:f.description}]}]}]};}
module.exports={ITEMS:{},isAction:()=>false,session,asset,panel,render:()=>[]};
