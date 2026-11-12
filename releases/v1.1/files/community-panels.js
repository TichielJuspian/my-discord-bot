const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DAILY_POINTS, WEEKLY_BONUS, MONTHLY_BONUS, MEDIA_POINTS } = require('./points-store');
const action = (id, label, primary = false) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(primary ? ButtonStyle.Primary : ButtonStyle.Secondary);
const link = (guild, id, label) => new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild}/${id}`);
function showcasePanel(guild, r) {
  return {
    embeds: [new EmbedBuilder().setColor(0xa78bfa).setTitle('Your style. Your story. ✨').setDescription(`Show off your look and see how the community is growing. 💙\n\n**Show my profile** — share your styled card here for everyone to see.\n**My rank** — show your level and server rank.\n**Leaderboard** — see the community’s top 50.\n\nTo change your look, use **My collection** in <#${r.shop}>. Purchases and outfit changes stay private; shared cards here are public.\n\nPrefer commands? **/profile**, **/rank**, **/leaderboard** work here. Add a member to /profile or /rank to view their card.`)],
    components: [new ActionRowBuilder().addComponents(action('points:profile', 'Show my profile ✨', true), action('community:rank', 'My rank'), action('community:leaderboard', 'Leaderboard'), link(guild, r.shop, 'Visit the shop'))], allowedMentions: { parse: [] },
  };
}
function guidePanel(guild, r) {
  return {
    embeds: [new EmbedBuilder().setColor(0x38bdf8).setTitle('Start here · Your community bot 💙').setDescription('No commands to memorize. Open a channel below and use its buttons!')
      .addFields(
        { name: '1 · Shop points & attendance', value: `<#${r.daily}>\n**${DAILY_POINTS} points daily** · every 7-day streak **+${WEEKLY_BONUS}** · every 30-day streak **+${MONTHLY_BONUS}**. Resets at midnight Pacific Time.\nSend **daily** in this channel to check in. Only the exact command counts; ordinary chat, stickers and attachments do not trigger check-in. Your original message and the bot reply stay visible. No tag, slash command or button needed. Check your balance privately with **/points**. Shop points are separate from XP and rankings.` },
        { name: '2 · Profile shop', value: `<#${r.shop}>\nUse **/shop anywhere** for a private link. Browse **Backgrounds / Anime / Sets / Badges** with six picture previews per page. Filter anime by series or jump directly to a collection/page. Choose a picture → try it on → confirm.\nBackgrounds **1,000** · anime **4,000** · Classic sets **7,000** · Mythic **10,000** · Premium **12,000**. Sets include background + frame + glow; frames/glows are not sold individually.\n**/points** checks your balance. **My collection** equips owned pieces for free. Purchases and previews stay private.` },
        { name: '3 · Public profiles & XP rankings', value: `${(r.publicCardChannels || [r.showcase]).map(id => `<#${id}>`).join(' · ')}\nUse **/profile [user]**, **/rank [user]**, **/leaderboard** in these main chats (top 50, ten per page). They also work in **mods-stream-only**, **mods-discord-only** and **mods-test-bot-commands** whenever the bot is online.\nXP/level ranking is not a shop-point leaderboard. Spending points never lowers your level.` },
        { name: '4 · VVIP skin requests', value: `<#${r.gift}>\nConnect your active YouTube VVIP membership in Discord Connections. Click **Open my skin ticket** there. Your ticket is visible to you, Gosu General and moderators. Delivery is manual; completed tickets close immediately after the private archive is verified; if archiving fails, they remain open. Requests have a 30-day cooldown per Discord account, starting at submission; unused picks do not stack.` },
        { name: '5 · Share something worth seeing', value: `**Photos/GIF files: +${MEDIA_POINTS.photo} points** with **/share file** in <#495719914875912192> or <#1441026766205489263> · one photo bonus per Pacific day.\n**Gosu General clips: +${MEDIA_POINTS.video.toLocaleString()} points** · submit with **/share file** in <#873973576758345818>. Clips stay private until a moderator approves them, then the bot posts them and awards points. One approved clip reward per Pacific day, **separate from photos**. Check **/clipstatus** for your review.\nRepeated clips earn nothing. Regular uploads, GIF-picker links, emojis and stickers are not automatically rewarded. Points and XP are separate.` },
      ).setFooter({ text: 'Use /help any time for this guide · Privacy & data requests: Discord @gosugeneral' })],
    components: [new ActionRowBuilder().addComponents(link(guild, r.daily, 'Daily check-in'), link(guild, r.shop, 'Profile shop'), link(guild, r.showcase, 'Profiles & ranks'), action('community:guide', 'My quick guide'))], allowedMentions: { parse: [] },
  };
}
module.exports = { showcasePanel, guidePanel };


