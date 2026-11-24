const runtimePaths = require("../runtime-paths.cjs");
'use strict';
const M=require('./raid-workshop-model.js'),{createHash}=require('node:crypto');
const labels={power:'Attack',focus:'Crit Chance',ruin:'Crit Damage',weapon:'Weapon',armor:'Armor',accessory:'Accessory',consumable:'Consumables'};
let bannerBackground;const signatures=new WeakMap();
const NEEDS_RENDER=Symbol("needs workshop render");
function payload(s,{render=true,retainedOnly=false}={}){
 const a=s.account,parts=[],files=[],used=[],pool=Object.fromEntries(Object.entries(s.mediaPool||{}).filter(([,file])=>{
  if(!file.id||!file.url||!file.retain)return false;
  try{
   const url=new URL(file.url),expiry=url.searchParams.get('ex');
   return ['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)&&(!expiry||parseInt(expiry,16)*1000>Date.now()+30000);
  }catch{return false;}
 })),pending={};
 const b=(action,label,style=2,disabled=false)=>({type:2,style,label,custom_id:'workshop:'+s.id+':'+action,disabled});
 const row=(id,buttons)=>({type:1,id,components:buttons.map((c,n)=>({...c,id:id*100+n+1}))});
 function media(logical,buffer,description,id,visible=true,visualKey,makeGallery){
  let signature=signatures.get(buffer);if(!signature){signature=createHash('sha256').update(buffer).digest('hex');signatures.set(buffer,signature);}
  const name=logical.replace(/\.(png|jpg)$/, '-'+signature.slice(0,12)+'.$1'),old=pool[name];
  const meta={name,signature,logical,...(old||{}),description,visualKey};pending[name]=meta;used.push(name);
  if(!old?.id)files.push({name,attachment:buffer});
  if(visible)parts.push(makeGallery?makeGallery({name,description},id,old?.url):{type:12,id,items:[{media:{url:old?.url||'attachment://'+name},description}]});
 }
 // Reuse only retained Discord attachments from this workshop session.
 function section(logical,fields,description,id,build,makeGallery){
  const visualKey=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  const file=Object.values(pool).find(f=>f.logical===logical&&f.visualKey===visualKey&&f.id&&f.url&&f.retain);
  if(file){
   pending[file.name]=file;used.push(file.name);
   const alt=file.description||description;
   parts.push(makeGallery?makeGallery({name:file.name,description:alt},id,file.url):{type:12,id,items:[{media:{url:file.url},description:alt}]});
   return;
  }
  if(retainedOnly)throw NEEDS_RENDER;
  const result=build();
  media(logical,result.attachment||result,result.description||description,id,true,visualKey,makeGallery);
 }
 function staticAsset(record,id,load){
  section(record.name,[],record.description,id,load,require('../클래스/selection-reader.cjs').gallery);
 }
 const input={account:a,level:s.level,name:s.name,boostCount:s.boostCount,boostUnavailable:s.boostUnavailable,draft:s.draft,view:s.view,pending:s.pending,inventoryFilter:s.inventoryFilter,inventoryPage:s.inventoryPage,enhancementResult:s.enhancementResult,potionResult:s.potionResult,equipmentDetailId:s.equipmentDetailId,pointsBalance:s.pointsBalance,classChangeCost:s.classChangeCost??0};
 if(render&&s.view!=='class'){
  const previousBanner=Object.values(pool).find(file=>file.logical==='workshop-banner-card.png'&&file.id&&file.url);
  if(previousBanner){
   pending[previousBanner.name]=previousBanner;used.push(previousBanner.name);
   parts.push({type:12,id:1,items:[{media:{url:previousBanner.url},description:'Workshop'}]});
  }else{
   if(retainedOnly)throw NEEDS_RENDER;
   const fs=require('node:fs'),{Resvg}=require('@resvg/resvg-js');
   bannerBackground??=fs.readFileSync(runtimePaths.join(runtimePaths.directory("."),'workshop-banner.png')).toString('base64');
   const name=String(s.name||'Challenger').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="92"><image href="data:image/png;base64,'+bannerBackground+'" width="1000" height="230" preserveAspectRatio="xMidYMid slice"/><text x="28" y="63" font-family="Noto Sans" font-size="'+Math.min(42,Math.floor(940/(Array.from(String(s.name||'')).length+10)))+'" font-weight="bold" fill="#f4ce84">'+name+'’s Workshop</text></svg>';
   const banner=new Resvg(svg,require('../보스/전투/raid-name-fonts.js').options(svg)).render().asPng();
   media('workshop-banner-card.png',require('../보스/전투/raid-entry-image-cache.js').optimizePNG(banner),'Workshop',1);
  }
  section('workshop-profile.png',['linked-gold-level-centered',a.job,s.level,a.slots,a.allocation,a.equipped,a.potionStats,s.boostCount,s.boostUnavailable],'Character card',2,()=>{
   const state=M.battle(a,s.level);
  state.maxEnergy=require('../보스/전투/흐름/rules.cjs').energyMaximum(state.maxEnergy-3);
  state.energy=state.maxEnergy;require('./raid-workshop-boost.js').stats(state.stats,input);
   return require('../클래스/card-v23/renderer.cjs').workshopProfileAsset({state});
  });
 }
 if(s.view!=='class')parts.push(row(30,[...['equipment','enhance','class'].map((k,n)=>b(k,['Equipment','Enhance','Class'][n],s.view===k?1:2)),b('close','Close Workshop',4)]));
 if(render&&s.view!=='class'){
  const slot=s.pending?.value||s.enhancementResult?.slot;
  const visual=s.view==='enhance'?['forge-v440',slot,slot?a.slots[slot]:a.slots,slot?a.enhancementFailures?.[slot]:0,s.pending?.useScroll,s.enhancementResult,s.pointsBalance]:[a,s.level,s.boostCount,s.boostUnavailable,s.draft,s.pending,s.potionResult,s.view==='equipment'?s.equipmentDetailId:null];
  section(s.view==='equipment'?'workshop-detail-equipment-combined.png':'workshop-detail-'+s.view+'.png',visual,'Selected workshop page',4,()=>require('./raid-workshop-render.js').render(input));
 }
 if(s.notice)parts.push({type:10,id:21,content:s.notice});
 if(s.view==='equipment'){
  const inv=require('./raid-workshop-inventory.js').page(a,s.inventoryFilter||'all',s.inventoryPage);s.inventoryPage=inv.index;
  parts.push(row(40,['all',...M.SLOTS,'consumable'].map(k=>b('filter_'+k,k==='all'?'All Items':labels[k],(s.inventoryFilter||'all')===k?1:2))));
  if(render)section('workshop-inventory.png',[a.job,a.inventory,a.potions,a.equipped,input.inventoryFilter,input.inventoryPage],'Inventory items',6,()=>require('./raid-workshop-visuals.js').render('inventory',input));
  else parts.push({type:10,id:6,content:'INVENTORY / '+inv.total+' items'});
  for(let offset=0;offset<inv.items.length;offset+=4)parts.push(row(50+offset,inv.items.slice(offset,offset+4).map(([id,item])=>id==='stat_potion'?b('use_potion','Use Stat Potion ('+M.quantity(a,id)+')',3):id==='normal_enhance_scroll'?b('enhance_scroll','Enhancement Scroll ('+M.quantity(a,id)+')'):b('equip_'+id,item.name,2,!!item.job&&item.job!==a.job))));
  const filter=s.inventoryFilter||'all',hasEquipped=filter==='all'?Object.values(a.equipped).some(Boolean):!!a.equipped[filter];
  const pager=row(70,[b('inventory_prev','Previous',2,inv.index===0),b('inventory_next','Next',2,inv.index===inv.pages-1),b('unequip',filter==='all'?'Unequip All':'Unequip',3,!hasEquipped)]);
  pager.components[2].id=8001; // Keep the existing Unequip component identity.
  parts.push(pager);
 }else if(s.view==='class'){
  const changing=s.pending?.action==='job',job=changing?s.pending.value:a.job;
  const controls=[row(50,[b('confirm',changing?'Confirm · '+(s.classChangeCost||0).toLocaleString('en-US')+' P':'Change Class',3,!changing),b('equipment','Equipment'),b('enhance','Enhance'),b('close','Close Workshop',4)])];
  if(s.entry&&!s.entry.duringBattle)controls.push(row(90,[b('start_battle','Start Battle',3,!!s.draft||!!s.pending||!M.ready(a,s.level))]));
  require('../클래스/raid-class-view.js').selection({job,current:a.job,render,parts,media:staticAsset,button:b,row,controls,disabledCurrent:true,upper:true,
   notes:changing&&s.testClassGearEnabled===true?[{type:10,id:22,content:require('./raid-test-gear.js').changeNotice(true)}]:[]});
 }else if(s.view==='enhance'){
  const P=require('../보스/전투/엔진/slot-progression.cjs'),slot=s.pending?.action==='enhance'?s.pending.value:null,q=slot&&a.slots[slot]<P.MAX?P.quote(a.slots[slot]+1,a.enhancementFailures?.[slot]||0,!!s.pending?.useScroll):null;
  if(!render){const D=require('./raid-workshop-odds-display.js');parts.push({type:10,id:7,content:D.selectedText(s)},{type:10,id:8,content:D.guideText()});}
  parts.push(row(40,M.SLOTS.map(k=>b('upgrade_'+k,labels[k]+' +'+a.slots[k],slot===k?1:2))));
  const controls=[b('confirm',q?(q.mode==='gauge'?'Progress - ':'Enhance - ')+q.cost+' P':'Enhance',3,!q||!Number.isSafeInteger(s.pointsBalance)||s.pointsBalance<q.cost)];
  if(q&&q.target<=20)controls.push(b('toggle_scroll',s.pending?.useScroll?'Scroll ON (+10%p)':'Use Scroll +10%p ('+(a.inventory.normal_enhance_scroll||0)+')',s.pending?.useScroll?3:2,!(a.inventory.normal_enhance_scroll>0)));
  parts.push(row(50,controls));
 if(render&&s.view==='enhance'){
  const renderer=require('./raid-workshop-render.js');
  section('workshop-forge-parchment-odds.png',[],'Enhancement probability guide',5,()=>renderer.render(input,'footer'));
 }
 }
 if(s.entry?.duringBattle)parts.push({type:10,id:91,content:'Changes are saved for your next battle.'},row(90,[b('back_battle','Back to Battle',3)]));
 else if(s.entry&&s.view!=='class')parts.push(row(90,[b('start_battle','Start Battle',3,!!s.draft||!!s.pending||!M.ready(a,s.level))]));
 if(s.view!=='enhance'){
  if(render&&s.view!=='class')section('workshop-buffs.png',[s.boostCount,s.boostUnavailable],'Server boost',20,()=>require('./raid-workshop-visuals.js').render('buffs',input));else if(!render)parts.push({type:10,id:20,content:require('./raid-workshop-boost.js').label(s)});
 }
 const keep=[...used,...Object.keys(pool).reverse().filter(k=>!used.includes(k)&&((s.view!=='class'&&s.view!=='enhance')||pool[k]?.logical!=='workshop-buffs.png')&&(s.view!=='enhance'||!['workshop-forge-bonuses.png','workshop-forge-milestones.png','workshop-forge-odds.png'].includes(pool[k]?.logical)))].slice(0,10);
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
function retainedPayload(s){
 if(!s.mediaPool||!['enhance','equipment','class'].includes(s.view))return null;
 const preview={...s};
 try {
  const body=payload(preview,{retainedOnly:true});
  s.pendingMedia=preview.pendingMedia;s.inventoryPage=preview.inventoryPage;
  return body;
 } catch(error){if(error===NEEDS_RENDER)return null;throw error;}
}
module.exports={payload,remember,retainedPayload};
