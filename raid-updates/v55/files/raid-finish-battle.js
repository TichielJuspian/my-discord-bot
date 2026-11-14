'use strict';
async function finishBattle(i,active,refresh){
 if(active.finishPromise)return active.finishPromise;
 active.finished=true;
 active.finishPromise=(async()=>{
  const close=async()=>{try{await i.deleteReply();}catch(e){if(e?.code!==10008)await i.editReply({flags:32768,components:[{type:10,content:`Battle ended. Total damage: **${active.state.totals.damage}**.`}],attachments:[],allowedMentions:{parse:[]}});}};
  const {bounded}=require('./raid-async');
  const results=await Promise.allSettled([bounded(close),refresh?bounded(refresh):Promise.resolve()]);
  for(let n=0;n<results.length;n++)if(results[n].status==='rejected')console.error(n?'[RAID FINAL SCORE DISPLAY]':'[RAID FINAL CLOSE]',results[n].reason?.code||results[n].reason?.name);
  return results;
 })();
 return active.finishPromise;
}
module.exports={finishBattle};
