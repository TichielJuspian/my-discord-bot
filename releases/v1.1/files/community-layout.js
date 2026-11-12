const { configureChannels } = require('./community-navigation');
const { guidePanel } = require('./community-panels');
const { DAILY_POINTS } = require('./points-store');
const PUBLIC_CARDS = ['651240006811385886', '1441633537051721728', '496716663144579082'];
async function setupCommunity({ guild, client, db, points, giftChannelId }) {
  const settings = db.collection('community_point_settings');
  const saved = await settings.findOne({ _id: guild.id }) || {};
  await guild.channels.fetch();
  async function existing(id, pattern) {
    return (id ? await guild.channels.fetch(id).catch(() => null) : null) || guild.channels.cache.find(c => c.type === 0 && pattern.test(c.name));
  }
  const daily = await existing(saved.channelId, /daily.check.in/i);
  const shop = await existing(saved.shopChannelId, /profile.shop/i);
  if (!daily || !shop) throw new Error('Keep a daily-check-in and profile-shop channel. Deleted channels are not recreated automatically.');
  const guide = saved.guideChannelId ? await guild.channels.fetch(saved.guideChannelId).catch(() => null) : null;
  const r = { daily: daily.id, shop: shop.id, showcase: PUBLIC_CARDS[2], publicCardChannels: PUBLIC_CARDS, guide: guide?.id || shop.id, gift: giftChannelId };
  configureChannels(guild.id, r);
  // Channel metadata and permissions belong to the owner. Only bot-authored panels are updated.
  async function panel(ch, key, payload, marker) {
    let m = saved[key] ? await ch.messages.fetch(saved[key]).catch(() => null) : null;
    if (!m) m = (await ch.messages.fetch({ limit: 100 })).find(m => m.author.id === client.user.id && (m.components.some(row => row.components.some(c => c.customId === marker)) || m.embeds?.some(e => e.title === payload.embeds?.[0]?.data?.title)));
    m = m ? await m.edit(payload) : await ch.send(payload);
    await settings.updateOne({ _id: guild.id }, { $set: { [key]: m.id } }, { upsert: true });
  }
  await panel(daily, 'messageId', points.home(), 'points:daily');
  await panel(shop, 'shopMessageId', points.shopHome(), 'points:shop');
  if (guide) {
    await panel(guide, 'guideMessageId', guidePanel(guild.id, r), 'community:guide');
  }
  // Owner-deleted auxiliary channels stay deleted. Existing history remains intact.
  for (const [key, name] of [['showcaseChannelId', '├▸🎨ㅣprofile-history'], ['dailyArchiveChannelId', '├▸📚ㅣbot-history']]) {
    const ch = saved[key] ? await guild.channels.fetch(saved[key]).catch(() => null) : null;
    if (key === 'showcaseChannelId' && ch && saved.showcaseMessageId) {
      const m = await ch.messages.fetch(saved.showcaseMessageId).catch(() => null);
      if (m) await m.edit({ content: `Previous profile cards are preserved here. 💙\nUse **/profile** and **/leaderboard** in <#${PUBLIC_CARDS[0]}>, <#${PUBLIC_CARDS[1]}> or <#${PUBLIC_CARDS[2]}>.\nUse **/shop** anywhere for a private shopping link.`, embeds: [], components: [], allowedMentions: { parse: [] } });
    }
  }
  await settings.updateOne({ _id: guild.id }, { $set: { channelId: daily.id, shopChannelId: shop.id, layoutVersion: 3, publicCardChannels: PUBLIC_CARDS } }, { upsert: true });
  console.log('[COMMUNITY] Command-only shop and main-chat cards ready.', JSON.stringify(r));
  return r;
}
module.exports = { setupCommunity, PUBLIC_CARDS };
