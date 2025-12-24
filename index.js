//12-24-25 Log메세지 새로운 디자인, VIP랑 일반 Welcome 메세지 추가

// =====================================================================
// Gosu Custom Discord Bot (Final Version - Part 1)
// Setup, Config, Database, VIP Roles Corrected
// =====================================================================

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ChannelType,
  ActivityType,
  REST,      // [NEW]
  Routes,    // [NEW]
  SlashCommandBuilder // [NEW]
} = require("discord.js");
const { MongoClient } = require("mongodb");

// ---------------------------------------------------------------------
// 1. CONFIGURATION & IDs
// ---------------------------------------------------------------------
const GOSU_ROLE = "496717793388134410";
const MOD_ROLE = "495727371140202506";
const ADMIN_ROLE = "495718851288236032";
const SUB_ROLE = "497654614729031681";
const CREATOR_ROLE = "1441214177128743017";
const VERIFICATION_ROLE = "1441311763806031893";
const SILVER_ROLE_ID = "497491254838427674"; 

// [CORRECTED] VIP CONFIGURATION
const TWITCH_VIP_ROLE_ID = "832458135544266752";  // Twitch Role
const YOUTUBE_VIP_ROLE_ID = "797932385429487676"; // Youtube Role
const VIP_CHAT_CHANNEL_ID = "651240006811385886"; // Target Channel

const CREATE_CHANNEL_IDS = ["720658789832851487", "1441159364298936340"];
const TEMP_VOICE_CHANNEL_IDS = new Set();

const XP_CONFIG = { minXP: 5, maxXP: 15, cooldownMs: 30000 };

const LEVEL_ROLES = [
  { level: 5, roleId: "497843968151781378", name: "Bronze" },
  { level: 10, roleId: SILVER_ROLE_ID, name: "Silver" },
  { level: 20, roleId: "687470373331402752", name: "Gold" },
  { level: 30, roleId: "497578834376392724", name: "Platinum" },
  { level: 40, roleId: "1441513975161294889", name: "Epic" },
  { level: 50, roleId: "523184440491638795", name: "Legends" },
  { level: 70, roleId: "542051690195451907", name: "Mythic" },
  { level: 80, roleId: "1441514153855422556", name: "Mythical Honor" },
  { level: 100, roleId: "1441514648275779685", name: "Mythical Glory" },
  { level: 150, roleId: "1441518689290817646", name: "Mythical Immortal" },
];

const BANNERS = {
  RULES: "https://github.com/TichielJuspian/images/blob/main/must%20read.png?raw=true",
  WELCOME: "https://github.com/TichielJuspian/images/blob/main/welcome.png?raw=true",
  NOTI: "https://github.com/TichielJuspian/images/blob/main/NOTIFICATION.png?raw=true",
  CREATOR: "https://github.com/TichielJuspian/images/blob/main/verification.png?raw=true"
};

// ---------------------------------------------------------------------
// 2. GLOBAL STATE & DB
// ---------------------------------------------------------------------
let BOT_CONFIG = { actionLogChannelId: null, msgLogChannelId: null, modLogChannelId: null, welcomeChannelId: null };
let BLACKLISTED_WORDS = [];
const xpCooldowns = new Map();

const mongoClient = new MongoClient(process.env.MONGODB_URI);
let xpCollection, configCollection, blacklistCollection;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ---------------------------------------------------------------------
// 3. DATABASE HELPERS
// ---------------------------------------------------------------------
async function connectAndLoad() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGODB_DB_NAME || "gosuBot");
    xpCollection = db.collection("user_xp");
    configCollection = db.collection("bot_config");
    blacklistCollection = db.collection("bot_blacklist");

    const configDoc = await configCollection.findOne({ _id: "global_config" });
    if (configDoc) BOT_CONFIG = configDoc.data;

    const blacklistDoc = await blacklistCollection.findOne({ _id: "global_blacklist" });
    if (blacklistDoc) BLACKLISTED_WORDS = blacklistDoc.words;
    
    console.log("[DATABASE] MongoDB Connected and Data Loaded.");
  } catch (e) { console.error("[DATABASE] Init Error:", e); }
}

