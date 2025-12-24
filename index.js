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
  ActivityType
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
// Message Handler, Filters, General Commands
// =====================================================================

// ---------------------------------------------------------------------
// 6. MAIN MESSAGE HANDLER
// ---------------------------------------------------------------------
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const content = message.content.trim();
  const isCommand = content.startsWith("!");
  const isMod = isModerator(message.member);

  // 1. FILTERS (Only for non-mods and non-commands)
  if (!isMod && !isCommand) {
    const lowerContent = content.toLowerCase();
    
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
    
    await handleXpGain(message);
    return;
  }

  // 2. XP PROCESSING
  if (!isCommand) {
    await handleXpGain(message);
    return;
  }

  // 3. COMMAND PARSING
  const args = content.slice(1).split(/ +/);
  const cmd = args.shift().toLowerCase();

  const keepMessages = ["ping", "invite", "rank", "leaderboard", "level", "help"];
  if (!keepMessages.includes(cmd)) {
    setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
  }

  // --- GENERAL COMMANDS ---

  if (cmd === "ping") return message.reply("Pong!");
  if (cmd === "invite") return message.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");

  // [UPDATED] !help - Mute Description Changed
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("#00FFFF")
      .setTitle("🤖 Gosu Bot Command List")
      .setDescription("Here is the full list of available commands.")
      .addFields(
        { name: "🌐 General", value: "`!rank` — Check your (or others') rank & XP\n`!leaderboard` — View Top 10 users\n`!level` — View level rewards\n`!invite` — Get server invite link", inline: false },
        // Updated Mute Line Below: [min] means optional
        { name: "🛡️ Moderation (Mod Only)", value: "`!kick <@user>` — Kick a user\n`!mute <@user> [min]` — Timeout (Default: 3m)\n`!unmute <@user>` — Remove timeout\n`!freeze` / `!unfreeze` — Lock/Unlock channel\n`!prune <n>` — Delete <n> messages\n`!addword <word>` / `!removeword` — Manage blacklist", inline: false },
        { name: "⚙️ Admin & Setup (Admin Only)", value: "`!ban <@user>` — Ban a user\n`!syncrolexp` — Sync XP based on roles\n`!reloadblacklist` — Reload bad words from DB\n\n**Panels:**\n`!setupjoin` — Rules Panel\n`!welcome` — Welcome Panel\n`!subscriber` — Notification Panel\n`!creator` — Creator Verify Panel", inline: false },
        { name: "📝 Log & Welcome", value: "`!setwelcome #ch` — Set Welcome Channel\n`!setmodlog #ch` / `!clearmodlog`\n`!setmsglog #ch` / `!clearmsglog`\n`!setactionlog #ch` / `!clearactionlog`", inline: false }
      )
      .setFooter({ text: "Gosu General TV" });
    return message.channel.send({ embeds: [embed] });
  }

  if (cmd === "rank") {
    let targetMember;
    if (message.mentions.members.size > 0) targetMember = message.mentions.members.first();
    else if (args.length > 0) {
        const search = args.join(" ").toLowerCase();
        targetMember = message.guild.members.cache.find(m => m.user.username.toLowerCase().includes(search) || (m.nickname && m.nickname.toLowerCase().includes(search)));
    } else targetMember = message.member;

    if (!targetMember) return message.reply("❌ User not found.");

    const data = await xpCollection.findOne({ guildId: message.guild.id, userId: targetMember.id });
    if (!data) return message.reply(`❌ No XP data for **${targetMember.user.username}**.`);

    const currentLevel = data.level || 0;
    const rank = (await xpCollection.countDocuments({ guildId: message.guild.id, xp: { $gt: data.xp } })) + 1;
    
    // XP Calculation
    const nextLevelBaseXp = getTotalXpForLevel(currentLevel + 1);
    const currentLevelBaseXp = getTotalXpForLevel(currentLevel);
    const xpIntoLevel = data.xp - currentLevelBaseXp;
    const xpNeeded = nextLevelBaseXp - currentLevelBaseXp;
    
    const percent = Math.min(Math.max(xpIntoLevel / xpNeeded, 0), 1);
    const percentText = Math.floor(percent * 100);
    const bar = "█".repeat(Math.round(percent * 15)) + "░".repeat(15 - Math.round(percent * 15));

    const nextReward = LEVEL_ROLES.find(r => r.level > currentLevel);
    let rewardText = "🎉 Max Level Reached!";
    if (nextReward) {
        const xpLeft = (getTotalXpForLevel(nextReward.level)) - data.xp;
        rewardText = `**${xpLeft.toLocaleString()} XP** left until **Lv ${nextReward.level}**`;
    }

    const embed = new EmbedBuilder()
      .setColor(targetMember.displayHexColor === "#000000" ? "#9B59B6" : targetMember.displayHexColor)
      .setAuthor({ name: `${targetMember.user.username}'s Rank`, iconURL: targetMember.user.displayAvatarURL() })
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🧬 Level", value: `${currentLevel}`, inline: true },
        { name: "🏆 Rank", value: `#${rank}`, inline: true },
        { name: "⭐ XP", value: `${data.xp.toLocaleString()}`, inline: true },
        { name: "📈 Progress", value: `${bar} **${percentText}%**\n${xpIntoLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: false },
        { name: "🎁 Next Reward", value: rewardText, inline: false }
      );
    return message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  if (cmd === "leaderboard") {
    const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
    if (!top.length) return message.reply("📉 No data.");
    
    let topMember;
    try { topMember = await message.guild.members.fetch(top[0].userId); } catch (e) { topMember = null; }

    let list = "";
    for (let i = 0; i < top.length; i++) {
        let prefix = `#${i+1}`;
        if (i===0) prefix="🥇"; if(i===1) prefix="🥈"; if(i===2) prefix="🥉";
        let member = message.guild.members.cache.get(top[i].userId);
        if (!member) { try { member = await message.guild.members.fetch(top[i].userId); } catch (e) { member = null; } }
        const name = member ? member.user.username : "Unknown User";
        const xpK = (top[i].xp / 1000).toFixed(1) + "k";
        list += `${prefix} **${name}** — Lv ${top[i].level} (${xpK} XP)\n`;
    }
    const embed = new EmbedBuilder().setColor("#FFD700").setTitle("🏆 Leaderboard").setThumbnail(topMember?.user.displayAvatarURL({ dynamic: true }) || null).setDescription(list);
    return message.channel.send({ embeds: [embed] });
  }

  if (cmd === "level") {
    const d = await xpCollection.findOne({ guildId: message.guild.id, userId: message.author.id });
    const userLvl = d ? d.level : 0;
    const list = LEVEL_ROLES.map(r => {
        const icon = userLvl >= r.level ? "✅" : "🔒";
        const roleStr = message.guild.roles.cache.has(r.roleId) ? `<@&${r.roleId}>` : `@${r.name}`;
        return `${icon} **Lv ${r.level}** — ${roleStr}`;
    }).join("\n");
    return message.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("🎯 Level Rewards").setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setDescription(`**Your Level: ${userLvl}**\n\n${list}`)] });
  }
