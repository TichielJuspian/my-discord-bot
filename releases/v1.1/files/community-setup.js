const { configureChannels } = require('./community-navigation');
const { showcasePanel, guidePanel } = require('./community-panels');
async function setupCommunity({ guild, client, db, points, categoryId, giftChannelId }) {
  const settings = db.collection('community_point_settings');
  let saved = await settings.findOne({ _id: guild.id }) || {};
  // Reuse the public card history as the showcase; never delete member messages.
  if (!saved.layoutVersion && saved.shopChannelId) {
    await settings.updateOne({ _id: guild.id }, { $set: { layoutVersion: 2, showcaseChannelId: saved.shopChannelId, showcaseMessageId: saved.shopMessageId || null, shopChannelId: null, shopMessageId: null } });
    saved = await settings.findOne({ _id: guild.id });
  }
  if (!saved.dailyArchiveChannelId && saved.channelId) {
    const oldDaily = await guild.channels.fetch(saved.channelId).catch(() => null);
    if (oldDaily) {
      await settings.updateOne({ _id: guild.id }, { $set: { dailyArchiveChannelId: oldDaily.id, dailyArchiveMessageId: saved.messageId || null, dailyDisplayName: oldDaily.name, dailyParentId: oldDaily.parentId || categoryId, dailyPosition: oldDaily.rawPosition || 0, channelId: null, messageId: null } });
      saved = await settings.findOne({ _id: guild.id });
    }
  }
  if (saved.dailyArchiveChannelId) {
    const archive = await guild.channels.fetch(saved.dailyArchiveChannelId).catch(() => null);
    if (archive && archive.name !== '📚│bot-history') await archive.setName('📚│bot-history');
  }
  async function channel(field, name, topic, reuseId) {
    let ch = saved[field] || reuseId ? await guild.channels.fetch(saved[field] || reuseId).catch(() => null) : null;
    if (!ch) ch = guild.channels.cache.find(c => c.type === 0 && c.name === name);
    if (!ch) ch = await guild.channels.create({ name, type: 0, parent: field === 'channelId' ? saved.dailyParentId || categoryId : categoryId, ...(field === 'channelId' ? { position: saved.dailyPosition || 0 } : {}), topic, permissionOverwrites: [
      { id: guild.id, type: 0, allow: ['ViewChannel', 'ReadMessageHistory', 'UseApplicationCommands'], deny: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads'] },
      { id: client.user.id, type: 1, allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'EmbedLinks', 'AttachFiles'] },
    ] });
    await settings.updateOne({ _id: guild.id }, { $set: { [field]: ch.id } }, { upsert: true });
    if (ch.topic !== topic) await ch.setTopic(topic);
    // Retain existing viewing restrictions and placement chosen by the server owner.
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false, UseApplicationCommands: true });
    for (const overwrite of ch.permissionOverwrites.cache.values()) {
      if (overwrite.id !== client.user.id && overwrite.id !== guild.id) await ch.permissionOverwrites.edit(overwrite.id, { SendMessages: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false });
    }
    await ch.permissionOverwrites.edit(client.user.id, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true, EmbedLinks: true, AttachFiles: true });
    return ch;
  }
  const daily = await channel('channelId', saved.dailyDisplayName || '✨│daily-check-in', 'Daily check-in only · 50 points once a day · Resets at midnight Pacific Time · Your confirmation is private.');
  const showcase = await channel('showcaseChannelId', '🎨│profiles-and-ranks', 'Share your bot profile and view public rankings. Use the buttons or /profile and /leaderboard.');
  if (showcase.name === '🛍️│profile-shop') await showcase.setName('🎨│profiles-and-ranks');
  const shop = await channel('shopChannelId', '🛍️│profile-shop', '32 profile designs + 3 badges · Browse, preview, buy and equip privately using the buttons. Public cards belong in profiles-and-ranks.');
  const guide = await channel('guideChannelId', '📖│bot-guide', 'Start here: daily check-in, profile shop, public cards, rankings and VVIP tickets. No commands to memorize!');
  const r = { daily: daily.id, shop: shop.id, showcase: showcase.id, guide: guide.id, gift: giftChannelId };
  configureChannels(guild.id, r);
  async function panel(ch, key, payload, marker) {
    let message = saved[key] ? await ch.messages.fetch(saved[key]).catch(() => null) : null;
    if (!message) message = (await ch.messages.fetch({ limit: 100 })).find(m => m.author.id === client.user.id && m.components.some(row => row.components.some(c => c.customId === marker)));
    message = message ? await message.edit(payload) : await ch.send(payload);
    await settings.updateOne({ _id: guild.id }, { $set: { [key]: message.id } });
  }
  await panel(daily, 'messageId', points.home(), 'points:daily');
  await panel(shop, 'shopMessageId', points.shopHome(), 'points:shop');
  await panel(showcase, 'showcaseMessageId', showcasePanel(guild.id, r), 'points:profile');
  await panel(guide, 'guideMessageId', guidePanel(guild.id, r), 'community:guide');
  await settings.updateOne({ _id: guild.id }, { $set: { layoutVersion: 2 } });
  console.log('[COMMUNITY] Check-in, private shopping, public cards and command guide ready.', JSON.stringify(r));
  return r;
}
module.exports = { setupCommunity };