async function saveConfig() {
  await configCollection.updateOne({ _id: "global_config" }, { $set: { data: BOT_CONFIG } }, { upsert: true });
}
async function saveBlacklist() {
  await blacklistCollection.updateOne({ _id: "global_blacklist" }, { $set: { words: BLACKLISTED_WORDS } }, { upsert: true });
}

// ---------------------------------------------------------------------
// 4. CLIENT READY & ZOMBIE FIX
// ---------------------------------------------------------------------
client.once("ready", async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);
  await connectAndLoad();
  
  const guilds = client.guilds.cache.map(g => g);
  for (const guild of guilds) {
    const channels = await guild.channels.fetch();
    channels.forEach(ch => {
      if (ch.type === ChannelType.GuildVoice && ch.name.startsWith("🎧") && ch.members.size === 0) {
        ch.delete().catch(()=>{});
      }
    });
  }
  client.user.setActivity("Gosu General TV", { type: ActivityType.Watching });
});

// =====================================================================
// Gosu Custom Discord Bot (Final Version - Part 2)
// Logic Helpers, XP Handler, Voice Creator
// =====================================================================

// ---------------------------------------------------------------------
// 5. LOGIC HELPERS
// ---------------------------------------------------------------------
function isModerator(member) {
  return member.roles.cache.has(MOD_ROLE) || member.roles.cache.has(ADMIN_ROLE) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}
function isAdmin(member) {
  return member.roles.cache.has(ADMIN_ROLE) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}
function getTotalXpForLevel(level) { return 100 * level * level; }
function getLevelFromTotalXp(totalXp) {
  let level = 0;
  while (totalXp >= getTotalXpForLevel(level + 1)) level++;
  return level;
}

async function sendModLog(guild, user, action, mod, reason) {
    if (!BOT_CONFIG.modLogChannelId) return;
    const ch = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if(ch) ch.send({ embeds: [new EmbedBuilder().setColor("Red").setTitle(action).setDescription(`Target: ${user.tag}\nMod: ${mod.tag}\nReason: ${reason}`).setTimestamp()] }).catch(()=>{});
}

// ---------------------------------------------------------------------
// 6. XP HANDLER
// ---------------------------------------------------------------------
async function handleXpGain(message) {
  if (!xpCollection || message.author.bot) return;
  const key = `${message.guild.id}:${message.author.id}`;
  if (Date.now() - (xpCooldowns.get(key) || 0) < XP_CONFIG.cooldownMs) return;
  xpCooldowns.set(key, Date.now());

  const xpGain = Math.floor(Math.random() * (XP_CONFIG.maxXP - XP_CONFIG.minXP + 1)) + XP_CONFIG.minXP;
  try {
    const res = await xpCollection.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      { $setOnInsert: { level: 0 }, $inc: { xp: xpGain } },
      { upsert: true, returnDocument: "after" }
    );
    const data = res.value || res;
    const calculatedLevel = getLevelFromTotalXp(data.xp);

    if (data.level !== calculatedLevel) {
      await xpCollection.updateOne({ _id: data._id }, { $set: { level: calculatedLevel } });
      if (calculatedLevel > data.level) {
        for (const reward of LEVEL_ROLES) {
          if (data.level < reward.level && calculatedLevel >= reward.level) {
            const role = message.guild.roles.cache.get(reward.roleId);
            if (role) {
              await message.member.roles.add(role).catch(() => {});
              if (reward.roleId === SILVER_ROLE_ID) message.channel.send(`🥈 **${message.author}** achieved **Silver Rank**! GIFs unlocked.`);
            }
          }
        }
        message.channel.send({ embeds: [new EmbedBuilder().setColor("#00FF7F").setDescription(`🎉 **${message.author}** reached **Level ${calculatedLevel}**!`)] });
      }
    }
  } catch (e) { console.error("[XP] Error:", e); }
}

// ---------------------------------------------------------------------
// 7. VOICE CREATOR HANDLER
// ---------------------------------------------------------------------
client.on("voiceStateUpdate", async (oldS, newS) => {
  if (newS.channelId && CREATE_CHANNEL_IDS.includes(newS.channelId)) {
    try {
      const ch = await newS.guild.channels.create({
        name: `🎧 ${newS.member.user.username}'s VO`, type: ChannelType.GuildVoice, parent: newS.channel.parent,
        permissionOverwrites: [{id: newS.member.id, allow:[PermissionsBitField.Flags.ManageChannels]}]
      });
      TEMP_VOICE_CHANNEL_IDS.add(ch.id);
      newS.member.voice.setChannel(ch);
    } catch(e){}
  }
  if (oldS.channelId && TEMP_VOICE_CHANNEL_IDS.has(oldS.channelId) && oldS.channel.members.size === 0) {
    oldS.channel.delete().catch(()=>{});
    TEMP_VOICE_CHANNEL_IDS.delete(oldS.channelId);
  }
});