// =====================================================================
// Gosu Custom Discord Bot (Final Version - Part 4)
// Admin Panels, Moderation, Events, Login (VIP Role Check Corrected)
// =====================================================================

  // --- ADMIN PANEL COMMANDS ---
  if (cmd === "setupjoin" && isAdmin(message.member)) {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅"));
    await message.channel.send({ files: [BANNERS.RULES] });
    const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Community!")
        .setDescription("Here you can join events, get updates, talk with the community, and enjoy the content together.\n\n--------------------------------------------------\n\n📜 **Server Rules**\n\n✨ **1 – Be Respectful**\nTreat everyone kindly. No harassment, bullying, or toxicity.\n\n✨ **2 – No Spam**\nAvoid repeated messages, emoji spam, or unnecessary mentions.\n\n✨ **3 – No NSFW or Harmful Content**\nNo adult content, gore, or anything unsafe.\n\n✨ **4 – No Advertising**\nNo links, promos, or self-promotion without staff approval.\n\n✨ **5 – Keep it Clean**\nNo hate speech, slurs, or extreme drama.\n\n✨ **6 – Follow Staff Instructions**\nIf staff gives instructions, please follow them.\n\n--------------------------------------------------\nPress **Agree To Rules** below to enter and enjoy the server! 🎊");
    message.channel.send({ embeds: [embed], components: [row] });
  }

  if (cmd === "welcome" && isAdmin(message.member)) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("YouTube Channel").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu"),
        new ButtonBuilder().setLabel("Twitch Channel").setStyle(ButtonStyle.Link).setURL("https://twitch.tv/gosugeneral"),
        new ButtonBuilder().setLabel("Invite Link").setStyle(ButtonStyle.Link).setURL("https://discord.gg/gosugeneral")
    );
    await message.channel.send({ files: [BANNERS.WELCOME] });
    const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Discord Server!")
        .setDescription("Greetings, adventurer!\n\nWelcome to the **Gosu General TV** community server.\nHere you can hang out with the community, share plays, ask questions, receive announcements, and join events together.\n\n---\n\n📌 **What you can find here**\n\n• Live stream notifications & announcements\n• Game discussions and guides\n• Clips, highlights, and community content\n• Chill chat with other Gosu viewers\n\n---\nEnjoy your stay and have fun! 💙")
        .addFields({ name: "Official Links", value: "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://twitch.tv/gosugeneral)", inline: true }, { name: "Discord Invite Link", value: "🔗 [Invite Link](https://discord.gg/gosugeneral)", inline: true });
    message.channel.send({ embeds: [embed], components: [row] });
  }

  if (cmd === "subscriber" && isAdmin(message.member)) {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Subscribe / Unsubscribe").setStyle(ButtonStyle.Primary).setEmoji("🔔"));
    await message.channel.send({ files: [BANNERS.NOTI] });
    const embed = new EmbedBuilder().setColor("#FF0000").setTitle("🔔 Live Notification Subscription")
        .setDescription("Stay updated with **Live Streams** and **New Uploads**!\n\nBy subscribing, you will receive:\n• 🔴 Live stream alerts\n• 🆕 New YouTube upload notifications\n• 📢 Special announcements\n\n---\n\n📌 **How It Works**\n\n• Press once → **Subscribe**\n• Press again → **Unsubscribe**\n\n---\nEnjoy real-time updates and never miss a stream! 💙").setFooter({ text: "Gosu General TV — Notification System" });
    message.channel.send({ embeds: [embed], components: [row] });
  }

  if (cmd === "creator" && isAdmin(message.member)) {
    await message.channel.send({ files: [BANNERS.CREATOR] });
    const embed = new EmbedBuilder().setColor("#FFB347").setTitle("👑 Creator Role – Automatic Verification")
        .setDescription("Hello, creators! This panel explains how to obtain the **Creator** role and access exclusive creator-only channels.\n\nOur Creator role is granted through **Discord's automatic verification system**, based on your connected accounts.\n\n--------------------------------------------\n### 1️⃣ Required Conditions\nTo receive the Creator role, at least **one** connected account must meet **all** requirements below:\n\n**Supported Platforms:**\n• TikTok / YouTube / Twitch / Facebook\n\n**Requirements:**\n• The account must be **connected** to your Discord profile\n• The account must be **verified** (e.g., phone verification)\n• Minimum **100 followers/subscribers**\n• Must be following **100+ users**\n• At least **10 likes or activity records**\n\n--------------------------------------------\n### 2️⃣ How to Connect Your Account to Discord\n1. Open **User Settings** (gear icon ⚙️ bottom-left)\n2. Select **Connections**\n3. Click **Add Connection**\n4. Choose TikTok / YouTube / Twitch / Facebook, then log in and link your account\n\n--------------------------------------------\n### 3️⃣ Automatic Creator Role Assignment\n• After linking and meeting the requirements, Discord automatically verifies your account.\n• Please wait a moment; syncing account data may take some time.\n• Once approved, the **Creator** role will appear and channels like **#creator-chat** will become available.\n\n--------------------------------------------\n### ⚠️ Troubleshooting\n**Didn't receive the role?**\n• Ensure your linked account meets *all* requirements\n• Refresh Discord with **Ctrl + R** (Windows) or **Cmd + R** (Mac)\n\n**Need help?**\nDM an admin if you're experiencing issues or have questions.")
        .setFooter({ text: "Gosu General TV — Creator Role Guide" });
    message.channel.send({ embeds: [embed] });
  }

  // --- MODERATION ---
  if (cmd === "kick" && isMod) { 
      const t = message.mentions.members.first(); 
      if(t?.kickable) { 
          await t.kick(); 
          message.reply(`👢 Kicked **${t.user.username}**.`); 
          
          if(BOT_CONFIG.modLogChannelId) {
             const ch = message.guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
             if(ch) {
                 const embed = new EmbedBuilder()
                    .setColor("#FF8C00") 
                    .setAuthor({ name: "Member Kicked", iconURL: t.user.displayAvatarURL() })
                    .setThumbnail(t.user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: "User", value: `${t.user.tag} (${t.user.id})`, inline: true },
                        { name: "Moderator", value: `${message.author.tag}`, inline: true },
                        { name: "Reason", value: args.slice(1).join(" ") || "No reason provided", inline: false }
                    )
                    .setTimestamp();
                 ch.send({ embeds: [embed] });
             }
          }
      } 
  }

  if (cmd === "ban" && isAdmin(message.member)) { 
      const t = message.mentions.members.first(); 
      if(t?.bannable) { 
          await t.ban(); 
          message.reply(`🔨 Banned **${t.user.username}**.`); 
          
          if(BOT_CONFIG.modLogChannelId) {
             const ch = message.guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
             if(ch) {
                 const embed = new EmbedBuilder()
                    .setColor("#8B0000") 
                    .setAuthor({ name: "Member Banned", iconURL: t.user.displayAvatarURL() })
                    .setThumbnail(t.user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: "User", value: `${t.user.tag} (${t.user.id})`, inline: true },
                        { name: "Moderator", value: `${message.author.tag}`, inline: true },
                        { name: "Reason", value: args.slice(1).join(" ") || "No reason provided", inline: false }
                    )
                    .setTimestamp();
                 ch.send({ embeds: [embed] });
             }
          }
      } 
  }
  
  if (cmd === "mute" && isMod) { 
      const t = message.mentions.members.first(); 
      const m = parseInt(args[1]) || 3; 
      if(t) { 
          await t.timeout(m*60000); 
          message.reply(`🔇 Muted **${t.user.username}** for ${m}m.`); 
          
          if(BOT_CONFIG.modLogChannelId) {
             const ch = message.guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
             if(ch) {
                 const embed = new EmbedBuilder()
                    .setColor("#FFD700") 
                    .setAuthor({ name: "Member Muted", iconURL: t.user.displayAvatarURL() })
                    .setThumbnail(t.user.displayAvatarURL({ dynamic: true })) 
                    .addFields(
                        { name: "User", value: `${t.user.tag} (${t.user.id})`, inline: true },
                        { name: "Duration", value: `${m} minutes`, inline: true },
                        { name: "Moderator", value: `${message.author.tag}`, inline: true }
                    )
                    .setTimestamp();
                 ch.send({ embeds: [embed] });
             }
          }
      } 
  }
  
  if (cmd === "unmute" && isMod) { 
      const t = message.mentions.members.first(); 
      if(t) { 
          await t.timeout(null); 
          message.reply(`🔊 Unmuted **${t.user.username}**.`); 
      } 
  }
  
  if (cmd === "freeze" && isMod) { 
      message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false }); 
      message.channel.send("❄️ **The chat has been frozen.** Everyone, please cool down for a moment."); 
  }
  if (cmd === "unfreeze" && isMod) { 
      message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null }); 
      message.channel.send("♨️ **The freeze has been lifted.**"); 
  }

  if (cmd === "addword" && isMod) { 
      const w = args.join(" ").toLowerCase(); 
      if(w) { 
          BLACKLISTED_WORDS.push(w); 
          await saveBlacklist(); 
          message.reply("Added to Blacklist."); 
      } 
  }
  
  if (cmd === "removeword" && isMod) { 
      const w = args.join(" ").toLowerCase(); 
      BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(x => x !== w); 
      await saveBlacklist(); 
      message.reply("Removed from Blacklist."); 
  }

  if (cmd === "syncrolexp" && isAdmin(message.member)) {
    message.reply("🔄 Syncing..."); 
    let c = 0;
    for (const r of LEVEL_ROLES) { 
        const role = message.guild.roles.cache.get(r.roleId); 
        if (!role) continue; 
        for (const [id, m] of role.members) { 
            await xpCollection.updateOne({ guildId: message.guild.id, userId: id }, { $set: { level: r.level, xp: getTotalXpForLevel(r.level) } }, { upsert: true }); 
            c++; 
        } 
    }
    message.channel.send(`✅ Synced **${c}** users.`);
  }

  // --- LOG & WELCOME CONFIG ---
  if (cmd.startsWith("set") && isAdmin(message.member)) {
    const ch = message.mentions.channels.first() || message.channel;
    
    if (cmd === "setwelcome") { 
        BOT_CONFIG.welcomeChannelId = ch.id; 
        await saveConfig(); 
        message.reply(`✅ Welcome messages set to ${ch}`); 
    }
    if (cmd === "setmodlog") { 
        BOT_CONFIG.modLogChannelId = ch.id; 
        await saveConfig(); 
        message.reply(`✅ Mod Log set to ${ch}`); 
    }
    if (cmd === "setmsglog") { 
        BOT_CONFIG.msgLogChannelId = ch.id; 
        await saveConfig(); 
        message.reply(`✅ Msg Log set to ${ch}`); 
    }
    if (cmd === "setactionlog") { 
        BOT_CONFIG.actionLogChannelId = ch.id; 
        await saveConfig(); 
        message.reply(`✅ Action Log set to ${ch}`); 
    }
  }

}); // Closes Part 3's messageCreate

