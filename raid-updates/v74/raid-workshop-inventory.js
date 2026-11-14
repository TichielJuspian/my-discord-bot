'use strict';
const M=require('./raid-workshop-model');
function page(account,filter='all',number=0,catalog=M.ITEMS){
 const items=[...new Set([...Object.keys(account.inventory), 'stat_potion'])].map(id=>[id,catalog[id]]).filter(([,item])=>!!item).filter(([id,item])=>M.quantity(account,id)-(account.equipped[item.slot]===id?1:0)>0&&(filter==='all'||item.slot===filter));
 const pages=Math.max(1,Math.ceil(items.length/8)),index=Math.max(0,Math.min(pages-1,number||0));
 return {items:items.slice(index*8,index*8+8),index,pages,total:items.length};
}
module.exports={page};

