'use strict';
// Native image/font allocations live in one recyclable child, never in gameplay state.
const {fork}=require('node:child_process'),path=require('node:path');
const INPUT=['id','state','playerName','view','booster','busy','cutsceneResult','motionStage','motionBefore','offerScene','guidePage','inventoryPage','inventoryItems','workshopAccount'];
function createRenderer({childFile=path.join(__dirname,'raid-render-child.js'),idleMs=30000,timeoutMs=30000,maxRSS=160*1024*1024,maxJobs=32,maxQueued=128,maxQueueBytes=16*1024*1024}={}){
 let child=null,pending=null,sequence=0,uses=0,idle=null,chain=Promise.resolve(),retiring=Promise.resolve(),queueBytes=0,lastMemory=null,lastCache=null;const jobs=new Set();
 const error=(message,code)=>Object.assign(Error(message),{code});
 function stop(w=child){if(!w)return;if(child===w){clearTimeout(idle);idle=null;child=null;uses=0;}if(pending?.child===w){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error('Battle renderer stopped','RAID_RENDER_EXIT'));}if(w.exitCode!==null||w.signalCode!==null||w.raidRetiring)return;w.raidRetiring=true;
  w.ref();const exited=new Promise(resolve=>{let force;const done=()=>{clearTimeout(force);resolve();};w.once('exit',done);w.once('close',done);force=setTimeout(()=>{try{w.kill('SIGKILL');}catch{}},1000);force.unref?.();});retiring=Promise.all([retiring,exited]).then(()=>{});try{w.kill();}catch{}
 }
 function start(){const w=child=fork(childFile,[],{execPath:process.execPath,execArgv:[],serialization:'advanced',stdio:['ignore','ignore','inherit','ipc'],windowsHide:true,shell:false});uses=0;
  w.on('message',m=>{const p=pending;if(!p||p.child!==w||p.id!==m.id)return;pending=null;clearTimeout(p.timer);if(m.error){p.reject(error(m.error.message,m.error.code||'RAID_RENDER_FAILED'));stop(w);}else p.resolve(m);});
  w.on('error',()=>stop(w));w.on('exit',()=>stop(w));w.unref();w.channel?.unref();return w;
 }
 async function run(job){await retiring;if(job.cancelled)throw error('Battle render cancelled','RAID_RENDER_CANCELLED');clearTimeout(idle);const w=child||start();w.ref();w.channel?.ref();
  try{const m=await new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{if(pending?.id===id){pending=null;reject(error('Battle renderer timed out','RAID_RENDER_TIMEOUT'));stop(w);}},timeoutMs);pending={id,child:w,resolve,reject,timer};w.send({type:'render',mode:job.mode,id,active:job.input,boss:job.boss,phase:job.phase,initial:job.initial},e=>{if(e&&pending?.id===id){pending=null;clearTimeout(timer);reject(error('Battle renderer disconnected','RAID_RENDER_EXIT'));stop(w);}});});
   uses++;lastMemory=m.memory;lastCache=m.cache;if(job.cancelled)throw error('Battle render cancelled','RAID_RENDER_CANCELLED');
   if(job.mode==='workshop')return m;
   job.active.renderedBoss=m.renderedBoss;if(m.renderedProfile)job.active.renderedProfile=m.renderedProfile;return m.body;
  }finally{if(!w.raidRetiring){w.unref();w.channel?.unref();}if(child===w){if(uses>=maxJobs||(lastMemory?.rss||0)>=maxRSS)stop(w);else{idle=setTimeout(()=>stop(w),idleMs);idle.unref?.();}}}
 }
 function enqueue(active,input,mode,boss,phase,initial=false){if(jobs.size>=maxQueued)return Promise.reject(error('Battle renderer queue is full','RAID_RENDER_BUSY'));const size=Buffer.byteLength(JSON.stringify(input));if(queueBytes+size>maxQueueBytes)return Promise.reject(error('Battle renderer queue byte budget exceeded','RAID_RENDER_BUSY'));const job={active,input:structuredClone(input),mode,boss,phase,initial,cancelled:false,size};jobs.add(job);queueBytes+=size;const result=chain.then(()=>run(job));chain=result.catch(()=>{});return result.finally(()=>{jobs.delete(job);queueBytes-=size;});}
 return {
  render(active,boss,phase,initial=false){const input={};for(const k of INPUT)if(active[k]!==undefined)input[k]=active[k];return enqueue(active,input,'battle',boss,phase,initial);},
  renderWorkshop(state){return enqueue(null,state,'workshop');},
  release(sessionId){for(const j of jobs)if(j.input.id===sessionId)j.cancelled=true;if(child?.connected)child.send({type:'release',sessionId},()=>{});},
  async close(){for(const j of jobs)j.cancelled=true;stop();await chain;await retiring;clearTimeout(idle);},
  stats(){return {pid:child?.pid||null,queued:jobs.size,queueBytes,uses,memory:lastMemory,cache:lastCache};}
 };
}
let shared;const current=()=>shared||(shared=createRenderer());
module.exports={createRenderer,render:(...args)=>current().render(...args),renderWorkshop:s=>current().renderWorkshop(s),release:id=>shared?.release(id),close:()=>shared?.close(),stats:()=>shared?.stats()};