// ---------------------------------------------------------------------
// 7. EVENTS & LOGIN
// ---------------------------------------------------------------------
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  try {
    if (i.customId === "agree_rules") { 
        await i.member.roles.add(GOSU_ROLE); 
        i.reply({ content: "✅ Welcome to the server!", ephemeral: true }); 
    }
    else if (i.customId === "subscribe_toggle") { 
        const has = i.member.roles.cache.has(SUB_ROLE); 
        if (has) await i.member.roles.remove(SUB_ROLE); 
        else await i.member.roles.add(SUB_ROLE); 
        i.reply({ content: has ? "🔕 Unsubscribed." : "🔔 Subscribed!", ephemeral: true }); 
    }
  } catch (e) {}
});

client.on("messageDelete", async (m) => {
    if (!m.guild || m.author.bot) return;
    if (!BOT_CONFIG.msgLogChannelId) return;

    const ch = m.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (!ch) return;

    const embed = new EmbedBuilder()
        .setColor("#FF4500") 
        .setAuthor({ name: "Message Deleted", iconURL: "https://cdn-icons-png.flaticon.com/512/3405/3405244.png" }) 
        .setThumbnail(m.author.displayAvatarURL({ dynamic: true })) 
        .addFields(
            { name: "User", value: `${m.author.username} (${m.author.id})`, inline: false },
            { name: "Channel", value: `${m.channel}`, inline: false },
            { name: "Content", value: m.content || "*[Image/No Text]*", inline: false }
        )
        .setFooter({ text: "Message Deleted" })
        .setTimestamp();

    ch.send({ embeds: [embed] }).catch(() => {});
});

