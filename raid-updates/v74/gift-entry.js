// Ticket-only entry point while the full bot's privileged-intent review is pending.
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MongoClient } = require('mongodb');
const { createGifts } = require('./gift-system');
const { createPoints } = require('./points-system');
const { createCommunityViews } = require('./community-views');
const { setupCommunity } = require('./community-layout');
const { channelRoutes } = require('./community-navigation');
const { createMedia } = require('./community-media');
const { approvedIntents } = require('./approved-intents');
const config = {
  guildId: '495716062097309697', roleId: '1456152097840955568',
  panelChannelId: '1558554829104742400', reviewChannelId: '1566631270153191574',
  adminRole: '495718851288236032', modRole: '495727371140202506', operatorId: '170947916167512064',
  vipRoomId: '651240006811385886',
};
const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.Bot_Token;
if (!token || !process.env.MONGODB_URI) throw new Error('Bot token or MongoDB configuration missing.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates], partials:[Partials.GuildMember] });
const mongo = new MongoClient(process.env.MONGODB_URI);
const isAdmin = m => m.id === config.operatorId;
const gifts = createGifts({ client, isAdmin, adminRole: config.adminRole, modRole: config.modRole, operatorId: config.operatorId });
const points = createPoints({ operatorId: config.operatorId, client, mongo });
const levelRewards=require('./level-point-rewards').create({mongo,guildId:config.guildId});
const voiceXP=require('./voice-xp').create({client,guildId:config.guildId,rewards:levelRewards});
const community = createCommunityViews({ client });
const media = createMedia();
const raidTest = require('./raid-test').createRaidTest();
const moderation = require('./moderation-core').create(config);
const prune = require('./moderation-prune').createPrune(config);
const directory=require('./command-directory').create({...config,catalog:()=>[...gifts.commands,...points.commands,...community.commands,...media.commands,...raidTest.commands,...moderation.commands,...prune.commands,...directory.commands].map(c=>c.toJSON())});
client.on('messageCreate', message => {
  levelRewards.handleMessage(message).catch(e=>console.error('[LEVEL XP]',e.code||e.name));
  points.handleMessage(message).catch(e => console.error('[DAILY MESSAGE]', e.code || e.name));
});
client.on('interactionCreate', async i => {
  try {
  if (await directory.handle(i)) return;
  if (await moderation.handle(i)) return;
  if (await prune.handle(i)) return;
  if (await raidTest.handle(i)) return;
  if (await media.handle(i)) return;
  const r = channelRoutes(i.guildId);
  if (r && i.channelId === r.daily && !(i.isChatInputCommand() ? ['daily', 'shop', 'givepoints', 'pointtake'].includes(i.commandName) : ['points:daily', 'points:shop'].includes(i.customId))) {
    await i.reply({ content: `This channel is just for daily check-in. 💙\nSee <#${r.guide}> for the shop, profiles and commands.`, ephemeral: true, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }
  if (r && i.channelId === r.shop && (i.isChatInputCommand() ? !['shop', 'points', 'profile', 'rank', 'leaderboard', 'help', 'givepoints', 'pointtake'].includes(i.commandName) : !i.customId?.startsWith('points:') && !i.customId?.startsWith('community:'))) {
    await i.reply({ content: `This is the private profile shop. 💙 See <#${r.guide}> for other bot features.`, ephemeral: true, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }
  if (!(await community.handle(i)) && !(await points.handle(i)) && !(await gifts.handle(i)) && i.isChatInputCommand()) {
    await i.reply({ content: 'This command is temporarily unavailable. Use /gift for your VVIP skin ticket. 💙', ephemeral: true }).catch(() => {});
  }
  } catch (e) {
    // Interaction timeouts must not reject the EventEmitter listener or leak callback tokens.
    console.error('[INTERACTION]', e.code || e.name || 'Error');
  }
});
client.once('ready', async () => {
  console.log('[BOT] Application ID:', client.user.id);
  try {
    await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB_NAME || 'gosuBot');
    require('./raid-server-level').bindDatabase(db);
    require('./raid-workshop-store').bindDatabase(db);
    await require('./raid-workshop-store').resetTestProgress(require('./raid-test-reset-baseline.json'));
    await raidTest.start(client);
    await gifts.init(db);
    await points.init(db);
    await community.init(db);
    await media.init(db);
    await directory.init(db);
    await levelRewards.init(db);
    const guild = await client.guilds.fetch(config.guildId);
    voiceXP.start();
    const registeredCommands=await new REST({ version: '10' }).setToken(token).put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [...gifts.commands, ...points.commands, ...community.commands, ...media.commands, ...raidTest.commands, ...moderation.commands,...prune.commands,...directory.commands].map(c => c.toJSON()) });
    console.log('[COMMANDS REGISTERED]',registeredCommands.map(c=>c.name).join(', '));
    console.log('[PRUNE] Moderator message cleanup registered and online.');
    await require('./community-command-access').configure({guild,botId:client.user.id,videoChannel:require('./community-media').VIDEO_CHANNEL,reviewChannel:require('./clip-review').REVIEW_CHANNEL,modRole:config.modRole,adminRole:config.adminRole});
    try {
    const {panel}=await require('./gift-channel-bindings').bindGiftChannels({guild,db,config,gifts});
    console.log('[GIFTS] Owner-managed channel names, placement and permissions preserved.');
    await gifts.seedLegacy(guild.id);
    await db.collection('gift_settings').updateOne({ _id: guild.id }, { $set: { ...config, mode: 'role-cooldown', cooldownDays:30, diamondLimit: 899, timeZone: 'America/Los_Angeles' } }, { upsert: true });
    const saved = await db.collection('gift_settings').findOne({ _id: guild.id });
    let existing = saved.buttonMessageId ? await panel.messages.fetch(saved.buttonMessageId).catch(() => null) : null;
    if (!existing) {
      // Recover a successfully sent panel if the prior database write was interrupted.
      const messages = await panel.messages.fetch({ limit: 50 });
      existing = messages.find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'gift:open')));
    }
    const payload = { ...gifts.panel(), content: '' };
    const msg = existing ? await existing.edit(payload) : await panel.send(payload);
    await db.collection('gift_settings').updateOne({ _id: guild.id }, { $set: { buttonMessageId: msg.id } });
    } catch(e) { console.error('[GIFTS] Channel setup could not finish; other commands remain online:',e.code||e.name,e.message); }
    await setupCommunity({ guild, client, db, points, categoryId: config.ticketCategoryId, giftChannelId: config.panelChannelId });
    console.log('[BOT] Profile Atelier, top-50 XP board and owner-only raid-test commands online.');
    const welcomeReady=client.options.intents.has(GatewayIntentBits.GuildMembers)?await gifts.prepareWelcome(guild).catch(e=>{console.error('[GIFTS] Welcome baseline failed:',e.code||e.name);return false;}):false;
    console.log('[GIFTS] Automatic VVIP role welcome:',welcomeReady?'enabled':'pending Discord member-intent approval or member baseline');
    console.log('[GIFTS] Full ticket transcript access:',client.options.intents.has(GatewayIntentBits.MessageContent)?'enabled':'pending Discord message-content approval; unreadable transcripts retain their channels');
  } catch (e) {
    console.error('[GIFTS] Startup failed:', e.code || e.name, e.message?.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[database address]'));
    await client.destroy(); await mongo.close(); process.exitCode = 1;
  }
});
async function connect() {
  try {
    const rest=new REST({version:'10'}).setToken(token);
    const application=await rest.get('/applications/@me');
    const flags=BigInt(application.flags_new||application.flags||0);
    if(!Number.isInteger(application.approximate_guild_count)&&(flags&((1n<<15n)|(1n<<19n)))) {
      const guilds=await rest.get(Routes.userGuilds(),{query:new URLSearchParams({limit:'100'})});
      application.approximate_guild_count=guilds.length;
    }
    client.options.intents.add(...approvedIntents(application));
    await client.login(token);
  } catch(e) {console.error('[GIFTS] Connection failed:',e.code||e.name);process.exitCode=1;}
}
connect();

