const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { redirectIfNeeded, channelRoutes } = require('./community-navigation');
const { guidePanel } = require('./community-panels');
const cards = require('./community-cards');
const { itemById } = require('./points-store');
const {collectorStatus}=require('./collector');
async function profilePayload(user, data, wallet, rank) {
  const theme = itemById(wallet.theme), badge = itemById(wallet.badge);
  const collector = collectorStatus(wallet);
  const png = await cards.renderProfileAsync({ name: user.globalName || user.username, avatarData: await cards.avatarData(user), data, wallet, rank, themeId: wallet.theme, badgeId: wallet.badge });
  return { embeds: [new EmbedBuilder().setColor(theme?.color || 0x57bfff).setDescription(`**${theme?.name || 'Community Blue'}**${badge ? ` · ${badge.name}` : ''} · Lv ${data?.level || 0}${rank ? ` · #${rank}` : ''}\nCollector · **${collector.tier?.name || 'No tier yet'}** · **${collector.completedSets} complete sets** · **${collector.count} items**`).setImage('attachment://community-profile.png')], files: [new AttachmentBuilder(png, { name: 'community-profile.png', description: `${user.username}: level ${data?.level || 0}, rank ${rank || 'unranked'}, ${data?.xp || 0} XP, ${wallet.balance || 0} points; collector ${collector.tier?.name || 'unranked'}, ${collector.completedSets} complete sets, ${collector.count} items.` })], allowedMentions: { parse: [] } };
}
function createCommunityViews({ client }) {
  let xp, wallets;
  const commands = [new SlashCommandBuilder().setName('leaderboard').setDescription('View the top 50 XP members, ten per page').addIntegerOption(o=>o.setName('page').setDescription('Page 1–5').setMinValue(1).setMaxValue(5)), new SlashCommandBuilder().setName('help').setDescription('Find bot buttons, channels and commands')].map(c => c.setDMPermission(false));
  async function init(db) { xp = db.collection('user_xp'); wallets = db.collection('community_points'); }
  async function handle(i) {
    const chat = i.isChatInputCommand();
    if (!(chat ? commands.some(c => c.name === i.commandName) : ['community:rank', 'community:leaderboard', 'community:guide'].includes(i.customId)||i.customId?.startsWith('community:leaderboard:'))) return false;
    const action = chat ? i.commandName : i.customId === 'community:guide' ? 'help' : i.customId.split(':')[1];
    if (action === 'help') {
      const r = channelRoutes(i.guildId);
      await i.reply({ ...(r ? guidePanel(i.guildId, r) : { content: 'The community guide is warming up. Please try again shortly.' }), flags: MessageFlags.Ephemeral });
      return true;
    }
    if (await redirectIfNeeded(i, action)) return true;
    if(!chat&&i.customId?.startsWith('community:leaderboard:')&&i.customId.split(':')[2]!==i.user.id) {await i.reply({content:'Use /leaderboard to open your own page controls.',flags:MessageFlags.Ephemeral});return true;}
    const paging=!chat&&i.customId?.startsWith('community:leaderboard:');
    if(paging)await i.deferUpdate();else await i.deferReply();
    try {
      if (!xp || !i.guildId) throw new Error('Community cards are warming up. Please try again shortly.');
      if (action === 'rank') {
        const user = (chat ? i.options.getUser('user') : null) || i.user;
        if (user.bot) throw new Error('Community cards are for people. 💙');
        const data = await xp.findOne({ guildId: i.guildId, userId: user.id });
        const rank = data ? await xp.countDocuments({ guildId: i.guildId, xp: { $gt: data.xp } }) + 1 : null;
        const wallet = await wallets.findOne({ _id: `${i.guildId}_${user.id}` }) || {};
        await i.editReply(await profilePayload(user, data, wallet, rank));
      } else {
        const top = await xp.find({ guildId: i.guildId }).sort({ xp: -1, userId: 1 }).limit(50).toArray();
        const page=Math.max(1,Math.min(Math.max(1,Math.ceil(top.length/10)),Number(chat?i.options.getInteger?.('page')||1:i.customId?.split(':')[3]||1)));
        const current=top.slice((page-1)*10,page*10);
        const entries = [];
        for (let offset = 0; offset < current.length; offset += 3) entries.push(...await Promise.all(current.slice(offset, offset + 3).map(async record => {
          const user = await client.users.fetch(record.userId).catch(() => null);
          return { ...record, rank: 1 + top.filter(r => r.xp > record.xp).length, name: user?.globalName || user?.username || `Member …${String(record.userId).slice(-4)}`, avatarData: user ? await cards.avatarData(user) : null };
        })));
        const viewer = await xp.findOne({ guildId: i.guildId, userId: i.user.id });
        const viewerRank = viewer ? 1 + await xp.countDocuments({ guildId: i.guildId, xp: { $gt: viewer.xp } }) : null;
        const image = await cards.renderAsync(cards.leaderboardSvg({ entries, viewerId: i.user.id, viewerRank, viewerXp: viewer?.xp || 0 }));
        const description = entries.length ? entries.map(e => `**#${e.rank}** ${String(e.name).replace(/[@`*_~|<>]/g, '')} · Lv ${e.level || 0} · ${e.xp.toLocaleString()} XP`).join('\n') : 'No activity records yet. Your story starts here! 💙';
        const max=Math.max(1,Math.ceil(top.length/10));
        await i.editReply({attachments:[],embeds: [new EmbedBuilder().setColor(0x57bfff).setTitle(`TOP 50 / PAGE ${page} OF ${max}`).setImage('attachment://community-leaderboard.png').setFooter({ text: 'All-time XP · Equal XP shares a rank · Shop points are separate' })], files: [new AttachmentBuilder(image, { name: 'community-leaderboard.png', description: description.slice(0, 1000) })],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`community:leaderboard:${i.user.id}:${page-1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page===1),new ButtonBuilder().setCustomId(`community:leaderboard:${i.user.id}:${page+1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page===max))], allowedMentions: { parse: [] } });
      }
    } catch (e) { console.error('[CARDS]', e.code || e.name); await i.editReply({ content: 'The card could not be loaded just now. Your level and points are safe—please try again shortly. 💙' }).catch(() => {}); }
    return true;
  }
  return { init, handle, commands };
}
module.exports = { createCommunityViews, profilePayload };