client.on("guildMemberRemove", async (m) => {
    if(!BOT_CONFIG.actionLogChannelId) return;
    const ch = m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
    
    if(ch) {
        const embed = new EmbedBuilder()
            .setColor("#FF4500") 
            .setAuthor({ name: "Member Left", iconURL: m.user.displayAvatarURL() })
            .setThumbnail(m.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`${m} ${m.user.username}`)
            .setFooter({ text: `ID: ${m.id}` })
            .setTimestamp();
        
        ch.send({ embeds: [embed] }).catch(()=>{});
    }
});

client.on("guildMemberAdd", async (m) => {
    // 1. Action Log
    if(BOT_CONFIG.actionLogChannelId) {
        const ch = m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
        if(ch) {
            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setAuthor({ name: "Member Joined", iconURL: m.user.displayAvatarURL() })
                .setThumbnail(m.user.displayAvatarURL({ dynamic: true })) 
                .setDescription(`${m} ${m.user.username}`)
                .setFooter({ text: `ID: ${m.id}` })
                .setTimestamp();
            ch.send({ embeds: [embed] }).catch(()=>{});
        }
    }

    // 2. Welcome Card
    if(BOT_CONFIG.welcomeChannelId) {
        const ch = m.guild.channels.cache.get(BOT_CONFIG.welcomeChannelId);
        if(ch) {
            const embed = new EmbedBuilder()
                .setColor("#2f3136") 
                .setAuthor({ name: "Welcome to the server!" })
                .setDescription(`Let's all welcome ${m} !`)
                .setThumbnail(m.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setImage(BANNERS.WELCOME)
                .setFooter({ text: `${m.guild.name} • Member #${m.guild.memberCount}` })
                .setTimestamp();
            
            await ch.send({ content: `Welcome to the server, ${m}!`, embeds: [embed] }).catch(()=>{});
        }
    }
});

// [UPDATED] VIP WELCOME MESSAGE (Using IDs from Part 1)
client.on("guildMemberUpdate", (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    
    // Check if Twitch or Youtube VIP role was added
    if (addedRoles.has(TWITCH_VIP_ROLE_ID) || addedRoles.has(YOUTUBE_VIP_ROLE_ID)) {
        if (VIP_CHAT_CHANNEL_ID) {
            const ch = newMember.guild.channels.cache.get(VIP_CHAT_CHANNEL_ID);
            if (ch) ch.send(`New VIP here! ${newMember}`);
        }
    }
});

client.login(process.env.Bot_Token);
