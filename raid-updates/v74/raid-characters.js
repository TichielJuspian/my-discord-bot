'use strict';
const fs=require('node:fs'),path=require('node:path');
const JOBS=['warrior','paladin','berserker'];
function createStore({file=null,testGrant=false}={}){
 let memory={version:1,accounts:{}};
 function load(){let data=memory;if(file)try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(data.version!==1||!data.accounts||typeof data.accounts!=='object'||Array.isArray(data.accounts))throw Error('Invalid character storage');return data;
 }
 function account(data,guildId,userId){if(!guildId||!userId)throw Error('Missing character owner');const key=String(guildId)+':'+String(userId),a=data.accounts[key]||{job:null,revision:0,items:{}};
  if((a.job!==null&&!JOBS.includes(a.job))||!Number.isSafeInteger(a.revision)||a.revision<0||!Number.isSafeInteger(a.items?.class_reset??0)||(a.items?.class_reset??0)<0)throw Error('Invalid character record');return {key,a};
 }
 function save(data){if(file){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);}memory=data;}
 function grant(a){return a;} // Class changes are free; retired reset items are not granted again.
 if(testGrant){const data=load();let changed=false;for(const key of Object.keys(data.accounts)){const cut=key.indexOf(':'),{a}=account(data,key.slice(0,cut),key.slice(cut+1)),next=grant(a);if(next!==a){data.accounts[key]=next;changed=true;}}if(changed)save(data);}
 // One-time tester rebalance: keep inventory, equipment, enhancements and prior allocation backup.
 {const data=load();let changed=false;for(const a of Object.values(data.accounts)){
  if(a.grants?.unallocated_testers_v22)continue;
  if(a.workshop){a.workshop.previousAllocationV22={...a.workshop.allocation};a.workshop.allocation={power:0,focus:0,ruin:0};a.revision++;a.workshop.revision=a.revision;}
  a.grants={...a.grants,unallocated_testers_v22:true};changed=true;
 }if(changed)save(data);}
 // Retire old test gear for every existing account at startup, preserving all slot upgrades.
 {const data=load();let changed=false;const M=require('./raid-workshop-model');
  for(const a of Object.values(data.accounts)){if(!a.workshop||!(a.workshop.schema<12))continue;
   a.workshop=M.migrate({...a.workshop,revision:a.revision});a.revision=a.workshop.revision;changed=true;
  }if(changed)save(data);
 }
 return {
  beginTestReset(){const data=load();if(data.testResetV42?.done)return [];if(!data.testResetV42){data.testResetV42={owners:Object.keys(data.accounts).filter(k=>data.accounts[k].workshop),done:false};save(data);}return [...data.testResetV42.owners];},
  finishTestReset(){const data=load();if(data.testResetV42){data.testResetV42.done=true;save(data);}},
  resetTestProgress(g,u,baseline={}){
   const data=load(),{key,a}=account(data,g,u);if(!a.workshop)return {refund:0,returned:0};
   const w=a.workshop;if(w.testResetV42)return w.testResetV42;
   const M=require('./raid-workshop-model');let paid=0;
   for(const slot of M.SLOTS){const attempts=(w.enhancementAttempts?.[slot]||0)-(baseline.attempts?.[slot]||0),free=Math.max(0,Math.min(3,w.slots[slot])-Math.min(3,baseline.slots?.[slot]||0));paid+=Math.max(0,attempts-free)*100;}
   w.testResetBackupV42={slots:{...w.slots},enhancementAttempts:{...w.enhancementAttempts},enhancementFailures:{...w.enhancementFailures},potionStats:{...w.potionStats},potions:w.potions||0};
   const returned=M.refundPotions(w);w.slots={weapon:0,armor:0,accessory:0};w.enhancementAttempts={weapon:0,armor:0,accessory:0};w.enhancementFailures={weapon:0,armor:0,accessory:0};delete w.lastEnhancement;
   w.testResetV42={refund:paid,returned};w.revision++;a.revision=w.revision;data.accounts[key]=a;save(data);return {...w.testResetV42};
  },
  workshopCommit(g,u,level,expected,next,requestId){
   const data=load(),{key,a}=account(data,g,u),M=require('./raid-workshop-model');
   const current=M.migrate({...M.fresh(level),...(a.workshop||{}),job:a.workshop?.job||a.job||'warrior',revision:a.revision},level);
   if(current.receipts.includes(requestId))return structuredClone(current);
   if(current.revision!==expected)throw Error('Pending enhancement conflicts with a newer saved build. No second charge was made.');
   M.validate(next,level);data.accounts[key]={...a,job:next.job,revision:next.revision,workshop:next};save(data);return structuredClone(next);
  },
  grantRaidPotion(g,u,raidId,success=true){
   const data=load(),{key,a}=account(data,g,u),M=require('./raid-workshop-model');
   const w=M.migrate({...M.fresh(1),...(a.workshop||{}),job:a.workshop?.job||a.job||'warrior',revision:a.revision},1);
   if((w.potionRewards||[]).includes(raidId))return false;
   Object.assign(w,require('./raid-item-catalog').award(w,raidId,M.ITEMS,success,()=>require('node:crypto').randomInt(0,1000000)/1000000));
     w.potionRewards=[...(w.potionRewards||[]),raidId];w.potions=(w.potions||0)+(success?1:0);w.revision++;
   data.accounts[key]={...a,revision:w.revision,workshop:w};save(data);return true;
  },
  markRaidPrepared(guildId,userId){const data=load(),{key,a}=account(data,guildId,userId);data.accounts[key]={...a,grants:{...a.grants,raidPreparedV25:true}};save(data);},
  workshopRead(guildId,userId,level,initialize=false){
   const M=require('./raid-workshop-model'),data=load(),{key,a}=account(data,guildId,userId);
   if(!a.workshop&&!initialize)return null;
   const w=M.migrate({...M.fresh(level),...(a.workshop||{}),job:a.workshop?.job||a.job||'warrior',revision:a.revision},level);
   if((!a.workshop&&initialize)||(a.workshop&&a.workshop.schema!==w.schema)){data.accounts[key]={...a,grants:{...a.grants,unallocated_testers_v22:true},revision:w.revision,workshop:w};save(data);}
   return structuredClone(w);
  },
  workshopApply(guildId,userId,level,request,roll){
   const M=require('./raid-workshop-model'),data=load(),{key,a}=account(data,guildId,userId);
   const w=M.migrate({...M.fresh(level),...(a.workshop||{}),job:a.workshop?.job||a.job||'warrior',revision:a.revision},level);
   const next=M.change(w,request,level,roll);if(next===w)return structuredClone(w);
   data.accounts[key]={...a,job:next.job,grants:{...a.grants,unallocated_testers_v22:true},revision:next.revision,workshop:next};save(data);return structuredClone(next);
  },
  get(guildId,userId){const data=load(),{key,a}=account(data,guildId,userId),next=grant(a);if(next!==a){data.accounts[key]=next;save(data);}return structuredClone(next);},
  choose(guildId,userId,job,revision){if(!JOBS.includes(job))throw Error('Unavailable class');const data=load(),{key,a}=account(data,guildId,userId);if(a.job||a.revision!==revision)return {ok:false,reason:'Your class selection has changed. Reopen Class / Items.'};
   data.accounts[key]={...a,job,revision:a.revision+1};save(data);return {ok:true,profile:structuredClone(data.accounts[key])};
  },
  reset(guildId,userId,revision){const data=load(),{key,a}=account(data,guildId,userId);if(a.revision!==revision)return {ok:false,reason:'This item request has expired. Reopen Class / Items.'};if(!a.job)return {ok:false,reason:'No class is selected.'};if((a.items.class_reset||0)<1)return {ok:false,reason:'You need a Class Reset item.'};
   data.accounts[key]={...a,job:null,revision:a.revision+1,items:{...a.items,class_reset:a.items.class_reset-1}};save(data);return {ok:true,profile:structuredClone(data.accounts[key])};
  }
 };
}
module.exports={createStore,JOBS};