// =====================================================================
// Gosu Custom Discord Bot (Final Version - Part 3)
// Slash Command Registration & XP/Filter Listener
// =====================================================================

// ---------------------------------------------------------------------
// 6. SLASH COMMAND REGISTRATION (Runs on Ready)
// ---------------------------------------------------------------------
client.once("ready", async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);
  await connectAndLoad();
  
  // Zombie Channel Fix
  const guilds = client.guilds.cache.map(g => g);
  for (const guild of guilds) {
    const channels = await guild.channels.fetch();
    channels.forEach(ch => {
      if (ch.type === ChannelType.GuildVoice && ch.name.startsWith("🎧") && ch.members.size === 0) {
        ch.delete().catch(()=>{});
      }
    });
  }
  client.user.setActivity("Gosu General TV", { type: ActivityType.Watching });

  // --- DEFINE SLASH COMMANDS ---
  const commands = [
    // General
    new SlashCommandBuilder().setName("help").setDescription("Show all available commands"),
    new SlashCommandBuilder().setName("rank").setDescription("Check rank & XP").addUserOption(o => o.setName("user").setDescription("Target user")),
    new SlashCommandBuilder().setName("leaderboard").setDescription("View Top 10 users"),
    new SlashCommandBuilder().setName("level").setDescription("View level rewards checklist"),
    new SlashCommandBuilder().setName("invite").setDescription("Get server invite link"),
    
    // Admin Panels
    new SlashCommandBuilder().setName("setupjoin").setDescription("[Admin] Show Rules Panel"),
    new SlashCommandBuilder().setName("welcome").setDescription("[Admin] Show Welcome Panel"),
    new SlashCommandBuilder().setName("subscriber").setDescription("[Admin] Show Subscriber Notification Panel"),
    new SlashCommandBuilder().setName("creator").setDescription("[Admin] Show Creator Verification Panel"),
    
    // Moderation
    new SlashCommandBuilder().setName("kick").setDescription("[Mod] Kick a user").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("ban").setDescription("[Admin] Ban a user").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("mute").setDescription("[Mod] Timeout a user").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)).addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes (Default: 3)")),
    new SlashCommandBuilder().setName("unmute").setDescription("[Mod] Remove timeout").addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)),
    new SlashCommandBuilder().setName("freeze").setDescription("[Mod] Freeze the current channel"),
    new SlashCommandBuilder().setName("unfreeze").setDescription("[Mod] Unfreeze the current channel"),
    new SlashCommandBuilder().setName("addword").setDescription("[Mod] Add word to blacklist").addStringOption(o => o.setName("word").setDescription("Word to ban").setRequired(true)),
    new SlashCommandBuilder().setName("removeword").setDescription("[Mod] Remove word from blacklist").addStringOption(o => o.setName("word").setDescription("Word to unban").setRequired(true)),
    new SlashCommandBuilder().setName("prune").setDescription("[Mod] Delete messages").addIntegerOption(o => o.setName("amount").setDescription("Number of messages").setRequired(true)),
    new SlashCommandBuilder().setName("syncrolexp").setDescription("[Admin] Sync XP based on Roles"),

    // Log Config
    new SlashCommandBuilder().setName("setwelcome").setDescription("[Admin] Set Welcome Channel").addChannelOption(o => o.setName("channel").setDescription("Select channel").setRequired(true)),
    new SlashCommandBuilder().setName("setmodlog").setDescription("[Admin] Set Mod Log Channel").addChannelOption(o => o.setName("channel").setDescription("Select channel").setRequired(true)),
    new SlashCommandBuilder().setName("setmsglog").setDescription("[Admin] Set Message Log Channel").addChannelOption(o => o.setName("channel").setDescription("Select channel").setRequired(true)),
    new SlashCommandBuilder().setName("setactionlog").setDescription("[Admin] Set Action Log Channel").addChannelOption(o => o.setName("channel").setDescription("Select channel").setRequired(true)),
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.Bot_Token);

  try {
    console.log("[SLASH] Started refreshing application (/) commands.");
    // Register commands to ALL guilds the bot is in
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("[SLASH] Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
});

