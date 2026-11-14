'use strict';
const M=require('./raid-workshop-model'),{createHash}=require('node:crypto');
const labels={power:'Attack',focus:'Crit Chance',ruin:'Crit Damage',weapon:'Weapon',armor:'Armor',accessory:'Accessory',consumable:'Consumables'};
let banner;const signatures=new WeakMap();
function payload(s,{render=true}={}){
 const a=s.account,parts=[],files=[],used=[],pool=s.mediaPool||{},pending={};
 const b=(action,label,style=2,disabled=false)=>({type:2,style,label,custom_id:'workshop:'+s.id+':'+action,disabled});
 const row=(id,buttons)=>({type:1,id,components:buttons.map((c,n)=>({...c,id:id*100+n+1}))});
 function media(logical,buffer,description,id){
  let signature=signatures.get(buffer);if(!signature){signature=createHash('sha256').update(buffer).digest('hex');signatures.set(buffer,signature);}
  const name=logical.replace('.png','-'+signature.slice(0,12)+'.png'),old=pool[name];
  const meta={name,signature,logical,...(old||{})};pending[name]=meta;used.push(name);
  if(!old?.id)files.push({name,attachment:buffer});
  parts.push({type:12,id,items:[{media:{url:old?.url||'attachment://'+name},description}]});
 }
 const input={account:a,level:s.level,name:s.name,booster:s.booster,draft:s.draft,view:s.view,pending:s.pending,inventoryFilter:s.inventoryFilter,inventoryPage:s.inventoryPage,enhancementResult:s.enhancementResult,potionResult:s.potionResult,pointsBalance:s.pointsBalance};
 if(render){
  if(!banner){const fs=require('node:fs'),{Resvg}=require('@resvg/resvg-js'),raw=fs.readFileSync(require('node:path').join(__dirname,'workshop-banner.png')).toString('base64');banner=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="230"><image href="data:image/png;base64,'+raw+'" width="1000" height="230" preserveAspectRatio="xMidYMid slice"/><text x="28" y="65" font-family="Noto Sans" font-size="32" font-weight="bold" fill="#f4ce84">CHARACTER WORKSHOP</text></svg>',require('./raid-name-fonts').options()).render().asPng();banner=require('./raid-entry-image-cache').optimizePNG(banner);}
  media('workshop-banner-card.png',banner,'Character workshop',1);
  media('workshop-profile.png',require('./raid-workshop-card').render({...input,draft:null},'profile'),'Current workshop character',2);
 }
 parts.push(row(30,[...['equipment','enhance','class'].map((k,n)=>b(k,['Equipment','Enhance','Class'][n],s.view===k?1:2)),b('close','Close Workshop',4)]));
 if(render)media('workshop-detail-'+s.view+'.png',require('./raid-workshop-render').render(input),'Selected workshop page',4);
 if(render&&s.view==='enhance')media('workshop-forge-bonuses.png',require('./raid-workshop-render').render(input,'footer'),'Enhancement bonuses and rules',5);
 if(s.notice)parts.push({type:10,id:21,content:s.notice});
 if(s.view==='equipment'){
  const inv=require('./raid-workshop-inventory').page(a,s.inventoryFilter||'all',s.inventoryPage);s.inventoryPage=inv.index;
  parts.push(row(40,['all',...M.SLOTS,'consumable'].map(k=>b('filter_'+k,k==='all'?'All Items':labels[k],(s.inventoryFilter||'all')===k?1:2))));
  if(render)media('workshop-inventory.png',require('./raid-workshop-visuals').render('inventory',input),'Inventory items',6);
  else parts.push({type:10,id:6,content:'INVENTORY / '+inv.total+' items'});
  for(let offset=0;offset<inv.items.length;offset+=4)parts.push(row(50+offset,inv.items.slice(offset,offset+4).map(([id,item])=>id==='stat_potion'?b('use_potion','Use Stat Potion ('+M.quantity(a,id)+')',3):id==='normal_enhance_scroll'?b('enhance','Enhancement Scroll ('+M.quantity(a,id)+')'):b('equip_'+id,item.name+(item.quality?' ['+item.quality+']':''),2,!!item.job&&item.job!==a.job))));
  parts.push(row(70,[b('inventory_prev','Previous',2,inv.index===0),b('inventory_next','Next',2,inv.index===inv.pages-1)]));
  const filter=s.inventoryFilter||'all',hasEquipped=filter==='all'?Object.values(a.equipped).some(Boolean):!!a.equipped[filter];
  parts.push(row(80,s.pending?[b('confirm',s.pending.action==='sell'?'Sell - Locked':s.pending.action==='testkit'?'Claim Items':'Equip Item',3,s.pending.action==='sell'),b('sell','Sell Item',2,s.pending.action!=='equip'),b('cancel','Back')]:[b('unequip',filter==='all'?'Unequip All':'Unequip',3,!hasEquipped)]));
 }else if(s.view==='class'){
  parts.push(row(40,M.JOBS.map(j=>b('job_'+j,j.toUpperCase(),s.pending?.value===j?1:2,j===a.job))));
  parts.push(row(50,[b('confirm','Change Class',3,s.pending?.action!=='job'),b('cancel','Back',2,!s.pending)]));
  parts.push(row(60,['core','passives','advanced','growth'].map(k=>b('guide_'+k,{core:'Core Skills',passives:'Passives',advanced:'Advanced',growth:'Level Unlocks'}[k],(s.guidePage||'core')===k?1:2))));
  if(render)require('./raid-workshop-guide').assets(s).forEach((f,n)=>media('workshop-'+f.name,f.attachment,f.description,100+n));
 }else if(s.view==='enhance'){
  const P=require('./raid-engine/slot-progression.cjs'),slot=s.pending?.action==='enhance'?s.pending.value:null,q=slot&&a.slots[slot]<P.MAX?P.quote(a.slots[slot]+1,a.enhancementFailures?.[slot]||0,!!s.pending?.useScroll):null;
  parts.push(row(40,M.SLOTS.map(k=>b('upgrade_'+k,labels[k]+' +'+a.slots[k],slot===k?1:2))));
  if(q&&q.target<=20)parts.push(row(49,[b('toggle_scroll',s.pending?.useScroll?'Scroll ON (+10%p)':'Use Scroll +10%p ('+(a.inventory.normal_enhance_scroll||0)+')',s.pending?.useScroll?3:2,!(a.inventory.normal_enhance_scroll>0))]));
  parts.push(row(50,[b('confirm',q?(q.mode==='gauge'?'Progress - ':'Enhance - ')+q.cost+' P':'Enhance',3,!q||!Number.isSafeInteger(s.pointsBalance)||s.pointsBalance<q.cost)]));
 }
 if(s.entry?.duringBattle)parts.push({type:10,id:91,content:'Changes are saved for your next battle.'},row(90,[b('back_battle','Back to Battle',3)]));
 else if(s.entry)parts.push(row(90,[b('start_battle','Start Battle',3,!!s.draft||!!s.pending||!M.ready(a,s.level))]));
 if(s.view!=='class'){if(render)media('workshop-buffs.png',require('./raid-workshop-visuals').render('buffs',{booster:s.booster}),'Active buffs',20);else parts.push({type:10,id:20,content:'ACTIVE BUFFS'});}
 const keep=[...used,...Object.keys(pool).reverse().filter(k=>!used.includes(k))].slice(0,10);
 const attachments=keep.filter(k=>pool[k]?.id&&pool[k].retain===true).map(k=>({id:pool[k].id,filename:k}));
 s.pendingMedia=Object.fromEntries(keep.map(k=>[k,pending[k]||pool[k]]));
 return {flags:32768,components:parts,allowedMentions:{parse:[]},attachments,...(files.length?{files}:{})};
}
function remember(s,message){
 // Components V2 can return uploaded media on the gallery rather than in attachments.
 // Also recover from the next button's message when an edit returns no media metadata.
 message=message?.resource?.message||message;
 const pool={...(s.mediaPool||{}),...(s.pendingMedia||{})};
 function add(item,retain=false){
  const url=item.url||item.proxy_url||item.proxyURL;
  let name=item.name||item.filename;
  if(!name&&url){try{name=decodeURIComponent(new URL(url).pathname.split('/').pop());}catch{}}
  const key=pool[name]?name:Object.keys(pool).find(k=>name&&k.includes(pool[k].signature?.slice(0,12))&&name.includes(pool[k].signature?.slice(0,12)));
  let uploadedId;
  try{const u=new URL(url);if(['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname))uploadedId=/^\/(?:ephemeral-)?attachments\/\d+\/(\d+)\//.exec(u.pathname)?.[1];}catch{}
  const id=uploadedId||item.attachment_id||item.attachmentId||item.id;
  if(key&&id)pool[key]={...pool[key],id:String(id),retain:!!uploadedId||retain||pool[key].retain===true,...(url&&!url.startsWith('attachment://')?{url}:{})};
 }
 for(const item of message?.attachments?.values?.()||[])add(item,true);
 function walk(component){
  const c=component.toJSON?.()||component.data||component;
  if(c.media)add(c.media);
  for(const item of c.items||[])if(item.media)add(item.media);
  for(const child of c.components||[])walk(child);
  if(c.accessory)walk(c.accessory);
 }
 for(const c of message?.components||[])walk(c);
 const wanted=Object.keys(s.pendingMedia||{});
 s.mediaPool=Object.fromEntries((wanted.length?wanted:Object.keys(pool)).slice(-10).map(k=>[k,pool[k]]));s.pendingMedia={};
}
module.exports={payload,remember};
