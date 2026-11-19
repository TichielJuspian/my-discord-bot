'use strict';
const M=require('./raid-workshop-model'),{Resvg}=require('@resvg/resvg-js');
function button(a,action,label,active=false,disabled=false){return {type:2,style:active?1:2,label,custom_id:'raidtest:'+a.id+':'+a.state.turn+':'+action,disabled};}
function tabs(a){return {type:1,components:[button(a,'equipment','Equipment',a.view==='equipment'),button(a,'inventory','Inventory',a.view==='inventory'),button(a,'skills','Skill Guide',a.view==='skills'),button(a,'menu','Menu'),button(a,'battle','Back to Battle')]};}
function account(a){const s=a.state,w=s.workshop||{},saved=a.workshopAccount||{},fresh=M.fresh(s.config.level);return {...fresh,...saved,...w,job:s.config.job,slots:w.slots||s.enhancements||saved.slots||fresh.slots,equipped:{...(w.equipped||saved.equipped||{})},inventory:{...(w.inventory||saved.inventory||{})},allocation:w.allocation||saved.allocation||fresh.allocation};}
const cache=new Map();
function payload(a){
 const acc=account(a),input={account:acc,level:a.state.config.level,view:'equipment',inventoryPage:a.inventoryPage||0},equipment=a.view==='equipment';
 const key=JSON.stringify([a.view,acc,a.inventoryPage||0]);let png=cache.get(key);
 if(!png){if(equipment){const svg=require('./raid-workshop-detail').svg(input).replace('WORKSHOP','BATTLE EQUIPMENT').replace('PREVIEW ONLY','EQUIPPED IN THIS BATTLE').replace('FREE DURING TESTING','READ ONLY');png=new Resvg(svg,require('./raid-name-fonts').options(svg)).render().asPng();}else png=require('./raid-workshop-visuals').render('inventory',input);cache.set(key,png);if(cache.size>24)cache.delete(cache.keys().next().value);}
 const name=equipment?'battle-equipment.png':'battle-inventory.png',components=[tabs(a),{type:12,items:[{media:{url:'attachment://'+name},description:equipment?'Equipped battle gear':'Unequipped inventory items'}]}];
 if(!equipment) {const page=require('./raid-workshop-inventory').page(acc,'all',a.inventoryPage);if(page.pages>1)components.push({type:1,components:[button(a,'inventory_prev','Previous',false,page.index===0),button(a,'inventory_next','Next',false,page.index===page.pages-1)]});const items=Object.entries(a.inventoryItems||{}).filter(([,n])=>n>0);if(items.length)components.push({type:10,content:'**OTHER ITEMS**\n'+items.map(([id,n])=>(id==='class_reset'?'Class Reset Potion':id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))+' × '+n).join('\n')});}
 return {flags:32768,attachments:[],allowedMentions:{parse:[]},components,files:[{name,attachment:png}]};
}
function skillPayload(a){const p=require('./raid-skill-guide').payload(a);p.components=p.components.filter(c=>!(c.type===1&&c.components?.some(b=>b.label==='Menu')));p.components.unshift(tabs(a));return p;}
module.exports={payload,skillPayload,tabs,account};
