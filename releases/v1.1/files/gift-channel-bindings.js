// Reuse configured IDs even when the owner moves or renames channels (including Archives under Log).
async function bindGiftChannels({guild,db,config,gifts}) {
  const saved=await db.collection('gift_settings').findOne({_id:guild.id})||{};
  for(const key of ['roleId','panelChannelId','reviewChannelId','ticketCategoryId'])if(saved[key])config[key]=saved[key];
  const role=await guild.roles.fetch(config.roleId);
  if(!role?.managed)throw new Error('The configured YouTube-managed VVIP role is missing.');
  const channels=await guild.channels.fetch();
  const panel=await guild.channels.fetch(config.panelChannelId).catch(()=>null);
  const review=(await guild.channels.fetch(config.reviewChannelId).catch(()=>null))||channels.find(c=>c.type===0&&c.topic===`vvip-archive:${guild.id}`);
  if(!panel?.isTextBased()||!review?.isTextBased())throw new Error('Configured VVIP channels are missing. Owner channel arrangement is preserved.');
  if(!gifts.validateReview(review))throw new Error('Ticket archive privacy could not be validated. Channel permissions were not changed.');
  config.reviewChannelId=review.id;
  if(!config.ticketCategoryId){const notices=channels.filter(c=>c.type===4&&/notice/i.test(c.name));if(notices.size===1)config.ticketCategoryId=notices.first().id;}
  const category=config.ticketCategoryId?await guild.channels.fetch(config.ticketCategoryId).catch(()=>null):null;
  if(!category||category.type!==4||!/notice/i.test(category.name||''))throw new Error('Notice ticket category is missing or ambiguous. Private ticket creation remains blocked.');
  return {panel,review};
}
module.exports={bindGiftChannels};
