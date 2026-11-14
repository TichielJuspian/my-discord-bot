'use strict';
// Share the battle renderer's single bounded child process. A separate worker
// thread shared the bot's native allocator and retained its high-water memory.
const renderer=require('./raid-render-worker');
const INPUT=['mode','id','account','level','name','booster','draft','view','pending','inventoryFilter','inventoryPage','enhancementResult','potionResult','notice','mediaPool','guidePage','guideIndex','pointsBalance'];
async function render(s){
 const state={};for(const key of INPUT)if(s[key]!==undefined)state[key]=s[key];
 if(s.entry)state.entry={duringBattle:!!s.entry.duringBattle};
 const result=await renderer.renderWorkshop(state);
 for(const file of result.body.files||[])if(!Buffer.isBuffer(file.attachment))file.attachment=Buffer.from(file.attachment.buffer,file.attachment.byteOffset,file.attachment.byteLength);
 for(const key of ['pendingMedia','guideIndex','guideTotal','inventoryPage'])if(result[key]!==undefined)s[key]=result[key];
 s.renderCache=result.cache;
 return result.body;
}
module.exports={render,close:()=>renderer.close()};