// ---------------------------------------------------------------------
// 7. MESSAGE LISTENER (XP & FILTERS ONLY)
// ---------------------------------------------------------------------
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // We NO LONGER check for "!" commands here.
  // This listener is ONLY for chatting XP and Filters.

  const isMod = isModerator(message.member);
  const lowerContent = message.content.toLowerCase();

  // 1. FILTERS (Only for non-mods)
  if (!isMod) {
    // Anti-Scam
    const scams = ["free nitro", "bit.ly/", "steamcommunity.com/gift"];
    if (scams.some(s => lowerContent.includes(s))) {
      if (message.deletable) message.delete().catch(()=>{});
      return message.channel.send(`🚨 **${message.author.username}** Scam link blocked.`).then(m => setTimeout(() => m.delete(), 5000));
    }
    
    // Blacklist
    if (BLACKLISTED_WORDS.some(w => lowerContent.includes(w))) {
      if (message.deletable) message.delete().catch(()=>{});
      return message.channel.send(`🚫 **${message.author.username}** Forbidden word detected.`).then(m => setTimeout(() => m.delete(), 5000));
    }

    // Link Filter (Silver Rank+)
    const hasLink = /(https?:\/\/[^\s]+)/.test(lowerContent);
    if (hasLink && !message.member.roles.cache.has(SILVER_ROLE_ID)) {
      if (message.deletable) message.delete().catch(()=>{});
      return message.channel.send(`🚫 **${message.author.username}**, Links require **Silver Rank (Lv 10)**.`).then(m => setTimeout(() => m.delete(), 5000));
    }
  }

  // 2. XP GAIN
  await handleXpGain(message);
});

// =====================================================================
// Gosu Custom Discord Bot (Final Version - Part 4)
// Slash Command Handler, Events, VIP Logic (Prune Fixed)
// =====================================================================

