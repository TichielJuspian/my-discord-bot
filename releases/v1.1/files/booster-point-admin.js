'use strict';
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits: P } = require('discord.js');
const benefits = require('./booster-point-benefits');
const { ATTACK_PERCENT_PER_STACK } = require('./raid-booster');
function commands() {
  const command = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description)
    .setDMPermission(false).setDefaultMemberPermissions(P.Administrator)
    .addUserOption(o => o.setName('user').setDescription('Member or Discord user ID').setRequired(true));
  return [
    command('setboost', 'Set a member CURRENT TOTAL boost count - Gosu General only')
      .addIntegerOption(o => o.setName('count').setDescription('Current total, not renewals or additional boosts').setRequired(true).setMinValue(1).setMaxValue(benefits.MAX_BOOST_COUNT)),
    command('boostinfo', 'View current boost bonus and registered total - Gosu General only'),
    command('clearboost', 'Clear manual count; active boosters return to automatic 1 - Gosu General only')
  ];
}
function createBoosterAdmin({ guildId, operatorId }) {
  const names = ['setboost','boostinfo','clearboost'];
  async function handle(i) {
    if (!i.isChatInputCommand?.() || !names.includes(i.commandName)) return false;
    const noMentions = { parse: [], users: [], roles: [], repliedUser: false };
    if (i.user?.id !== operatorId || i.guildId !== guildId || i.guild?.id !== guildId) {
      await i.reply({ content: 'Only Gosu General can manage boost quantities in this server.', flags: MessageFlags.Ephemeral, allowedMentions: noMentions });
      return true;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const user = i.options.getUser('user');
      if (!user || user.bot) throw Error('Choose a human member.');
      if (i.commandName === 'boostinfo') {
        const info = await benefits.information(guildId, user.id);
        const old = info.registration && !info.registration.current ? '\nA previous activation registration is inactive and is not used.' : '';
        await i.editReply({ content: 'Member: ' + user.id + '\nServer Booster: ' + (info.active ? 'active' : 'inactive')
          + '\nRegistered total for this activation: ' + (info.registration?.current ? info.registration.count : 'none')
          + (info.active && Number.isSafeInteger(info.premiumSince) ? '\nActivation: <t:' + Math.floor(info.premiumSince / 1000) + ':f>' : '')
          + '\nEffective current count: **' + info.effectiveCount + '** (+'
          + (ATTACK_PERCENT_PER_STACK * info.effectiveCount) + '% raid ATK; +' + (5 * info.effectiveCount) + '% attendance/media/level/raid points).\n' + (info.active ? (info.source === 'manual' ? 'Administrator-registered current total.' : 'Automatic one-boost default.') : 'Not currently boosting: no future bonus.') + old
          + '\nDiscord does not reveal individual quantities. Correct partial decreases manually.', allowedMentions: noMentions });
      } else {
        const action = i.commandName === 'setboost' ? 'set' : 'clear';
        const result = await benefits.change({ guildId, actorId: i.user.id, userId: user.id,
          count: action === 'set' ? i.options.getInteger('count') : null, action, interactionId: i.id });
        await i.editReply({ content: (result.applied ? 'Saved' : 'Already processed; no duplicate change') + ': ' + user.id
          + (action === 'set' ? ' current total **' + result.event.count + '** (+'
          + (ATTACK_PERCENT_PER_STACK * result.event.count) + '% raid ATK; +' + 5 * result.event.count + '% attendance/media/level/raid points).' : ' manual registration cleared. An active booster uses automatic 1 (+' + ATTACK_PERCENT_PER_STACK + '% ATK, +5% points); an inactive member uses 0.')
          + '\nApplies to future rewards and the next battle action; previous damage and paid rewards stay unchanged. Renewals are not additional counts; a new activation starts at 1.'
          + '\nReference: ' + result.event._id, allowedMentions: noMentions });
      }
    } catch (e) {
      console.error('[BOOST ADMIN]', e.code || e.name);
      const message = typeof e.code === 'string' && e.code.startsWith('BOOST_') ? e.message
        : 'Could not confirm boost registration. Check /boostinfo before repeating a change.';
      await i.editReply({ content: message, allowedMentions: noMentions }).catch(() => {});
    }
    return true;
  }
  return { commands: commands(), handle };
}
module.exports = { commands, createBoosterAdmin };
