'use strict';
// Only use for non-authoritative Discord reads and cleanup. A timeout does not
// cancel the request, so never retry a send or a gameplay mutation with this.
function bounded(work,ms=5000){
 let timer;
 return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('Discord cleanup timed out');error.code='RAID_IO_TIMEOUT';reject(error);},ms);timer.unref?.();})]).finally(()=>clearTimeout(timer));
}
module.exports={bounded};