// ---------------------------------------------------------------------
// 8. INTERACTION HANDLER (Execute Slash Commands)
// ---------------------------------------------------------------------
client.on("interactionCreate", async (interaction) => {
  // 1. Handle Buttons (Rules, Subs)
  if (interaction.isButton()) {
      try {
        if (interaction.customId === "agree_rules") { 
            await interaction.member.roles.add(GOSU_ROLE); 
            interaction.reply({ content: "✅ Welcome to the server!", ephemeral: true }); 
        }
        else if (interaction.customId === "subscribe_toggle") { 
            const has = interaction.member.roles.cache.has(SUB_ROLE); 
            if (has) await interaction.member.roles.remove(SUB_ROLE); 
            else await interaction.member.roles.add(SUB_ROLE); 
            interaction.reply({ content: has ? "🔕 Unsubscribed." : "🔔 Subscribed!", ephemeral: true }); 
        }
      } catch (e) {}
      return;
  }

  // 2. Handle Slash Commands
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  const isMod = isModerator(interaction.member);
  const isAdminUser = isAdmin(interaction.member);

  // --- GENERAL COMMANDS ---
  
  if (commandName === "invite") {
      await interaction.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");
  }

  if (commandName === "help") {
      const embed = new EmbedBuilder().setColor("#00FFFF").setTitle("🤖 Gosu Bot Command List")
      .setDescription("Use `/` to access commands!")
      .addFields(
        { name: "🌐 General", value: "`/rank` `/leaderboard` `/level` `/invite`", inline: false },
        { name: "🛡️ Moderation", value: "`/kick` `/ban` `/mute` `/unmute` `/freeze` `/prune`", inline: false },
        { name: "⚙️ Admin", value: "`/setupjoin` `/welcome` `/subscriber` `/creator`", inline: false }
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === "rank") {
    const targetUser = options.getUser("user") || interaction.user;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    
    const data = await xpCollection.findOne({ guildId: interaction.guild.id, userId: targetUser.id });
    if (!data) return interaction.reply({ content: `❌ No XP data for **${targetUser.username}**.`, ephemeral: true });

    const currentLevel = data.level || 0;
    const rank = (await xpCollection.countDocuments({ guildId: interaction.guild.id, xp: { $gt: data.xp } })) + 1;
    const nextLevelBaseXp = getTotalXpForLevel(currentLevel + 1);
    const xpLeft = nextLevelBaseXp - data.xp;
    
    const currentLevelBaseXp = getTotalXpForLevel(currentLevel);
    const xpIntoLevel = data.xp - currentLevelBaseXp;
    const xpNeeded = nextLevelBaseXp - currentLevelBaseXp;
    const percent = Math.min(Math.max(xpIntoLevel / xpNeeded, 0), 1);
    const percentText = Math.floor(percent * 100);
    const bar = "█".repeat(Math.round(percent * 15)) + "░".repeat(15 - Math.round(percent * 15));

    const embed = new EmbedBuilder()
      .setColor(targetMember?.displayHexColor || "#9B59B6")
      .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🧬 Level", value: `${currentLevel}`, inline: true },
        { name: "🏆 Rank", value: `#${rank}`, inline: true },
        { name: "⭐ XP", value: `${data.xp.toLocaleString()}`, inline: true },
        { name: "📈 Progress", value: `${bar} **${percentText}%**\n${xpIntoLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: false },
        { name: "🎁 Next Reward", value: `**${xpLeft.toLocaleString()} XP** left until next level`, inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "leaderboard") {
    await interaction.deferReply(); 
    const top = await xpCollection.find({ guildId: interaction.guild.id }).sort({ xp: -1 }).limit(10).toArray();
    
    let list = "";
    for (let i = 0; i < top.length; i++) {
        let prefix = `#${i+1}`;
        if (i===0) prefix="🥇"; if(i===1) prefix="🥈"; if(i===2) prefix="🥉";
        let member = interaction.guild.members.cache.get(top[i].userId);
        if (!member) { try { member = await interaction.guild.members.fetch(top[i].userId); } catch (e) {} }
        const name = member ? member.user.username : "Unknown";
        const xpK = (top[i].xp / 1000).toFixed(1) + "k";
        list += `${prefix} **${name}** — Lv ${top[i].level} (${xpK} XP)\n`;
    }
    
    const embed = new EmbedBuilder().setColor("#FFD700").setTitle("🏆 Leaderboard").setDescription(list || "No data yet.");
    await interaction.editReply({ embeds: [embed] });
  }

  if (commandName === "level") {
    const d = await xpCollection.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
    const userLvl = d ? d.level : 0;
    const list = LEVEL_ROLES.map(r => {
        const icon = userLvl >= r.level ? "✅" : "🔒";
        const roleStr = interaction.guild.roles.cache.has(r.roleId) ? `<@&${r.roleId}>` : `@${r.name}`;
        return `${icon} **Lv ${r.level}** — ${roleStr}`;
    }).join("\n");
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("Green").setTitle("🎯 Level Rewards").setDescription(`**Your Level: ${userLvl}**\n\n${list}`)], ephemeral: true });
  }

  // --- ADMIN PANELS ---
  if (commandName === "setupjoin") {
    if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅"));
    await interaction.channel.send({ files: [BANNERS.RULES] });
    await interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Community!").setDescription("Here you can join events, get updates, talk with the community, and enjoy the content together.\n\n--------------------------------------------------\n\n📜 **Server Rules**\n\n✨ **1 – Be Respectful**\nTreat everyone kindly. No harassment, bullying, or toxicity.\n\n✨ **2 – No Spam**\nAvoid repeated messages, emoji spam, or unnecessary mentions.\n\n✨ **3 – No NSFW or Harmful Content**\nNo adult content, gore, or anything unsafe.\n\n✨ **4 – No Advertising**\nNo links, promos, or self-promotion without staff approval.\n\n✨ **5 – Keep it Clean**\nNo hate speech, slurs, or extreme drama.\n\n✨ **6 – Follow Staff Instructions**\nIf staff gives instructions, please follow them.\n\n--------------------------------------------------\nPress **Agree To Rules** below to enter and enjoy the server! 🎊")], components: [row] });
    await interaction.reply({ content: "Panel Sent.", ephemeral: true });
  }

  if (commandName === "welcome") {
     if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
     await interaction.channel.send({ files: [BANNERS.WELCOME] });
     const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("YouTube Channel").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu"),
        new ButtonBuilder().setLabel("Twitch Channel").setStyle(ButtonStyle.Link).setURL("https://twitch.tv/gosugeneral"),
        new ButtonBuilder().setLabel("Invite Link").setStyle(ButtonStyle.Link).setURL("https://discord.gg/gosugeneral")
    );
     await interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Discord Server!").setDescription("Greetings, adventurer!\n\nWelcome to the **Gosu General TV** community server.\nHere you can hang out with the community, share plays, ask questions, receive announcements, and join events together.\n\n---\n\n📌 **What you can find here**\n\n• Live stream notifications & announcements\n• Game discussions and guides\n• Clips, highlights, and community content\n• Chill chat with other Gosu viewers\n\n---\nEnjoy your stay and have fun! 💙").addFields({ name: "Official Links", value: "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://twitch.tv/gosugeneral)", inline: true }, { name: "Discord Invite Link", value: "🔗 [Invite Link](https://discord.gg/gosugeneral)", inline: true })], components: [row] });
     await interaction.reply({ content: "Welcome Panel Sent.", ephemeral: true });
  }

  if (commandName === "subscriber") {
      if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Subscribe / Unsubscribe").setStyle(ButtonStyle.Primary).setEmoji("🔔"));
      await interaction.channel.send({ files: [BANNERS.NOTI] });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#FF0000").setTitle("🔔 Live Notification Subscription").setDescription("Stay updated with **Live Streams** and **New Uploads**!\n\nBy subscribing, you will receive:\n• 🔴 Live stream alerts\n• 🆕 New YouTube upload notifications\n• 📢 Special announcements\n\n---\n\n📌 **How It Works**\n\n• Press once → **Subscribe**\n• Press again → **Unsubscribe**\n\n---\nEnjoy real-time updates and never miss a stream! 💙").setFooter({ text: "Gosu General TV — Notification System" })], components: [row] });
      await interaction.reply({ content: "Sub Panel Sent.", ephemeral: true });
  }
  
  if (commandName === "creator") {
      if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
      await interaction.channel.send({ files: [BANNERS.CREATOR] });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#FFB347").setTitle("👑 Creator Role – Automatic Verification").setDescription("Hello, creators! This panel explains how to obtain the **Creator** role and access exclusive creator-only channels.\n\nOur Creator role is granted through **Discord's automatic verification system**, based on your connected accounts.\n\n--------------------------------------------\n### 1️⃣ Required Conditions\nTo receive the Creator role, at least **one** connected account must meet **all** requirements below:\n\n**Supported Platforms:**\n• TikTok / YouTube / Twitch / Facebook\n\n**Requirements:**\n• The account must be **connected** to your Discord profile\n• The account must be **verified** (e.g., phone verification)\n• Minimum **100 followers/subscribers**\n• Must be following **100+ users**\n• At least **10 likes or activity records**\n\n--------------------------------------------\n### 2️⃣ How to Connect Your Account to Discord\n1. Open **User Settings** (gear icon ⚙️ bottom-left)\n2. Select **Connections**\n3. Click **Add Connection**\n4. Choose TikTok / YouTube / Twitch / Facebook, then log in and link your account\n\n--------------------------------------------\n### 3️⃣ Automatic Creator Role Assignment\n• After linking and meeting the requirements, Discord automatically verifies your account.\n• Please wait a moment; syncing account data may take some time.\n• Once approved, the **Creator** role will appear and channels like **#creator-chat** will become available.\n\n--------------------------------------------\n### ⚠️ Troubleshooting\n**Didn't receive the role?**\n• Ensure your linked account meets *all* requirements\n• Refresh Discord with **Ctrl + R** (Windows) or **Cmd + R** (Mac)\n\n**Need help?**\nDM an admin if you're experiencing issues or have questions.").setFooter({ text: "Gosu General TV — Creator Role Guide" })] });
      await interaction.reply({ content: "Creator Panel Sent.", ephemeral: true });
  }

  // --- MODERATION ---
  if (commandName === "kick") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const user = options.getUser("user");
      const reason = options.getString("reason") || "No reason";
      const member = interaction.guild.members.cache.get(user.id);
      
      if(member && member.kickable) {
          await member.kick(reason);
          interaction.reply(`👢 Kicked **${user.tag}**.`);
          if(BOT_CONFIG.modLogChannelId) interaction.guild.channels.cache.get(BOT_CONFIG.modLogChannelId)?.send({ embeds: [new EmbedBuilder().setColor("Orange").setTitle("Member Kicked").setDescription(`Target: ${user.tag}\nMod: ${interaction.user.tag}\nReason: ${reason}`).setThumbnail(user.displayAvatarURL({dynamic:true}))] });
      } else {
          interaction.reply({ content: "❌ Cannot kick this user.", ephemeral: true });
      }
  }

  if (commandName === "ban") {
      if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
      const user = options.getUser("user");
      const reason = options.getString("reason") || "No reason";
      const member = interaction.guild.members.cache.get(user.id);
      
      if(member && member.bannable) {
          await member.ban({ reason });
          interaction.reply(`🔨 Banned **${user.tag}**.`);
          if(BOT_CONFIG.modLogChannelId) interaction.guild.channels.cache.get(BOT_CONFIG.modLogChannelId)?.send({ embeds: [new EmbedBuilder().setColor("DarkRed").setTitle("Member Banned").setDescription(`Target: ${user.tag}\nMod: ${interaction.user.tag}\nReason: ${reason}`).setThumbnail(user.displayAvatarURL({dynamic:true}))] });
      } else {
          interaction.reply({ content: "❌ Cannot ban this user.", ephemeral: true });
      }
  }

  if (commandName === "mute") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const user = options.getUser("user");
      const mins = options.getInteger("minutes") || 3;
      const member = interaction.guild.members.cache.get(user.id);
      
      if(member) {
          await member.timeout(mins * 60000);
          interaction.reply(`🔇 Muted **${user.tag}** for ${mins}m.`);
          if(BOT_CONFIG.modLogChannelId) interaction.guild.channels.cache.get(BOT_CONFIG.modLogChannelId)?.send({ embeds: [new EmbedBuilder().setColor("Gold").setTitle("Member Muted").setDescription(`Target: ${user.tag}\nDuration: ${mins}m\nMod: ${interaction.user.tag}`).setThumbnail(user.displayAvatarURL({dynamic:true}))] });
      } else {
          interaction.reply({ content: "❌ Cannot mute user.", ephemeral: true });
      }
  }

  if (commandName === "unmute") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const user = options.getUser("user");
      const member = interaction.guild.members.cache.get(user.id);
      if(member) {
          await member.timeout(null);
          interaction.reply(`🔊 Unmuted **${user.tag}**.`);
      }
  }

  if (commandName === "freeze") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false }); 
      interaction.reply("❄️ **The chat has been frozen.** Everyone, please cool down for a moment.");
  }

  if (commandName === "unfreeze") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null }); 
      interaction.reply("♨️ **The freeze has been lifted.**");
  }
  
  // [FIXED] PRUNE COMMAND
  if (commandName === "prune") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const amount = options.getInteger("amount");
      
      // 1. Check Amount Limit (Standard: 1 to 100)
      if (amount < 1 || amount > 100) {
          return interaction.reply({ content: "❌ Amount must be between 1 and 100.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true }); // Wait for deletion

      try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          interaction.editReply({ content: `✅ Deleted **${deleted.size}** messages.` });
      } catch (error) {
          console.error(error);
          interaction.editReply({ content: "❌ Failed to delete messages.\n(Check Bot Permissions or messages older than 14 days cannot be deleted)" });
      }
  }

  if (commandName === "addword") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const word = options.getString("word").toLowerCase();
      BLACKLISTED_WORDS.push(word);
      await saveBlacklist();
      interaction.reply(`🚫 Added **${word}** to blacklist.`);
  }

  if (commandName === "removeword") {
      if(!isMod) return interaction.reply({content: "❌ Mod only.", ephemeral: true});
      const word = options.getString("word").toLowerCase();
      BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(w => w !== word);
      await saveBlacklist();
      interaction.reply(`✅ Removed **${word}** from blacklist.`);
  }
  
  if (commandName === "syncrolexp") {
      if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
      await interaction.deferReply();
      let c = 0;
      for (const r of LEVEL_ROLES) { 
        const role = interaction.guild.roles.cache.get(r.roleId); 
        if (!role) continue; 
        for (const [id, m] of role.members) { 
            await xpCollection.updateOne({ guildId: interaction.guild.id, userId: id }, { $set: { level: r.level, xp: getTotalXpForLevel(r.level) } }, { upsert: true }); 
            c++; 
        } 
      }
      interaction.editReply(`✅ Synced XP for **${c}** users.`);
  }

  // --- CONFIG ---
  if (["setwelcome", "setmodlog", "setmsglog", "setactionlog"].includes(commandName)) {
      if(!isAdminUser) return interaction.reply({content: "❌ Admin only.", ephemeral: true});
      const ch = options.getChannel("channel");
      if (commandName === "setwelcome") BOT_CONFIG.welcomeChannelId = ch.id;
      if (commandName === "setmodlog") BOT_CONFIG.modLogChannelId = ch.id;
      if (commandName === "setmsglog") BOT_CONFIG.msgLogChannelId = ch.id;
      if (commandName === "setactionlog") BOT_CONFIG.actionLogChannelId = ch.id;
      await saveConfig();
      interaction.reply(`✅ Config updated: **${commandName}** -> ${ch}`);
  }

});

