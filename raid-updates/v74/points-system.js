const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createPointsStore, DAILY_POINTS, WEEKLY_BONUS, MONTHLY_BONUS, pacificDay, itemById } = require('./points-store');
const { profilePayload } = require('./community-views');
const { redirectIfNeeded, channelRoutes } = require('./community-navigation');
const atelier = require('./atelier-shop');
const {ownsItem,previewOutfit}=require('./profile-sets');
const row = (...items) => new ActionRowBuilder().addComponents(...items);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
function createPoints({ client, operatorId, mongo } = {}) {
  const store = createPointsStore();
  const shopWindows = require('./shop-window').createShopWindows();
  const pointSkins = mongo ? require('./point-skin-system').createPointSkins({ client, operatorId, mongo }) : null;
  const pointAdmin = mongo ? require('./point-admin').createPointAdmin({ client, operatorId, mongo }) : null;
  let xp, ready = false, noticeJobs, noticeTimer; const shopPings = new Map();
  const commands = [
    new SlashCommandBuilder().setName('daily').setDescription('Say hello and collect your daily community points'),
    new SlashCommandBuilder().setName('points').setDescription('Check your points and attendance'),
    new SlashCommandBuilder().setName('shop').setDescription('Explore profile badges and card themes'),
    new SlashCommandBuilder().setName('profile').setDescription('Show your community profile').addUserOption(o => o.setName('user').setDescription('Member to view')),
  ].map(c => c.setDMPermission(false));
  async function cleanupNotices() {
    // Keep active/future cooldowns; the existing notice sweeper also retires
    // expired keys without adding another timer or changing the 60s boundary.
    const now = Date.now();
    for (const [key, sentAt] of shopPings) if (now - sentAt > 60000) shopPings.delete(key);
    if (!client || !noticeJobs) return;
    for (const job of await noticeJobs.find({ deleteAt: { $lte: new Date() } }).limit(50).toArray()) {
      try {
        const ch = await client.channels.fetch(job.channelId), m = await ch.messages.fetch(job._id);
        await m.delete(); await noticeJobs.deleteOne({ _id: job._id });
      } catch (e) { if ([10003, 10008].includes(e.code)) await noticeJobs.deleteOne({ _id: job._id }); }
    }
  }
  async function init(db) {
    await store.init(db); xp = db.collection('user_xp'); ready = true;
    if (pointSkins) await pointSkins.init(db);
    if (pointAdmin) await pointAdmin.init(db);
    noticeJobs = db.collection('community_shop_notices');
    if (client) {
      console.log('[SHOP] Private window reuse, Back and Close enabled; window and renderer idle timeout 20s.');
      setImmediate(() => atelier.warmPopularPages().catch(e => console.error('[SHOP WARMUP]',e.code||e.name)));
      await cleanupNotices();
      if (!noticeTimer) { noticeTimer = setInterval(() => cleanupNotices().catch(() => {}), 60000); noticeTimer.unref(); }
    }
  }
  const home = () => ({
    embeds: [new EmbedBuilder().setColor(0x38bdf8).setTitle('A little hello, a little sparkle ✨')
      .setDescription(`One little hello, every day. 💙\n\nSend **daily** in this channel for **${DAILY_POINTS} points**. No tag, slash command or button needed!\nYour own message stays in the chat, and I'll reply underneath.\n**Every 7-day streak: +${WEEKLY_BONUS}** · **Every 30-day streak: +${MONTHLY_BONUS}**\n\n• Only **daily** counts as check-in. Ordinary chat, stickers and attachments do not trigger a reply. Extra daily commands do not earn more points.\n• Only this daily channel counts.\n• Resets at **midnight Pacific Time** (California, PST/PDT).\n• A missed day resets only your streak. Points and items stay yours.\n\nYour balance stays private in **/points**. **Shop points are separate from XP and level rankings.**`)],
    components: [], allowedMentions: { parse: [] },
  });
  const shopHome = atelier.shopHome;
  const summary = w => {
    const gap = w.lastDay ? (Date.parse(`${pacificDay()}T00:00:00Z`) - Date.parse(`${w.lastDay}T00:00:00Z`)) / 86400000 : Infinity;
    const streak = gap > 1 ? 0 : w.streak;
    return new EmbedBuilder().setColor(0x38bdf8).setTitle('Your little corner of the community 💙')
      .addFields({ name: 'Points', value: `${w.balance.toLocaleString()} ✦`, inline: true }, { name: 'Check-ins', value: `${w.visits}`, inline: true }, { name: 'Current streak', value: `${streak} day${streak === 1 ? '' : 's'}${gap === 1 ? ' · check in to continue' : ''}`, inline: true })
      .setFooter({ text: `Daily +${DAILY_POINTS} · Resets at midnight Pacific Time · Points never reduce your XP` });
  };
  const shop = (i, type, page, owned,filter) => atelier.shop(store, i, type, page, owned,filter);
  async function profile(i, user) {
    if (user.bot) throw new Error('Community profiles are for people. 💙');
    const [w, level] = await Promise.all([store.wallet(i.guildId, user.id), xp.findOne({ guildId: i.guildId, userId: user.id })]);
    const rank = level ? 1 + await xp.countDocuments({ guildId: i.guildId, xp: { $gt: level.xp } }) : null;
    const card = await profilePayload(user, level, w, rank);
    return { ...card, content: '', components: [] };
  }
  async function handle(i) {
    if (pointAdmin && await pointAdmin.handle(i)) return true;
    if (pointSkins && await pointSkins.handle(i)) return true;
    const chat = i.isChatInputCommand();
    if (!(chat ? commands.some(c => c.name === i.commandName) : i.customId?.startsWith('points:'))) return false;
    let windowReply, reply = i;
    try {
      if (!i.guildId || i.user.bot) throw new Error('Use this in the community server.');
      const bits = i.customId?.split(':') || [];
      if (bits[2] && bits[2] !== i.user.id) throw new Error('Open your own profile or shop to use this control.');
      const action = chat ? i.commandName : bits[1];
      const shopAction = ['home','tab','page','ownedtab','ownedpage','reset','filter','jump'].includes(action) || action.startsWith('open_');
      if (await redirectIfNeeded(i, action === 'wardrobe' ? 'equip' : shopAction ? 'preview' : action)) return true;
      const publicProfile = chat ? i.commandName === 'profile' : bits[1] === 'profile';
      if (action === 'close') { await shopWindows.close(i); return true; }
      const managed = !publicProfile && (shopAction || ['category','wardrobe','balance','preview','buy','equip','wear','mlbb'].includes(action) || (action === 'shop' && (!channelRoutes(i.guildId) || i.channelId === channelRoutes(i.guildId).shop)));
      const updatePrivate=!chat&&!publicProfile&&i.message?.flags?.has(MessageFlags.Ephemeral)&&i.deferUpdate;
      if (managed) { windowReply = await shopWindows.begin(i); if (!windowReply) return true; reply = windowReply; }
      else if(updatePrivate)await i.deferUpdate();else await i.deferReply(publicProfile ? {} : { flags: MessageFlags.Ephemeral });
      if (!ready) throw new Error('The points desk is warming up. Try again shortly.');
      if (action === 'mlbb') {
        if(i.user.id!==operatorId)throw new Error('These anime sets are currently in owner preview.');
        const w=await store.wallet(i.guildId,i.user.id),level=await xp.findOne({guildId:i.guildId,userId:i.user.id});
        const rank=level?1+await xp.countDocuments({guildId:i.guildId,xp:{$gt:level.xp}}):null;
        await reply.editReply(await require('./mlbb-set-preview').mlbbSetPreview({user:i.user,data:level,wallet:w,rank,hero:i.values?.[0]||'luffy'}));
      } else if (action === 'daily') {
        const result = await store.checkIn(i.guildId, i.user.id);
        await reply.editReply({ content: result.credited ? `Good to see you! **+${result.reward.total} points** are yours. 💙${result.reward.weekly ? `\n7-day streak bonus: +${WEEKLY_BONUS}!` : ''}${result.reward.monthly ? `\n30-day streak bonus: +${MONTHLY_BONUS}!` : ''}` : 'You’re already checked in for today! Come back after midnight Pacific Time. 💙', embeds: [summary(result.wallet)], allowedMentions: { parse: [] } });
        if(result.credited) {
          try {
            await i.followUp({content:`☀️ <@${i.user.id}> checked in! **+${result.reward.total.toLocaleString()} points** 💙\n🔥 **${result.wallet.streak}-day streak** · ✅ **${result.wallet.visits.toLocaleString()} total check-ins**${result.reward.weekly?`\n🎉 7-day streak bonus: **+${WEEKLY_BONUS}**!`:''}${result.reward.monthly?`\n🎉 30-day streak bonus: **+${MONTHLY_BONUS}**!`:''}`,flags:0,allowedMentions:{parse:[]}});
          } catch(e) {console.error('[DAILY PUBLIC]',e.code||e.name);throw new Error('Your check-in and points are saved, but the public message could not be posted. Please let Gosu General know.');}
        }
      } else if (action === 'points' || action === 'balance') {
        await reply.editReply({ embeds: [summary(await store.wallet(i.guildId, i.user.id))] });
      } else if (action === 'shop') {
        const r = channelRoutes(i.guildId);
        if (r && i.channelId !== r.shop) {
          await reply.editReply({ content: `Your shopping window is ready in <#${r.shop}>. 💙\nTap below to open the shop. Your balance and purchases stay private.`, components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Profile Shop 🛍️').setURL(`https://discord.com/channels/${i.guildId}/${r.shop}`))], allowedMentions: { parse: [] } });
          const key = `${i.guildId}_${i.user.id}`;
          if (Date.now() - (shopPings.get(key) || 0) > 60000 && i.guild?.channels?.fetch) {
            shopPings.set(key, Date.now());
            const ch = await i.guild.channels.fetch(r.shop);
            const notice = await ch.send({ content: `<@${i.user.id}> your shop is ready! Use **/shop** here, or **Browse & try on** above. 💙`, allowedMentions: { parse: [], users: [i.user.id] } });
            try { await noticeJobs.insertOne({ _id: notice.id, channelId: ch.id, deleteAt: new Date(Date.now() + 30000) }); }
            catch (e) { await notice.delete().catch(() => {}); throw e; }
            setTimeout(() => cleanupNotices().catch(() => {}), 31000).unref();
          }
        } else await reply.editReply(await shop(i));
      }
      else if (action === 'home') await reply.editReply(atelier.shopHome());
      else if (action === 'category') await reply.editReply(await shop(i, i.values?.[0]));
      else if (action.startsWith('open_')) await reply.editReply(await shop(i, action.slice(5)));
      else if (['tab','page','ownedtab','ownedpage'].includes(action)) await reply.editReply(await shop(i, bits[3], bits[4], action.startsWith('owned'),bits[5]));
      else if (action === 'filter') await reply.editReply(await shop(i,bits[3],0,false,i.values?.[0]||'all'));
      else if (action === 'jump') await reply.editReply(await shop(i,bits[3],i.values?.[0],bits[5]==='owned',bits[4]));
      else if (action === 'profile') await reply.editReply(await profile(i, chat ? i.options.getUser('user') || i.user : i.user));
      else if (action === 'wardrobe') await reply.editReply(await shop(i, 'theme', 0, true));
      else if (action === 'reset') { await store.equip(i.guildId,i.user.id,bits[3],'default'); await reply.editReply(await profile(i,i.user)); }
      else if (action === 'preview') {
        const item = itemById(i.values?.[0]);
        if (!item) throw new Error('Open the shop again to choose an item.');
        if(item.saleable===false&&!ownsItem(await store.wallet(i.guildId,i.user.id),item))throw new Error('This piece is available through complete sets only. Open the updated shop.');
        const [w, level] = await Promise.all([store.wallet(i.guildId, i.user.id), xp.findOne({ guildId: i.guildId, userId: i.user.id })]);
        const owned = ownsItem(w,item);
        const rank = level ? 1 + await xp.countDocuments({ guildId: i.guildId, xp: { $gt: level.xp } }) : null;
        const preview = await profilePayload(i.user, level, previewOutfit(w,item), rank);
        await reply.editReply({ attachments: [], embeds: [new EmbedBuilder().setColor(item.color || 0xd4af37).setTitle(item.name)
          .setDescription(`${item.type.toUpperCase()} · **Try-on preview**${item.type==='set'?'\nIncludes the matching background, frame and glow. All three unlock and equip together. Badges are separate.':''}\n\n**${item.price.toLocaleString()} points** · Your balance: **${w.balance.toLocaleString()}**${!owned && w.balance < item.price ? `\n${(item.price - w.balance).toLocaleString()} more points to go · up to ${Math.ceil((item.price - w.balance) / DAILY_POINTS)} daily check-ins (streak bonuses help)` : ''}\n${owned ? 'Already yours! Equip it whenever you like.' : 'Your current look stays unchanged until you confirm. Buy once, keep forever.'}\n\nNo points have been spent for this preview.`).setImage('attachment://community-profile.png')], files: preview.files,
          allowedMentions: { parse: [] },
          components: [row(button(`points:${owned ? 'wear' : 'buy'}:${i.user.id}:${item.id}${owned?'':`:${item.price}`}`, owned ? 'Equip · free' : `Buy · ${item.price.toLocaleString()} points`, ButtonStyle.Primary), button(bits[3]?`points:${bits[6]==='owned'?'ownedpage':'page'}:${i.user.id}:${bits[3]}:${bits[4]||0}:${bits[5]||'all'}`:'points:shop', 'Back to pictures'))] });
      } else if (action === 'buy') {
        if(Number(bits[4])!==itemById(bits[3])?.price)throw new Error('The shop has been updated. Open a fresh preview to see and confirm the current price. No points were spent.');
        const result = await store.buy(i.guildId, i.user.id, bits[3]);
        await reply.editReply({ content: result.purchased ? `**${result.item.name}** is yours and equipped! You have **${result.wallet.balance} points** left. Use /profile to show your look.` : 'You already own this item. No more points were spent. Equip it from My collection.',embeds:[],attachments:[],components:[row(button('points:shop','Browse'),button('points:wardrobe','My collection'))], allowedMentions: { parse: [] } });
      } else if (action === 'equip' || action === 'wear') {
        const item = action === 'wear' ? itemById(bits[3]) : null;
        await store.equip(i.guildId, i.user.id, item?.type || bits[3], item?.id || i.values?.[0]);
        await reply.editReply({...await profile(i, i.user),attachments:[],components:[row(button('points:wardrobe','My collection'),button('points:shop','Browse'))]});
      } else throw new Error('Open /shop or /profile again for the latest controls.');
    } catch (e) {
      console.error('[POINTS]', e.code || e.name);
      const content = e.name?.startsWith('Mongo') ? 'We could not confirm the update. Check /points and /profile before trying again; an item can only be purchased once.' : e.message;
      const payload = { content, allowedMentions: { parse: [] } };
      if (windowReply || i.deferred || i.replied) await reply.editReply(payload).catch(() => {});
      else await i.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    } finally { windowReply?.release(); }
    return true;
  }
  const handleMessage = require('./daily-message').createDailyMessageHandler({
    checkIn: async (...args) => {
      if (!ready) throw new Error('The points desk is warming up.');
      return store.checkIn(...args);
    },
    channelRoutes,
  });
  return { init, handle, handleMessage, get commands() { return [...commands.filter(c => c.name !== 'daily'), ...(pointAdmin?.commands || [])]; }, home, shopHome };
}
module.exports = { createPoints };



