'use strict';
const noticeDelay=10_000;
function privateMessage(message){
  const f=message?.flags;return typeof f?.has==='function'?f.has(64):Number.isSafeInteger(f)&&(f&64)===64;
}
function schedule(i,message,{component=false,original}={}){
  if(!message?.id||typeof i.deleteReply!=='function')return;
  if(component){
    if(i.message?.id!==message.id||!privateMessage(i.message))return;
  }else if(!privateMessage(message)&&i.ephemeral!==true)return;
  const id=message.id;
  setTimeout(async()=>{
    const attempts=original?.id===id&&typeof original.i?.deleteReply==='function'?[()=>i.deleteReply(),()=>original.i.deleteReply()]:[()=>i.deleteReply()];
    let error;
    for(const remove of attempts){try{await remove();return;}catch(e){error=e;}}
    console.warn('[PRIVATE NOTICE CLEANUP]',error?.code||error?.name||'Error');
  },noticeDelay).unref?.();
}
function textOnly(p){
  if(typeof p==='string')return !!p.trim();
  if(!p||p.embeds?.length||p.files?.length||p.attachments?.length)return false;
  if(p.components?.length)return p.components.every(c=>c.type===10&&typeof c.content==='string'&&c.content.trim());
  return typeof p.content==='string'&&!!p.content.trim();
}
async function editNotice(i,payload,options){const message=await i.editReply(payload);if(textOnly(payload))schedule(i,message,options);return message;}
async function replyNotice(i,payload){
  const interactionResponse=await i.reply(payload);
  if(textOnly(payload)&&(Number(payload?.flags||0)&64)===64&&i.ephemeral===true&&typeof i.deleteReply==='function'){
    setTimeout(()=>void i.deleteReply().catch(error=>console.warn('[PRIVATE NOTICE CLEANUP]',error?.code||error?.name||'Error')),noticeDelay).unref?.();
  }
  return interactionResponse;
}
async function followNotice(i,payload){
  const message=await i.followUp(payload);
  if(textOnly(payload)&&privateMessage(message)&&message.id&&typeof i.deleteReply==='function')
    setTimeout(()=>void i.deleteReply(message.id).catch(error=>console.warn('[PRIVATE NOTICE CLEANUP]',error?.code||error?.name||'Error')),noticeDelay).unref?.();
  return message;
}
module.exports={editNotice,replyNotice,followNotice};