// ---------------------------------------------------------------------
// 9. OTHER EVENTS
// ---------------------------------------------------------------------

client.on("messageDelete", async (m) => {
    if (!m.guild || m.author?.bot || !BOT_CONFIG.msgLogChannelId) return;
    const ch = m.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setColor("#FF4500").setAuthor({ name: "Message Deleted", iconURL: "https://cdn-icons-png.flaticon.com/512/3405/3405244.png" }).setThumbnail(m.author.displayAvatarURL({dynamic:true})).addFields({ name: "User", value: `${m.author.username} (${m.author.id})` }, { name: "Channel", value: `${m.channel}` }, { name: "Content", value: m.content || "*[Image]*" }).setTimestamp()] }).catch(()=>{});
});

client.on("guildMemberRemove", async (m) => {
    if(!BOT_CONFIG.actionLogChannelId) return;
    const ch = m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
    if(ch) ch.send({ embeds: [new EmbedBuilder().setColor("#FF4500").setAuthor({ name: "Member Left", iconURL: m.user.displayAvatarURL() }).setThumbnail(m.user.displayAvatarURL({dynamic:true})).setDescription(`${m} ${m.user.username}`).setFooter({ text: `ID: ${m.id}` }).setTimestamp()] }).catch(()=>{});
});

client.on("guildMemberAdd", async (m) => {
    // 1. Action Log
    if(BOT_CONFIG.actionLogChannelId) {
        const ch = m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
        if(ch) ch.send({ embeds: [new EmbedBuilder().setColor("#00FF00").setAuthor({ name: "Member Joined", iconURL: m.user.displayAvatarURL() }).setThumbnail(m.user.displayAvatarURL({dynamic:true})).setDescription(`${m} ${m.user.username}`).setFooter({ text: `ID: ${m.id}` }).setTimestamp()] }).catch(()=>{});
    }
    // 2. Welcome Card
    if(BOT_CONFIG.welcomeChannelId) {
        const ch = m.guild.channels.cache.get(BOT_CONFIG.welcomeChannelId);
        if(ch) {
            const embed = new EmbedBuilder().setColor("#2f3136").setAuthor({ name: "Welcome to the server!" }).setDescription(`Let's all welcome ${m} !`).setThumbnail(m.user.displayAvatarURL({ dynamic: true, size: 256 })).setImage(BANNERS.WELCOME).setFooter({ text: `${m.guild.name} • Member #${m.guild.memberCount}` }).setTimestamp();
            await ch.send({ content: `Welcome to the server, ${m}!`, embeds: [embed] }).catch(()=>{});
        }
    }
});

// VIP WELCOME
client.on("guildMemberUpdate", (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    if (addedRoles.has(TWITCH_VIP_ROLE_ID) || addedRoles.has(YOUTUBE_VIP_ROLE_ID)) {
        if (VIP_CHAT_CHANNEL_ID) {
            const ch = newMember.guild.channels.cache.get(VIP_CHAT_CHANNEL_ID);
            if (ch) ch.send(`New VIP here! ${newMember}`);
        }
    }
});

client.login(process.env.Bot_Token);
