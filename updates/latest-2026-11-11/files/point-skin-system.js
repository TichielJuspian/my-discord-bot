'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { randomUUID } = require('node:crypto');
const { PRICE, MAX_DIAMONDS, PRODUCT_VERSION, createSkinStore } = require('./point-skin-store');
const PREFIX = 'points:skin:';
const formatPoints = value => value.toLocaleString('en-US');
const row = (...items) => new ActionRowBuilder().addComponents(...items);
const safe = value => String(value ?? '').replace(/@/g, '＠').replace(/[`*_~|<>]/g, '').slice(0, 1000);
const button = (action, uid, id, revision, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId([PREFIX.slice(0, -1), action, uid, id, revision].filter(v => v !== undefined).join(':')).setLabel(label).setStyle(style);
const statusName = { purchased: 'Ticket ready · fill in your request', submitted: 'Waiting for Gosu General', changes: 'Correction requested', fulfilled: 'Delivered', refunded: 'Cancelled · points refunded' };
function privateTicket(channel, userId, operatorId, botId) {
  if (channel?.type !== ChannelType.GuildText) throw Error('The ticket is not a text channel.');
  if (!channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has(P.ViewChannel)) throw Error('Ticket privacy changed. Contact Gosu General.');
  for (const role of channel.guild.roles.cache.values()) {
    if (role.permissions.has(P.Administrator) || role.tags?.botId === botId) continue;
    if (channel.permissionsFor(role)?.has(P.ViewChannel)) throw Error('Ticket privacy changed. Contact Gosu General.');
  }
  for (const overwrite of channel.permissionOverwrites.cache.values()) if (overwrite.type === 1 && overwrite.allow.has(P.ViewChannel) && ![userId, operatorId, botId, channel.guild.ownerId].includes(overwrite.id)) throw Error('Unexpected member access to the ticket. Contact Gosu General.');
  if (!channel.permissionsFor(channel.guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) throw Error('Bot ticket permissions are missing.');
}
function createPointSkins({ client, operatorId, mongo, guildId = '495716062097309697' }) {
  let store, db, ready = false, timer, recovering = false;
  const report = e => console.error('[POINT SKIN]', e.code || e.name || 'Error');
  function controls(order) {
    if (!order.active) return [];
    const common = [button('edit', order.userId, order._id, order.revision, order.status === 'purchased' ? 'Fill in my request' : 'Edit my request', ButtonStyle.Primary)];
    const staff = order.status === 'submitted' ? [button('deliver', order.userId, order._id, order.revision, 'Mark delivered · owner', ButtonStyle.Success), button('changes', order.userId, order._id, order.revision, 'Request correction · owner')] : [];
    staff.push(button('refund', order.userId, order._id, order.revision, 'Cancel & refund · owner', ButtonStyle.Danger));
    return [row(...common), row(...staff)];
  }
  function payload(order) {
    const e = new EmbedBuilder().setColor(order.status === 'fulfilled' ? 0x34d399 : 0x38bdf8).setTitle(`MLBB point gift · ${statusName[order.status]}`)
      .setDescription(`**${formatPoints(order.price)} points paid** · One **GIFTABLE skin, hero or item strictly under 1,200 Diamonds**.\nNo VVIP membership required. Gosu General checks availability and the actual in-game gift price, then sends it manually.\n\nOnly the applicant, Gosu General and the bot have explicit ticket access. Discord administrators retain access. Never share passwords, login codes or payment details.`)
      .addFields({ name: 'Applicant', value: safe(order.userId) }, { name: 'Order', value: order._id });
    if (order.request) e.addFields({ name: 'MLBB ID / server (Zone)', value: `${safe(order.request.account)} / ${safe(order.request.server)}` }, { name: 'Requested gift', value: `${safe(order.request.item)}\nReported gift price: ${order.request.diamonds} / ${MAX_DIAMONDS} Diamonds · owner verification required` }, ...(order.request.notes ? [{ name: 'Notes', value: safe(order.request.notes) }] : []));
    if (order.decision) e.addFields({ name: order.status === 'fulfilled' ? 'Delivery recorded by Gosu General' : 'Owner response', value: `${safe(order.decision.reason)}${order.decision.item ? `\nSent: ${safe(order.decision.item)} · ${order.decision.diamonds} Diamonds` : ''}${order.status === 'refunded' ? `\n${formatPoints(order.price)} points returned exactly once.` : ''}` });
    e.setFooter({ text: `Revision ${order.revision} · Point purchases are separate from VVIP gifts` });
    return { embeds: [e], components: controls(order), allowedMentions: { parse: [] } };
  }
  async function getGuild() { return client.guilds.fetch(guildId); }
  async function ticket(order) {
    const guild = await getGuild(); await guild.roles.fetch();
    let channel;
    if (order.channelId) channel = await guild.channels.fetch(order.channelId, { force: true }).catch(e => { if (e.code === 10003) return null; throw e; });
    if (channel) { privateTicket(channel, order.userId, operatorId, client.user.id); return channel; }
    const lease = randomUUID(), claimed = await store.claimChannel(order._id, lease);
    if (!claimed) throw Error('Your ticket is being prepared. Open My gift ticket again shortly.');
    try {
      const channels = await guild.channels.fetch();
      channel = channels.find(c => c.type === ChannelType.GuildText && c.topic === `point-skin-order:${order._id}`);
      if (!channel) {
        const settings = await db.collection('gift_settings').findOne({ _id: guildId });
        const parent = settings?.ticketCategoryId ? channels.get(settings.ticketCategoryId) : settings?.panelChannelId ? channels.get(settings.panelChannelId)?.parent : null;
        channel = await guild.channels.create({ name: `🎁︱point-skin-${order.userId}`, type: ChannelType.GuildText, topic: `point-skin-order:${order._id}`, ...(parent?.type === ChannelType.GuildCategory ? { parent: parent.id } : {}),
          permissionOverwrites: [{ id: guild.id, type: 0, deny: [P.ViewChannel] }, ...[...new Set([order.userId, operatorId, client.user.id])].map(id => ({ id, type: 1, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.UseApplicationCommands, ...(id === client.user.id ? [P.EmbedLinks] : [])] }))], reason: `Member redeemed a ${formatPoints(order.price)}-point MLBB gift ticket` });
      }
      privateTicket(channel, order.userId, operatorId, client.user.id);
      await store.saveChannel(order._id, lease, channel.id);
      return channel;
    } finally { await store.releaseChannel(order._id, lease); }
  }
  async function publish(order) {
    const channel = await ticket(order), current = await store.get(order._id);
    let message = current.panelMessageId ? await channel.messages.fetch(current.panelMessageId).catch(e => { if (e.code === 10008) return null; throw e; }) : null;
    if (!message) {
      // Recover a successfully sent panel after a lost acknowledgement.
      message = (await channel.messages.fetch({ limit: 100 })).find(m => m.author.id === client.user.id && m.embeds?.some(e => e.fields?.some(f => f.name === 'Order' && f.value === current._id)));
    }
    const body = payload(current);
    if (message) await message.edit(body); else { message = await channel.send(body); await store.savePanel(current._id, message.id); }
    if (current.notifiedRevision < current.revision) {
      if (current.status === 'submitted') await channel.send({ content: `<@${operatorId}> — a paid MLBB point gift request is ready for your review.`, allowedMentions: { parse: [], users: [operatorId] } });
      if (current.status === 'changes' || current.status === 'fulfilled' || current.status === 'refunded') await channel.send({ content: `<@${current.userId}> — ${statusName[current.status]}. Check the request card above.`, allowedMentions: { parse: [], users: [current.userId] } });
      await store.notified(current._id, current.revision);
    }
    return channel;
  }
  async function recover() {
    if (!ready || recovering) return;
    recovering = true;
    try { for (const order of await store.pendingNotifications()) await publish(order).catch(report); }
    finally { recovering = false; }
  }
  async function init(database) {
    db = database; store = createSkinStore({ db, mongo, guildId, operatorId }); await store.init(); ready = true;
    timer = setInterval(() => recover().catch(report), 60000); timer.unref(); await recover();
    console.log(`[POINT SKIN] ${formatPoints(PRICE)}-point gift tickets ready; gift limit strictly below 1,200 Diamonds.`);
  }
  async function product(i) {
    const balance = await store.balance(i.user.id), order = await store.latest(i.user.id), quote = randomUUID();
    return { content: '', attachments: [], files: [], embeds: [new EmbedBuilder().setColor(0x38bdf8).setTitle(`MLBB gift ticket · ${formatPoints(PRICE)} points`)
      .setDescription(`Redeem one **GIFTABLE MLBB skin, hero or item worth less than 1,200 Diamonds** (maximum 1,199).\n\n**Price: ${formatPoints(PRICE)} points**\nYour balance: **${balance.toLocaleString()} points**\n\nConfirm purchase → private ticket → fill in your MLBB ID, server/Zone ID and exact gift name → Gosu General checks and sends it manually.\n\nOne active request at a time. You may redeem again after completion. If the owner cancels before delivery, your points are refunded. Edits and opening a ticket do not cost more points. No VVIP role needed.`)
      .setFooter({ text: 'No points are spent until Confirm purchase. Availability and gift price are checked by Gosu General.' })], components: [row(button('buy', i.user.id, quote, PRODUCT_VERSION, `Confirm purchase · ${formatPoints(PRICE)} points`, ButtonStyle.Primary).setDisabled(balance < PRICE || !!order?.active)), row(button('open', i.user.id, order?._id, undefined, 'My gift ticket').setDisabled(!order), new ButtonBuilder().setCustomId('points:shop').setLabel('Shop home').setStyle(ButtonStyle.Secondary))], allowedMentions: { parse: [] } };
  }
  function form(order) {
    const modal = new ModalBuilder().setCustomId(`${PREFIX}submit:${order.userId}:${order._id}:${order.revision}`).setTitle('MLBB point gift request');
    for (const [id, label, max, val, required, style] of [['account', 'MLBB ID number', 20, order.request?.account, true], ['server', 'Server / Zone number', 12, order.request?.server, true], ['item', 'Exact skin / hero / giftable item name', 150, order.request?.item, true], ['diamonds', 'Gift price in Diamonds (1–1,199)', 4, order.request?.diamonds, true], ['notes', 'Notes (optional; no passwords or codes)', 500, order.request?.notes, false, TextInputStyle.Paragraph]]) {
      const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style || TextInputStyle.Short).setRequired(required).setMaxLength(max);
      if (val !== undefined && val !== '') field.setValue(String(val)); modal.addComponents(row(field));
    }
    return modal;
  }
  function ownerModal(order, action) {
    const modal = new ModalBuilder().setCustomId(`${PREFIX}finish_${action}:${order.userId}:${order._id}:${order.revision}`).setTitle(action === 'deliver' ? 'Confirm gift already delivered' : action === 'refund' ? `Cancel & refund ${formatPoints(order.price)} points` : 'Request correction');
    if (action === 'deliver') {
      modal.addComponents(row(new TextInputBuilder().setCustomId('item').setLabel('Gift actually sent in game').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150).setValue(order.request.item)), row(new TextInputBuilder().setCustomId('diamonds').setLabel('Actual gift price (under 1,200)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(4).setValue(String(order.request.diamonds))));
    }
    modal.addComponents(row(new TextInputBuilder().setCustomId('reason').setLabel(action === 'deliver' ? 'Delivery reference / confirmation note' : 'Reason (refund only if no gift was sent)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
    return modal;
  }
  async function handle(i) {
    if (!i.customId?.startsWith(PREFIX)) return false;
    const [, , action, uid, id, revision] = i.customId.split(':');
    let committedOrder;
    try {
      if (!ready || i.guildId !== guildId || i.user.bot) throw Error('The MLBB point gift desk is unavailable in this server.');
      const staff = ['deliver', 'changes', 'refund'].includes(action) || action.startsWith('finish_');
      if (staff ? i.user.id !== operatorId : uid && uid !== i.user.id) throw Error(staff ? 'Only Gosu General can confirm delivery or refunds.' : 'Open your own gift ticket.');
      if (action === 'home') { await i.deferReply({ flags: MessageFlags.Ephemeral }); await i.editReply(await product(i)); return true; }
      if (action === 'buy') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = await getGuild();
        if (!guild.members.me?.permissions.has(P.ManageChannels)) throw Error('Ticket creation is unavailable. No points were spent.');
        const result = await store.purchase(i.user.id, id, revision); committedOrder = result.order;
        const channel = await publish(result.order);
        await i.editReply({ content: `${result.charged ? `**${formatPoints(result.order.price)} points paid. Your gift ticket is ready.**` : 'This purchase/request is already recorded. No additional points were spent.'}\nOpen <#${channel.id}> and click **Fill in my request**.`, components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open my gift ticket').setURL(`https://discord.com/channels/${guildId}/${channel.id}`))], allowedMentions: { parse: [] } }); return true;
      }
      const order = await store.get(id);
      if (!order || order.userId !== uid || order.guildId !== i.guildId) throw Error('Gift request not found. Open the shop again.');
      if (action === 'open') { await i.deferReply({ flags: MessageFlags.Ephemeral }); const channel = await publish(order); await i.editReply({ content: `Your gift request: <#${channel.id}> · ${statusName[order.status]}`, allowedMentions: { parse: [] } }); return true; }
      // Forms and management are restricted to the actual private ticket, not a copied control.
      if (i.channelId !== order.channelId) throw Error('Use the controls inside your private gift ticket.');
      const channel = await i.guild.channels.fetch(i.channelId, { force: true }); await i.guild.roles.fetch(); privateTicket(channel, uid, operatorId, client.user.id);
      if (Number(revision) !== order.revision || !order.active) throw Error('This request changed or is complete. Use the latest ticket controls.');
      if (action === 'edit') { await i.showModal(form(order)); return true; }
      if (['deliver', 'changes', 'refund'].includes(action)) { if (action !== 'refund' && order.status !== 'submitted') throw Error('A submitted request is required.'); await i.showModal(ownerModal(order, action)); return true; }
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      if (action === 'submit') {
        committedOrder = await store.submit(i.user.id, id, Number(revision), Object.fromEntries(['account', 'server', 'item', 'diamonds', 'notes'].map(name => [name, i.fields.getTextInputValue(name).trim()])));
      } else if (action.startsWith('finish_')) {
        const kind = action.slice(7), detail = { reason: i.fields.getTextInputValue('reason').trim() };
        if (kind === 'deliver') { detail.item = i.fields.getTextInputValue('item').trim(); const n = i.fields.getTextInputValue('diamonds').trim(); if (!/^[1-9]\d{0,3}$/.test(n)) throw Error('Enter the actual gift price in Diamonds.'); detail.diamonds = Number(n); }
        committedOrder = await store.decision(i.user.id, id, Number(revision), { deliver: 'fulfilled', changes: 'changes', refund: 'refunded' }[kind], detail);
      } else throw Error('Open the latest gift ticket controls.');
      await publish(committedOrder);
      await i.editReply({ content: action === 'submit' ? 'Request submitted. Gosu General has been notified in this private ticket. No additional points were spent.' : statusName[committedOrder.status], allowedMentions: { parse: [] } });
    } catch(e) {
      report(e);
      const message = committedOrder ? `Your purchase/request is saved (${committedOrder._id}). Discord could not finish updating the ticket. Open /shop → MLBB gift ticket → My gift ticket; it will also retry automatically. No additional payment is needed.` : e.name?.startsWith('Mongo') || e.errorLabels ? 'Could not confirm the update. Open My gift ticket before trying again. Duplicate purchases and refunds are prevented.' : e.message;
      if (i.deferred || i.replied) await i.editReply({ content: message, allowedMentions: { parse: [] } }).catch(() => {}); else await i.reply({ content: message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    }
    return true;
  }
  return { init, handle, stop: () => clearInterval(timer), product };
}
module.exports = { createPointSkins, privateTicket };

