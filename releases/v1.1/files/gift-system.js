const { SlashCommandBuilder, PermissionFlagsBits: P, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, GatewayIntentBits } = require('discord.js');
const { createBilling, activeCycle } = require('./gift-billing');
const { randomUUID } = require('node:crypto');
const { createTicketArchive } = require('./ticket-archive');
const { createCooldown } = require('./gift-cooldown');
const PT = 'America/Los_Angeles';
const safe = x => String(x).replace(/@/g, '＠').replace(/[`*_~|<>]/g, '');
const date = x => x ? new Intl.DateTimeFormat('en-US', { timeZone: PT, dateStyle: 'medium', timeStyle: 'short' }).format(x) + ' PT' : 'Not confirmed';
const row = (...buttons) => new ActionRowBuilder().addComponents(...buttons);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const stateName = { pending: 'We received your pick 💙', delivering: 'Getting your skin ready', fulfilled: 'Delivered 🎉', changes: 'Let’s double-check your choice' };
const adminCommand = (name, text) => new SlashCommandBuilder().setName(name).setDescription(text).setDMPermission(false).setDefaultMemberPermissions(P.Administrator);
const instructions = '# Your VVIP skin starts here 💙\nHey! Thanks for being part of the community. Let’s help you pick something you’ll love!\n\nChoose **one GIFTABLE MLBB skin or hero up to 899 Diamonds**. Enter your numeric **MLBB game ID**, numeric **Zone/server ID**, and the **exact skin or hero name** in the private request form. No DMs needed!\n\nLink your membership account in **Discord Settings → Connections → YouTube**. We’ll confirm your membership and your choice, then send it manually. Once your membership is confirmed, use **Apply / Edit gift** below. You can follow everything in this ticket.\n\n**Your pick refreshes with each confirmed renewal.** Unused picks don’t stack—you can have one at a time, not a growing balance.\n\nCheck your next renewal at https://www.youtube.com/paid_memberships. We’ll show confirmed dates in Pacific Time (PST/PDT); if a date is unknown, we won’t guess.\n\nPlease keep your game details here. Never share passwords or login codes. If we need membership-date evidence, hide card details and unrelated purchases. 💙';
function createGifts({ client, isAdmin, adminRole, modRole, operatorId }) {
  const billing = createBilling();
  const welcomeRoles=new Map();
  const cooldown = createCooldown();
  const archive = createTicketArchive({ client, validateReview: staffOnly, canReadUserContent: () => client.options?.intents?.has(GatewayIntentBits.MessageContent) ?? false, beforeClose: c => c.billingCycleId ? billing.unlock(c.guildId, c.userId, c.billingCycleId) : Promise.resolve() });
  let claims, settings, tickets, extras, jobs, ready = false, timer;
  const commands = [
    adminCommand('giftsetup', 'Configure VVIP gifts and private staff review channel')
      .addRoleOption(o => o.setName('role').setDescription('YouTube-managed VVIP tier role').setRequired(true))
      .addChannelOption(o => o.setName('review').setDescription('Private staff-only review channel').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    adminCommand('giftpanel', 'Post VVIP gift application panel in this channel'),
    adminCommand('giftqueue', 'Show pending gift requests (10 per page)')
      .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)),
    adminCommand('giftverify', 'Verify a real paid VVIP billing period and account ownership')
      .addUserOption(o => o.setName('user').setDescription('Verified Discord member').setRequired(true))
      .addStringOption(o => o.setName('youtube').setDescription('Verified owner YouTube channel ID, UC...').setRequired(true))
      .addStringOption(o => o.setName('account').setDescription('MLBB account ID').setRequired(true))
      .addStringOption(o => o.setName('server').setDescription('MLBB Zone/server ID').setRequired(true))
      .addStringOption(o => o.setName('from').setDescription('Verified paid period start: 2026-11-28T10:00-08:00').setRequired(true))
      .addStringOption(o => o.setName('until').setDescription('Verified paid period end, ISO with timezone').setRequired(true))
      .addStringOption(o => o.setName('receipt').setDescription('Unique verified transaction reference; hash stored, never card data').setRequired(true))
      .addStringOption(o => o.setName('next').setDescription('Reported next billing date, ISO with timezone; omit if unknown')),
    adminCommand('giftextra', 'Record an EXTRA gift already sent manually; does not grant claim credits')
      .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
      .addStringOption(o => o.setName('item').setDescription('Item actually sent').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('reason').setDescription('Reason for discretionary extra gift').setRequired(true).setMaxLength(300)),
  ];
  async function init(db) {
    ready = false;
    claims = db.collection('gift_claims'); settings = db.collection('gift_settings');
    tickets = db.collection('gift_tickets'); extras = db.collection('gift_extras'); jobs = db.collection('gift_notifications');
    if (await claims.findOne({ billingCycleId: { $exists: false }, mode: { $ne: 'role-cooldown' } })) throw new Error('Reconcile legacy calendar-month claims before activating gifts.');
    await billing.init(db);
    await cooldown.init(db); await cooldown.recover();
    archive.init(db);
    ready = true;
    if (!timer) { timer = setInterval(() => deleteDue().catch(e => console.error('[GIFTS] Delete retry:', e.message)), 60000); timer.unref(); }
    await deleteDue();
  }
  const fresh = (guild, id) => guild.members.fetch({ user: id, force: true });
  async function eligible(guild, id, cfg) {
    try { return (await fresh(guild, id)).roles.cache.has(cfg.roleId); }
    catch (e) { if (e.code === 10007) return false; throw e; }
  }
  function staffOnly(ch) {
    if (ch?.type !== ChannelType.GuildText) return false;
    for (const r of ch.guild.roles.cache.values()) {
      if (r.id === modRole || r.permissions.has(P.Administrator) || r.tags?.botId === client.user.id) continue;
      if (ch.permissionsFor(r)?.has(P.ViewChannel)) return false;
    }
    for (const o of ch.permissionOverwrites.cache.values()) if (o.type === 1 && o.allow.has(P.ViewChannel) && o.id !== client.user.id) {
      if (o.id !== (operatorId || ch.guild.ownerId)) return false;
    }
    return ch.permissionsFor(ch.guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]);
  }
  async function getTicket(guild, userId) {
    const operator = operatorId || guild.ownerId;
    if (!operator) throw new Error('Ticket operator is not configured.');
    const cfg = await settings.findOne({ _id: guild.id });
    const id = `${guild.id}_${userId}`;
    await tickets.updateOne({ _id: id }, { $setOnInsert: { guildId: guild.id, userId } }, { upsert: true });
    let doc = await tickets.findOne({ _id: id });
    if (doc.closingClaimId) throw new Error('Your last ticket is being safely archived. Please try again once it closes. 💙');
    if (doc.channelId) { const c = await guild.channels.fetch(doc.channelId).catch(() => null); if (c) {
      if (c.name?.startsWith('gift-')) await c.setName(`├▸🎟️ㅣskin-${userId}`);
      if (modRole && c.permissionOverwrites.edit) await c.permissionOverwrites.edit(modRole, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      checkTicket(c, userId); return c;
    } }
    doc = await tickets.findOneAndUpdate({ _id: id, $or: [{ lease: { $exists: false } }, { lease: { $lt: new Date() } }] },
      { $set: { lease: new Date(Date.now() + 60000) } }, { returnDocument: 'after' });
    if (!doc) throw new Error('Your ticket is being prepared. Please try again shortly.');
    try {
      await guild.channels.fetch();
      let c = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.topic === `gift-ticket:${id}`);
      if (!c && !cfg?.ticketCategoryId) throw new Error('Notice category is not configured; private ticket creation has been blocked.');
      if (!c) c = await guild.channels.create({ name: `├▸🎟️ㅣskin-${userId}`, type: ChannelType.GuildText, topic: `gift-ticket:${id}`, ...(cfg?.ticketCategoryId ? { parent: cfg.ticketCategoryId } : {}),
        permissionOverwrites: [{ id: guild.id, type: 0, deny: [P.ViewChannel] },
          ...(modRole ? [{ id: modRole, type: 0, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }] : []),
          ...[...new Set([userId, client.user.id, operator])].map(id => ({ id, type: 1, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, ...(id === client.user.id ? [P.EmbedLinks] : [])] }))] });
      checkTicket(c, userId);
      // Store the channel before sending, so retries cannot create duplicate tickets.
      await tickets.updateOne({ _id: id }, { $set: { channelId: c.id }, $unset: { lease: '', claimId: '' } });
      const history = await requestHistory(guild.id, userId);
      await c.send({ content: `<@${userId}> <@${operator}> — a private VVIP skin ticket has been opened. 💙\n\nChoose one **GIFTABLE MLBB skin or hero up to 899 Diamonds**. Click **Fill in my request** and enter your game ID, Zone/server ID and the skin or hero name. No DMs needed!\n\nGosu General is notified when you submit the form, then sends your skin in-game. We’ll tag you here when it’s delivered.\n\n**One request every 30 days, per Discord account.** Your cooldown starts when your request is accepted. Editing does not restart it; unused picks do not stack. Active YouTube VVIP role required.\n\n**History:** ${history.total} requests · ${history.delivered} delivered. Only you, Gosu General and server moderators can see this ticket (Discord administrators retain access). It closes after the operator confirms delivery and its private archive is verified. Never share passwords or login codes.`, components: [row(btn('gift:request', 'Fill in my request', ButtonStyle.Primary), btn('gift:status', 'My request status'))], allowedMentions: { parse: [], users: [userId, operator], roles: [] } });
      return c;
    } catch (e) { await tickets.updateOne({ _id: id }, { $unset: { lease: '' } }).catch(() => {}); throw e; }
  }
  function checkTicket(ch, owner) {
    if (ch.type !== ChannelType.GuildText) throw new Error('The ticket channel is invalid. Contact staff.');
    for (const r of ch.guild.roles.cache.values()) {
      if (r.id === modRole || r.permissions.has(P.Administrator) || r.tags?.botId === client.user.id) continue;
      if (ch.permissionsFor(r)?.has(P.ViewChannel)) throw new Error('Ticket privacy changed. Staff must fix permissions before using it.');
    }
    for (const o of ch.permissionOverwrites.cache.values()) {
      if (o.type === 1 && o.allow.has(P.ViewChannel) && ![owner, client.user.id, operatorId || ch.guild.ownerId].includes(o.id)) throw new Error('Unexpected member access to this ticket. Contact Gosu General.');
    }
    if (!ch.permissionsFor(ch.guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) throw new Error('Bot ticket permissions are missing.');
  }
  async function requestHistory(guildId, userId) {
    const [total, delivered] = await Promise.all([
      claims.countDocuments({ guildId, userId, status: { $in: ['pending','changes','delivering','fulfilled'] } }),
      claims.countDocuments({ guildId, userId, status: 'fulfilled' }),
    ]);
    return { total, delivered };
  }
  async function embed(c) {
    const { total, delivered } = await requestHistory(c.guildId, c.userId);
    return new EmbedBuilder().setColor(c.status === 'fulfilled' ? 0x34d399 : 0xd4af37).setTitle(`Your VVIP skin · ${stateName[c.status]}`)
      .addFields({ name: 'Member', value: safe(c.userId) }, { name: 'MLBB ID / Zone', value: `${safe(c.account)} / ${safe(c.server)}` },
        { name: 'Skin / hero', value: c.mode==='role-cooldown'?`${safe(c.item)}\nGIFTABLE only · limit 899 Diamonds · Gosu General checks the in-game price.`:`${safe(c.item)} · ${c.diamonds}/899 Diamonds (staff must verify)` },
        { name: c.mode === 'role-cooldown' ? 'Next request available' : 'Verified paid period', value: c.mode === 'role-cooldown' ? `${date(c.nextAt)} · 30 days from this request` : `${date(c.paidFrom)} → ${date(c.paidUntil)}` },
        { name: 'Member request history', value: `**${total} total requests** (including this one) · **${delivered} delivered**\nEdits do not add requests. Discretionary extras are separate.` })
      .setFooter({ text: `Request ${c._id} · revision ${c.revision}` }).setTimestamp(c.updatedAt);
  }
  async function review(c, cfg) {
    const ch = await client.channels.fetch(cfg.reviewChannelId);
    if (!staffOnly(ch)) throw new Error('Review channel is not private to staff, or bot permissions are missing.');
    const actions = c.status === 'pending' ? [btn(`gift:${c.mode==='role-cooldown'?'finish':'start'}:${c._id}:${c.revision}`, c.mode==='role-cooldown'?'Mark delivered':'Start delivery', ButtonStyle.Primary), btn(`gift:changes:${c._id}:${c.revision}`, 'Request correction')]
      : c.status === 'delivering' ? [btn(`gift:finish:${c._id}:${c.revision}`, 'Delivered · close ticket', ButtonStyle.Success), btn(`gift:changes:${c._id}:${c.revision}`, 'Stop: no gift sent')] : [];
    await ch.send({ embeds: [await embed(c)], components: actions.length ? [row(...actions)] : [], allowedMentions: { parse: [] } });
  }
  async function notify(c, cfg) {
    try {
      await review(c, cfg);
      const guild = await client.guilds.fetch(c.guildId), ch = await getTicket(guild, c.userId);
      const actions = c.status === 'pending' ? [btn(`gift:${c.mode==='role-cooldown'?'finish':'start'}:${c._id}:${c.revision}`, c.mode==='role-cooldown'?'Mark delivered':'Start delivery', ButtonStyle.Primary)] : c.status === 'delivering' ? [btn(`gift:finish:${c._id}:${c.revision}`, 'Delivery complete', ButtonStyle.Success)] : [];
      await ch.send({ content: c.status === 'pending' ? `<@${operatorId || guild.ownerId}> — a VVIP skin request is ready to review.` : undefined, embeds: [await embed(c)], components: actions.length ? [row(...actions)] : [], allowedMentions: { parse: [], users: c.status === 'pending' ? [operatorId || guild.ownerId] : [], roles: [] } });
      return true;
    } catch (e) { console.error('[GIFTS] Notification:', e.message); return false; }
  }
  async function myStatus(i) {
    const cfg = await settings.findOne({ _id: i.guildId });
    if (cfg?.mode === 'role-cooldown') {
      const ch = await getTicket(i.guild, i.user.id), t = await tickets.findOne({_id:`${i.guildId}_${i.user.id}`});
      const active = await cooldown.current(i.guildId,i.user.id);
      const c = t.claimId || active?.claimId ? await claims.findOne({_id:t.claimId || active.claimId,userId:i.user.id}) : null;
      await i.editReply({content:`Your private ticket: <#${ch.id}>\n${active ? `Next request: **${date(active.nextAt)}**.` : 'Your next skin request is ready when you are.'}`,embeds:c?[await embed(c)]:[],allowedMentions:{parse:[]}}); return;
    }
    const binding = await billing.get(i.guildId, i.user.id), cycle = binding?.current;
    const history = await requestHistory(i.guildId, i.user.id);
    const c = cycle ? await claims.findOne({ _id: cycle.id }) : null;
    const ch = await getTicket(i.guild, i.user.id);
    const valid = activeCycle(binding);
    await i.editReply({ content: `Your private ticket: <#${ch.id}>`, embeds: [new EmbedBuilder().setColor(0xd4af37).setTitle('Your VVIP skin 💙').addFields({ name: 'Request history', value: `**${history.total} total requests** · **${history.delivered} delivered**\nEdits do not count as new requests. Ticket closure does not reset this history.` })
      .setDescription(`Membership confirmed for: **${date(cycle?.from)} → ${date(cycle?.until)}**\nYour next renewal (when confirmed): **${date(cycle?.nextExpected)}**\n\nYour skin pick: **${valid && !c ? '1 ready to use' : c ? 'See your request below' : 'Let’s confirm your membership first'}**\nYour request: **${c ? stateName[c.status] : valid ? 'Ready when you are!' : 'Our team can help in your ticket'}**\n\nUse **Apply / Edit gift** in your ticket. You can have one unused pick at a time; picks don’t stack.\nCheck your renewal date at https://www.youtube.com/paid_memberships. A scheduled date alone doesn’t open a new pick—we’ll confirm your renewal first.`)] });
  }
  const panel = () => ({ embeds: [new EmbedBuilder().setColor(0xd4af37).setTitle('VVIP Thank-You MLBB Skin Gift 🎁')
    .setDescription('Thanks for being here! 💙 Choose a **GIFTABLE MLBB skin or hero up to 899 Diamonds**.\n\n**1. Open your ticket** using the button below.\n**2. Fill in your request** with your MLBB ID, Zone/server and skin or hero name.\n**3. Watch your ticket** — Gosu General will send it in-game and tag you when it’s ready!\n\nOne request every **30 days per Discord account** while you have the active VVIP role. Your next available date appears in your ticket. Unused picks do not stack.\n\nOnly you, Gosu General and moderators can see your ticket. After the operator confirms delivery, the ticket is archived privately and closed immediately when the archive is verified.')],
    components: [row(btn('gift:open','Open my skin ticket',ButtonStyle.Primary))], allowedMentions: { parse: [] } });
  async function handle(i) {
    const chat = i.isChatInputCommand();
    if (!(chat ? commands.some(c => c.name === i.commandName) : i.customId?.startsWith('gift:'))) return false;
    try {
      if (!ready || !i.guild) throw new Error('Gift applications are not ready. Please try again later.');
      const admin = chat || /^gift:(start|finish|complete|changes):/.test(i.customId);
      const request = i.isButton() && i.customId === 'gift:request';
      if (!request) await i.deferReply({ ephemeral: true });
      if (admin && !isAdmin(await fresh(i.guild, i.user.id))) throw new Error('Only an administrator can perform this action.');
      if (chat && i.commandName === 'giftsetup') {
        const role = i.options.getRole('role'), channel = await i.guild.channels.fetch(i.options.getChannel('review').id);
        await i.guild.roles.fetch();
        if (!role.managed || !/VVIP/i.test(role.name)) throw new Error('Choose the YouTube-managed VVIP role, not a general VIP role.');
        if (!staffOnly(channel)) throw new Error('Choose a private staff-only review channel.');
        await settings.updateOne({ _id: i.guildId }, { $set: { roleId: role.id, reviewChannelId: channel.id, mode: 'role-cooldown', cooldownDays:30, diamondLimit: 899, timeZone: PT } }, { upsert: true });
        await i.editReply('Settings saved. Post /giftpanel after testing the linked VVIP role.'); return true;
      }
      const cfg = await settings.findOne({ _id: i.guildId });
      if (!cfg || !['verified-billing-cycle','role-cooldown'].includes(cfg.mode)) throw new Error('The VVIP ticket desk is not configured yet.');
      if (cfg.mode === 'role-cooldown' && (request || i.customId?.startsWith('gift:pick:'))) {
        if (!(await eligible(i.guild, i.user.id, cfg))) throw new Error('Please connect your active YouTube VVIP membership first. 💙');
        const t=await tickets.findOne({_id:`${i.guildId}_${i.user.id}`});
        if (!t || t.channelId!==i.channelId || t.closingClaimId) throw new Error('Open your own active ticket to fill in this request.');
        const activeRequest=await cooldown.current(i.guildId,i.user.id);
        const recoveredId=t.claimId||activeRequest?.claimId;
        const c=recoveredId?await claims.findOne({_id:recoveredId,userId:i.user.id}):null;
        if(c&&['delivering','fulfilled'].includes(c.status)) throw new Error('Your request is already being delivered or completed. Check your status here.');
        if(request) {
          const active=await cooldown.current(i.guildId,i.user.id);
          if(active&&!c) throw new Error(`Your next request is available ${date(active.nextAt)}.`);
          const modal=new ModalBuilder().setCustomId(`gift:pick:${i.user.id}:${c?._id||'new'}`).setTitle('Your VVIP skin request');
          for(const [key,label,max] of [['account','MLBB game ID',20],['server','Zone / server ID',10],['item','GIFTABLE skin or hero name (up to 899)',100]]) {
            const input=new TextInputBuilder().setCustomId(key).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(max);
            if(c?.[key])input.setValue(String(c[key])); modal.addComponents(row(input));
          }
          await i.showModal(modal); return true;
        }
        if(i.customId.split(':')[2]!==i.user.id)throw new Error('Use your own request form.');
        const account=i.fields.getTextInputValue('account').trim(), server=i.fields.getTextInputValue('server').trim(), item=i.fields.getTextInputValue('item').trim();
        if(!/^\d{4,20}$/.test(account)||!/^\d{1,10}$/.test(server)||!item||item.length>100)throw new Error('Please enter a numeric MLBB ID and Zone/server, and the exact skin or hero name.');
        let saved;
        if(c) {
          if(i.customId.split(':')[3]!==c._id)throw new Error('Your request changed. Reopen the form.');
          saved=await claims.findOneAndUpdate({_id:c._id,userId:i.user.id,revision:c.revision,status:{$in:['pending','changes']}},{$set:{account,server,item,status:'pending',updatedAt:new Date()},$inc:{revision:1}},{returnDocument:'after'});
          if(!saved)throw new Error('Delivery has started. Ask Gosu General in this ticket before changing your choice.');
        } else {
          const result=await cooldown.submit({guildId:i.guildId,userId:i.user.id,account,server,item,diamonds:null,diamondLimit:899,ticketChannelId:i.channelId});
          if(!result.accepted)throw new Error(`Your next request is available ${date(result.nextAt)}.`);
          saved=result.claim; await tickets.updateOne({_id:t._id,channelId:i.channelId},{$set:{claimId:saved._id}});
        }
        const sent=await notify(saved,cfg);
        await i.editReply({content:`Your request is saved! 💙 ${sent?'Gosu General has been notified.':'The notification is delayed; your saved request is available to Gosu General.'}\nNext request: **${date(saved.nextAt)}**. Edits keep the same date.`,embeds:[await embed(saved)],allowedMentions:{parse:[]}}); return true;
      }
      if (chat && i.commandName === 'giftverify') {
        const userId = i.options.getUser('user').id;
        if ((await tickets.findOne({ _id: `${i.guildId}_${userId}` }))?.closingClaimId) throw new Error('The previous ticket is being archived. Please verify the next period after it closes.');
        if (!(await eligible(i.guild, userId, cfg))) throw new Error('The member must have the verified VVIP role.');
        const data = Object.fromEntries(['youtube', 'account', 'server', 'from', 'until', 'next', 'receipt'].map(k => [k, i.options.getString(k)]));
        const b = await billing.verify({ ...data, guildId: i.guildId, userId, actor: i.user.id });
        let notified = true;
        try {
          const ch = await getTicket(i.guild, userId);
          await ch.send({ content: `✅ **Paid VVIP period verified**\n${date(b.current.from)} → ${date(b.current.until)}\nReported next billing date: ${date(b.current.nextExpected)} (not proof of payment).\nYour one base claim is ready. Unused claims do not stack. Use Apply below.`,
            components: [row(btn('gift:request', 'Apply / Edit gift', ButtonStyle.Primary), btn('gift:status', 'My benefit status'))], allowedMentions: { parse: [] } });
        } catch (e) { notified = false; console.error('[GIFTS] Verification notification:', e.message); }
        await i.editReply(`Verified paid period: ${date(b.current.from)} → ${date(b.current.until)}. No unused credits were added or carried over.${notified ? '' : ' Ticket notification failed; saved verification is retained.'}`); return true;
      }
      if (chat && i.commandName === 'giftextra') {
        const userId = i.options.getUser('user').id, b = await billing.get(i.guildId, userId);
        if (!b) throw new Error('Verify the recipient’s YouTube and game-account identity first.');
        const extra = { _id: randomUUID(), guildId: i.guildId, userId, youtube: b.youtube, account: b.account, server: b.server,
          item: i.options.getString('item'), reason: i.options.getString('reason'), recordedBy: i.user.id, sentAt: new Date() };
        await extras.insertOne(extra);
        let notified = true;
        try {
          const ch = await getTicket(i.guild, userId);
          await ch.send({ content: `🎁 **Discretionary extra gift delivered:** ${safe(extra.item)}\nThis does not use or increase your base billing-cycle claim. Reference: ${extra._id}`, allowedMentions: { parse: [] } });
        } catch (e) { notified = false; console.error('[GIFTS] Extra gift notification:', e.message); }
        await i.editReply(`Extra gift recorded: ${safe(extra.item)}. Base claim balance is unchanged. Reference: ${extra._id}${notified ? '' : ' Ticket notification failed; record is retained.'}`); return true;
      }
      if (chat && i.commandName === 'giftpanel') {
        const result = await require('./gift-panel-upsert').upsert({
          guildId: i.guildId, channel: i.channel, botId: client.user.id,
          settings, payload: panel(), allowedChannelId: cfg.panelChannelId
        });
        await i.editReply(result.reused ? 'Existing VVIP application panel updated.' : 'VVIP application panel restored.'); return true;
      }
      if (chat && i.commandName === 'giftqueue') {
        const page = i.options.getInteger('page') || 1;
        const docs = await claims.find({ guildId: i.guildId, status: { $in: ['pending', 'changes', 'delivering'] } }).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * 10).limit(10).toArray();
        for (const c of docs) await review(c, cfg);
        await i.editReply(`Page ${page}: ${docs.length} requests posted. Older-cycle requests may be visible, but cannot start delivery after their verified period ends.`); return true;
      }
      if (i.isButton() && admin) {
        const [, action, id, rev] = i.customId.split(':'), c = await claims.findOne({ _id: id, guildId: i.guildId });
        if (!c || c.revision !== Number(rev)) throw new Error('This request changed. Use /giftqueue for the latest version.');
        const allowed = action === 'start' ? ['pending'] : ['finish', 'complete'].includes(action) ? c.mode==='role-cooldown'?['pending','delivering']:['delivering'] : ['pending', 'delivering'];
        if (!allowed.includes(c.status)) throw new Error('This request has already been processed.');
        if (action === 'finish') {
          await i.editReply({ content: '**Did you send the skin successfully?**\nConfirm below to record delivery. The bot will first save and verify the private transcript and attachments, then delete the ticket immediately. If archiving fails, the ticket will remain available for staff review.\n\nIf archiving fails, the ticket stays open for retry. Request history remains saved.', components: [row(btn(`gift:complete:${id}:${c.revision}`, 'Confirm delivery & close', ButtonStyle.Success))], allowedMentions: { parse: [] } });
          return true;
        }
        let locked = false;
        if (action === 'start') {
          if (!(await eligible(i.guild, c.userId, cfg))) throw new Error('The member no longer has VVIP eligibility.');
          if(c.billingCycleId){ await billing.lock(i.guildId, c.userId, c.billingCycleId); locked = true; }
        }
        const status = action === 'start' ? 'delivering' : action === 'complete' ? 'fulfilled' : 'changes';
        const ticket = action === 'complete' ? await tickets.findOne({ _id: `${i.guildId}_${c.userId}` }) : null;
        if (ticket?.channelId) await tickets.updateOne({ _id: ticket._id, channelId: ticket.channelId }, { $set: { closingClaimId: id } });
        let updated;
        try { updated = await claims.findOneAndUpdate({ _id: id, guildId: i.guildId, revision: c.revision, status: c.status },
          { $set: { status, handledBy: i.user.id, updatedAt: new Date(), ...(action === 'complete' ? { closureState: 'pending', closureDeleteAt: new Date(), ticketChannelId: ticket?.channelId || null, closureReviewId: cfg.reviewChannelId, closureRequestedBy: i.user.id } : {}) }, $inc: { revision: 1 } }, { returnDocument: 'after' }); }
        catch (e) { if (locked) console.error('[GIFTS] Delivery state uncertain; keep billing lock for operator reconciliation.'); throw e; }
        if (!updated) {
          if (locked) if(c.billingCycleId) await billing.unlock(i.guildId, c.userId, c.billingCycleId);
          if (ticket?.channelId) {
            const current = await claims.findOne({ _id: id });
            if (current?.status !== 'fulfilled') await tickets.updateOne({ _id: ticket._id, closingClaimId: id }, { $unset: { closingClaimId: '' } });
          }
          throw new Error('Another action changed the request.');
        }
        if (c.billingCycleId && action !== 'start' && action !== 'complete') if(c.billingCycleId) await billing.unlock(i.guildId, c.userId, c.billingCycleId);
        await i.message.edit({ components: [] }).catch(() => {});
        if (action === 'complete') {
          await review(updated, cfg).catch(e => console.error('[GIFTS] Completed request review:', e.code || e.name));
          if(c.billingCycleId) await billing.unlock(i.guildId, c.userId, c.billingCycleId);
          if (ticket?.channelId) {
            const ch = await i.guild.channels.fetch(ticket.channelId).catch(() => null);
            if (ch) await ch.send({ content: `<@${c.userId}> **Your skin has been delivered!** 💙\nThanks for being part of VVIP — enjoy your new look, and thank you for the support!\nThis ticket will close as soon as its private archive is verified. If archiving fails, the ticket will remain open for staff review.`, allowedMentions: { parse: [], users: [c.userId], roles: [] } }).catch(() => {});
          }
          const closed = await archive.run(updated._id);
          await i.editReply({ content: closed ? 'Delivery recorded. The private archive was verified and the ticket was deleted.' : 'Delivery recorded. The ticket was NOT deleted because archival or deletion could not be confirmed. Staff can retry safely; do not remove this channel manually.', components: [] });
          return true;
        }
        const sent = await notify(updated, cfg);
        await i.editReply(`${stateName[status]} recorded.${sent ? '' : ' Notification failed; the saved record is retained.'}`); return true;
      }
      if (i.isModalSubmit()) {
        if ((await tickets.findOne({ _id: `${i.guildId}_${i.user.id}` }))?.closingClaimId) throw new Error('Your previous ticket is being archived. Please reopen after it closes.');
        if (!(await eligible(i.guild, i.user.id, cfg))) throw new Error('Active VVIP role required.');
        const { binding: b, cycle } = await billing.current(i.guildId, i.user.id);
        const [, , id, revision] = i.customId.split(':');
        if (id !== cycle.id) throw new Error('Your verified billing cycle changed. Open the application again.');
        const item = i.fields.getTextInputValue('item').trim(), price = i.fields.getTextInputValue('diamonds').trim();
        if (!item || item.length > 100 || !/^\d{1,3}$/.test(price) || +price < 1 || +price > 899) throw new Error('Choose one item, priced from 1 to 899 Diamonds.');
        const data = { item, diamonds: +price, updatedAt: new Date() }; let c;
        if (revision === 'new') {
          c = { _id: cycle.id, billingCycleId: cycle.id, guildId: i.guildId, userId: i.user.id, youtube: b.youtube, account: b.account, server: b.server,
            paidFrom: cycle.from, paidUntil: cycle.until, ...data, status: 'pending', revision: 1, createdAt: new Date() };
          try { await claims.insertOne(c); } catch (e) { if (e.code === 11000) throw new Error('You already applied for this paid cycle. View your ticket.'); throw e; }
        } else {
          c = await claims.findOneAndUpdate({ _id: cycle.id, guildId: i.guildId, userId: i.user.id, revision: Number(revision), status: { $in: ['pending', 'changes'] } },
            { $set: { ...data, status: 'pending' }, $inc: { revision: 1 } }, { returnDocument: 'after' });
          if (!c) throw new Error('Delivery started or your request changed. Reopen your ticket.');
        }
        const sent = await notify(c, cfg);
        await i.editReply({ content: `Request saved.${sent ? '' : ' Notification delayed; Gosu General can retrieve it with /giftqueue.'}`, embeds: [await embed(c)] }); return true;
      }
      if (!(await eligible(i.guild, i.user.id, cfg))) throw new Error('Please connect your active VVIP membership in Discord Settings → Connections → YouTube. If your VVIP role is still missing, Gosu General can help. 💙');
      if (request) {
        if ((await tickets.findOne({ _id: `${i.guildId}_${i.user.id}` }))?.closingClaimId) throw new Error('Your previous ticket is being archived. Please wait until it closes.');
        const { binding: b, cycle } = await billing.current(i.guildId, i.user.id);
        const c = await claims.findOne({ _id: cycle.id });
        if (c && ['delivering', 'fulfilled'].includes(c.status)) { await i.reply({ content: `This paid cycle is already ${stateName[c.status]}. Check My benefit status.`, ephemeral: true }); return true; }
        const modal = new ModalBuilder().setCustomId(`gift:submit:${cycle.id}:${c?.revision ?? 'new'}`).setTitle('Choose your VVIP skin 💙');
        for (const [key, label] of [['item', 'Requested skin / hero'], ['diamonds', 'Gift price (max 899 Diamonds)']]) {
          const input = new TextInputBuilder().setCustomId(key).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(key === 'diamonds' ? 3 : 100);
          if (c?.[key]) input.setValue(String(c[key]));
          modal.addComponents(new ActionRowBuilder().addComponents(input));
        }
        await i.showModal(modal); return true;
      }
      await myStatus(i); return true;
    } catch (e) {
      console.error('[GIFTS]', e.message);
      const content = e.name?.startsWith('Mongo') ? 'Storage could not be confirmed. Please check with staff before retrying delivery.' : e.message;
      if (i.deferred || i.replied) await i.editReply({ content }).catch(e => console.error('[GIFTS] Response update:', e.code || e.name, e.message));
      else await i.reply({ content, ephemeral: true }).catch(() => {});
      return true;
    }
  }
  async function deleteDue() {
    if (!ready) return;
    await archive.retryDue();
    for (const job of await jobs.find({ deleteAt: { $lte: new Date() }, deleted: { $ne: true } }).limit(50).toArray()) {
      try {
        const ch = await client.channels.fetch(job.channelId), message = await ch.messages.fetch(job.messageId);
        await message.delete(); await jobs.updateOne({ _id: job._id }, { $set: { deleted: true } });
      } catch (e) { if ([10003, 10008].includes(e.code)) await jobs.updateOne({ _id: job._id }, { $set: { deleted: true } }); else console.error('[GIFTS] Welcome deletion:', e.message); }
    }
  }
  async function prepareWelcome(guild) {
    const cfg=await settings.findOne({_id:guild.id}),active=new Set();let after;
    if(!cfg?.roleId)return false;
    // Baseline current VVIPs without greeting everyone again after a restart.
    for(;;) {
      const members=await guild.members.list({limit:1000,...(after?{after}:{})});
      for(const member of members.values())if(member.roles.cache.has(cfg.roleId))active.add(member.id);
      if(members.size<1000)break;
      const next=members.last().id;if(next===after)throw new Error('Member pagination did not advance.');after=next;
      // Partial-member events use the small VVIP baseline, so a large server need not remain cached.
      for(const member of members.values())if(member.id!==client.user.id)guild.members.cache.delete(member.id);
    }
    welcomeRoles.set(guild.id,active);return true;
  }
  client.on('guildMemberUpdate', async (before, after) => {
    if (!ready) return;
    try {
      const cfg = await settings.findOne({ _id: after.guild.id });
      if (!cfg?.panelChannelId || !['verified-billing-cycle','role-cooldown'].includes(cfg.mode))return;
      if(cfg.mode==='role-cooldown') {
        const active=welcomeRoles.get(after.guild.id);if(!active)return;
        const had=active.has(after.id),has=after.roles.cache.has(cfg.roleId);
        if(has)active.add(after.id);else active.delete(after.id);
        if(had||!has)return;
      } else if(before.roles.cache.has(cfg.roleId)||!after.roles.cache.has(cfg.roleId))return;
      for(const [channelId,content] of [[cfg.vipRoomId,`<@${after.id}> Welcome to VVIP! Thanks for supporting the community. 💙 Your skin request desk is ready in <#${cfg.panelChannelId}> — open a ticket whenever you’re ready.`],[cfg.panelChannelId,`<@${after.id}> Your VVIP skin request desk is ready! 💙 Click **Open my skin ticket** above to get started.`]]) {
        if(!channelId)continue;
        const ch=await after.guild.channels.fetch(channelId),msg=await ch.send({content,allowedMentions:{users:[after.id],roles:[],parse:[]}});
        try { await jobs.insertOne({ _id: msg.id, channelId: ch.id, messageId: msg.id, deleteAt: new Date(Date.now() + 6 * 3600000), deleted: false }); }
        catch (e) { await msg.delete().catch(() => {}); throw e; }
      }
    } catch (e) { console.error('[GIFTS] Welcome:', e.message); }
  });
  return { commands, init, handle, panel, validateReview:staffOnly, seedLegacy:cooldown.seedLegacy, prepareWelcome };
}
module.exports = { createGifts };

