'use strict';
const panels=require('./raid-panels');
const cache=new Map(),FIELDS=['staticCardCache','feedCache','metalBoss','visibleEffects'];
const MAX_BYTES=16*1024*1024,MAX_SESSIONS=24;let bytes=0;
function drop(id){const entry=cache.get(id);if(entry){bytes-=entry.bytes;cache.delete(id);}}
function save(a){const values={},assets=new Set();let size=0;for(const k of FIELDS){if(a[k]){values[k]=a[k];const b=a[k]?.asset?.attachment;if(Buffer.isBuffer(b)&&!assets.has(b)){assets.add(b);size+=b.length;}}}drop(a.id);if(size>MAX_BYTES)return;cache.set(a.id,{values,bytes:size});bytes+=size;while(cache.size>MAX_SESSIONS||bytes>MAX_BYTES)drop(cache.keys().next().value);}
process.on('message',m=>{
 if(m.type==='release'){drop(m.sessionId);return;}
 if(m.type!=='render')return;
 try{
  if(m.mode==='workshop'){
   const s=m.active,body=require('./raid-workshop-view').payload(s);
   process.send({id:m.id,body,pendingMedia:s.pendingMedia,guideIndex:s.guideIndex,guideTotal:s.guideTotal,inventoryPage:s.inventoryPage,cache:require('./raid-workshop-cache').stats(),memory:process.memoryUsage()});return;
  }
  const a={...m.active,...(cache.get(m.active.id)?.values||{})};
  const body=panels.display(a,{},m.boss,m.phase,m.initial);save(a);
  const profile=(body.files||[]).find(f=>f.name==='challenger-current.png');
  process.send({id:m.id,body,renderedBoss:panels.bossArt(a.motionStage==='player'&&a.motionBefore?a.motionBefore:a.state)[0],renderedProfile:profile?.name,memory:process.memoryUsage(),cache:{sessions:cache.size,bytes}});
 }catch(e){process.send({id:m.id,error:{message:e.message,code:e.code}});}
});
process.on('disconnect',()=>process.exit(0));
