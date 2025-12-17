// =====================================================
// Gosu Custom Discord Bot (Refactored & English)
// Discord.js v14 + MongoDB Leveling + Config/Blacklist
// =====================================================
require("dotenv").config();

const fs = require("fs");
const path = require("path");

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
  Collection,
} = require("discord.js");

const { MongoClient } = require("mongodb");

// -----------------------------
// IN-MEMORY CONFIG (Loaded from MongoDB)
// -----------------------------
let BOT_CONFIG = {
  actionLogChannelId: null,
  msgLogChannelId: null,
  modLogChannelId: null,
  filterLogChannelId: null,
};

let BLACKLISTED_WORDS = [];

// ----------------------------------------------------
// ROLE IDs
// ----------------------------------------------------
const GOSU_ROLE = "496717793388134410";
const MOD_ROLE = "495727371140202506";
const ADMIN_ROLE = "495718851288236032";
const SUB_ROLE = "497654614729031681";

// ★ SILVER ROLE ID (Level 10 Reward)
// Users with this role can bypass the GIF/Link filter.
const SILVER_ROLE_ID = "497491254838427674"; 

// ----------------------------------------------------
// VOICE CHANNEL CREATOR CONFIG
// ----------------------------------------------------
const CREATE_CHANNEL_IDS = ["720658789832851487", "1441159364298936340"];
const TEMP_VOICE_CHANNEL_IDS = new Set();

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
const FILTER_EXEMPT_ROLES = [MOD_ROLE, ADMIN_ROLE];

// ----------------------------------------------------
// MONGODB & LEVELING CONFIG
// ----------------------------------------------------
const XP_CONFIG = {
  minXP: 5,
  maxXP: 15,
  cooldownMs: 30000,
};

const LEVEL_ROLES = [
  { level: 5, roleId: "497843968151781378" },
  { level: 10, roleId: SILVER_ROLE_ID }, // Level 10 is Silver
  { level: 20, roleId: "687470373331402752" },
  { level: 30, roleId: "497578834376392724" },
  { level: 40, roleId: "1441513975161294889" },
  { level: 50, roleId: "523184440491638795" },
  { level: 70, roleId: "542051690195451907" },
  { level: 80, roleId: "1441514153855422556" },
  { level: 100, roleId: "1441514648275779685" },
  { level: 150, roleId: "1441518689290817646" },
];

const mongoClient = new MongoClient(process.env.MONGODB_URI);
let xpCollection = null;
let configCollection = null;
let blacklistCollection = null;

const xpCooldowns = new Map();

// ----------------------------------------------------
// MongoDB Connection
// ----------------------------------------------------
async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn("[MONGO] MONGODB_URI is not set. MongoDB features are disabled.");
    return;
  }

  try {
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB_NAME || "gosuBot";
    const db = mongoClient.db(dbName);
    xpCollection = db.collection("user_xp");
    configCollection = db.collection("bot_config");
    blacklistCollection = db.collection("blacklist");

    console.log(`[MONGO] Connected to MongoDB database '${dbName}'.`);
  } catch (err) {
    console.error("[MONGO] Failed to connect to MongoDB:", err);
  }
}

// ----------------------------------------------------
// MongoDB: BOT_CONFIG load/save
// ----------------------------------------------------
async function loadConfigFromMongo() {
  if (!configCollection) {
    console.warn("[CONFIG] configCollection not ready; using default BOT_CONFIG.");
    return;
  }
  try {
    const doc = await configCollection.findOne({ _id: "global" });
    if (doc) {
      BOT_CONFIG = {
        actionLogChannelId: doc.actionLogChannelId || null,
        msgLogChannelId: doc.msgLogChannelId || null,
        modLogChannelId: doc.modLogChannelId || null,
        filterLogChannelId: doc.filterLogChannelId || null,
      };
      console.log("[CONFIG] Loaded BOT_CONFIG from MongoDB.");
    } else {
      await configCollection.insertOne({
        _id: "global",
        ...BOT_CONFIG,
      });
      console.log("[CONFIG] No existing BOT_CONFIG found. Created default.");
    }
  } catch (err) {
    console.error("[CONFIG] Error loading BOT_CONFIG:", err);
  }
}

async function saveConfigToMongo() {
  if (!configCollection) return;
  try {
    await configCollection.updateOne(
      { _id: "global" },
      { $set: BOT_CONFIG },
      { upsert: true }
    );
    console.log("[CONFIG] Saved BOT_CONFIG to MongoDB.");
  } catch (err) {
    console.error("[CONFIG] Error saving BOT_CONFIG:", err);
  }
}

// ----------------------------------------------------
// MongoDB: BLACKLIST load/seeding
// ----------------------------------------------------
async function loadBlacklistFromMongo() {
  if (!blacklistCollection) {
    console.warn("[BLACKLIST] Collection not ready.");
    BLACKLISTED_WORDS = [];
    return;
  }

  try {
    const doc = await blacklistCollection.findOne({ _id: "global" });

    if (doc && Array.isArray(doc.words)) {
      BLACKLISTED_WORDS = doc.words.map((w) => String(w).toLowerCase().trim());
      console.log(`[BLACKLIST] Loaded ${BLACKLISTED_WORDS.length} words from MongoDB.`);
      return;
    }

    const BLACKLIST_FILE_PATH = path.join(__dirname, "Data", "blacklist.json");

    if (fs.existsSync(BLACKLIST_FILE_PATH)) {
      console.log(`[BLACKLIST] Mongo empty -> importing from file.`);
      const raw = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
      let arr = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
      } catch (err) {}

      BLACKLISTED_WORDS = arr.map((w) => String(w).toLowerCase().trim());
      await blacklistCollection.updateOne(
        { _id: "global" },
        { $set: { words: BLACKLISTED_WORDS } },
        { upsert: true }
      );
      console.log(`[BLACKLIST] Seeded ${BLACKLISTED_WORDS.length} words from file.`);
      return;
    }

    await blacklistCollection.updateOne(
      { _id: "global" },
      { $setOnInsert: { words: [] } },
      { upsert: true }
    );
    BLACKLISTED_WORDS = [];
  } catch (err) {
    console.error("[BLACKLIST] Error loading blacklist:", err);
    BLACKLISTED_WORDS = [];
  }
}

// ----------------------------------------------------
// MongoDB Blacklist Helpers
// ----------------------------------------------------
async function addBlacklistWord(word) {
  if (!blacklistCollection) return;
  const clean = String(word).toLowerCase().trim();
  if (!clean) return;
  try {
    await blacklistCollection.updateOne(
      { _id: "global" },
      { $addToSet: { words: clean } },
      { upsert: true }
    );
  } catch (err) { console.error("[MONGO] Failed to add word:", err); }
}

async function removeBlacklistWord(word) {
  if (!blacklistCollection) return;
  const clean = String(word).toLowerCase().trim();
  if (!clean) return;
  try {
    await blacklistCollection.updateOne(
      { _id: "global" },
      { $pull: { words: clean } }
    );
  } catch (err) { console.error("[MONGO] Failed to remove word:", err); }
}

// ====================================================
// XP / LEVEL SYSTEM
// ====================================================
function getRequiredXpForLevel(level) {
  return 200 * level + 100;
}

function getTotalXpForLevel(level) {
  if (level <= 0) return 0;
  return 100 * level * level - 100;
}

function getLevelFromTotalXp(totalXp) {
  let L = 0;
  while (totalXp >= getTotalXpForLevel(L + 1)) {
    L++;
  }
  return L;
}

// ===================== XP GAIN LOGIC =====================
async function handleXpGain(message) {
  if (!xpCollection) return;

  const member = message.member;
  const user = message.author;
  if (!member || !message.guild || user.bot) return;

  const guildId = message.guild.id;
  const userId = user.id;
  const key = `${guildId}:${userId}`;

  // Cooldown
  const now = Date.now();
  const last = xpCooldowns.get(key) || 0;
  if (now - last < XP_CONFIG.cooldownMs) return;
  xpCooldowns.set(key, now);

  // Random XP gain
  const xpGain =
    Math.floor(Math.random() * (XP_CONFIG.maxXP - XP_CONFIG.minXP + 1)) +
    XP_CONFIG.minXP;

  try {
    const filter = { guildId, userId };
    const update = {
      $setOnInsert: { guildId, userId, level: 0 },
      $inc: { xp: xpGain },
    };

    const result = await xpCollection.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
    });

    const data = result.value;
    if (!data) return;

    const totalXp = data.xp || 0;
    const oldLevel = data.level || 0;
    const newLevel = getLevelFromTotalXp(totalXp);

    if (newLevel <= oldLevel) return;

    // Update level in DB
    await xpCollection.updateOne(filter, { $set: { level: newLevel } });

    // Role assignment
    for (const entry of LEVEL_ROLES) {
      if (
        oldLevel < entry.level &&
        newLevel >= entry.level &&
        message.guild.roles.cache.has(entry.roleId)
      ) {
        try {
          await member.roles.add(entry.roleId);

          // ★ SILVER ROLE NOTIFICATION
          // If the user just unlocked the Silver Role (Level 10), send a special message.
          if (entry.roleId === SILVER_ROLE_ID) {
            const silverEmbed = new EmbedBuilder()
              .setColor("#C0C0C0") // Silver color
              .setTitle("🥈 Silver Rank Achieved!")
              .setDescription(
                `Congratulations ${member}! You have reached **Level 10**.\n` +
                "✅ You can now use **GIFs and External Emojis** in chat!"
              )
              .setFooter({ text: "Gosu General TV — Rank System" })
              .setTimestamp();
            
            await message.channel.send({ embeds: [silverEmbed] });
          }

        } catch (err) {
          console.error(`[LEVEL] Failed to assign role ${entry.roleId}:`, err.message);
        }
      }
    }

    const levelEmbed = new EmbedBuilder()
      .setColor("#00FF7F")
      .setTitle("✨ Level Up!")
      .setDescription(
        `> ${member} has reached **Level ${newLevel}**!\n` +
          "Keep chatting to gain more experience."
      )
      .setFooter({ text: "Gosu General TV — Level System" })
      .setTimestamp();

    await message.channel.send({ embeds: [levelEmbed] });
  } catch (err) {
    console.error("[LEVEL] Error processing XP:", err);
  }
}

// ----------------------------------------------------
// Helper: Moderation Log
// ----------------------------------------------------
async function sendModLog(guild, user, action, moderator, reason, duration) {
  if (!BOT_CONFIG.modLogChannelId) return;

  const logChannel = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setColor(
      action === "BAN" ? "#B22222" : action === "KICK" ? "#FF4500" : "#4169E1"
    )
    .setTitle(`🔨 User ${action}`)
    .addFields(
      { name: "Target", value: `${user.tag} (${user.id})`, inline: false },
      { name: "Moderator", value: `${moderator.tag} (${moderator.id})`, inline: true },
      { name: "Reason", value: reason || "Not specified", inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Action: ${action}` });

  if (duration) {
    logEmbed.addFields({ name: "Duration", value: `${duration} minutes`, inline: true });
  }

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) => console.error("[ERROR] Error sending mod log:", err));
}

// --------------------
// Client
// --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

client.commands = new Collection();

// --------------------
// Role helpers
// --------------------
function isModerator(member) {
  if (!member) return false;
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(ADMIN_ROLE) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

function isAdmin(member) {
  if (!member) return false;
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// --------------------
// Ready
// --------------------
client.once("ready", async () => {
  console.log(`[BOT] Bot logged in as ${client.user.tag}`);
  await connectMongo();
  await loadConfigFromMongo();
  await loadBlacklistFromMongo();
});

// =====================================================
// VOICE CHANNEL CREATOR
// =====================================================
client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  // Create Voice Channel
  if (newState.channelId && CREATE_CHANNEL_IDS.includes(newState.channelId)) {
    const member = newState.member;
    const createChannel = newState.channel;
    const category = createChannel ? createChannel.parent : null;

    if (!member || !category) return;

    if (
      !guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
      !guild.members.me.permissions.has(PermissionsBitField.Flags.MoveMembers)
    ) {
      console.error("Bot lacks 'Manage Channels' or 'Move Members' permission.");
      return;
    }

    try {
      const newChannelName = `🎧 ${member.user.username}'s VO`;

      const newChannel = await guild.channels.create({
        name: newChannelName,
        type: ChannelType.GuildVoice,
        parent: category,
        userLimit: 5,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionsBitField.Flags.Connect],
            deny: [PermissionsBitField.Flags.ManageChannels],
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MuteMembers,
              PermissionsBitField.Flags.DeafenMembers,
              PermissionsBitField.Flags.MoveMembers,
            ],
          },
        ],
      });

      TEMP_VOICE_CHANNEL_IDS.add(newChannel.id);
      await member.voice.setChannel(newChannel);
      console.log(`Created temporary VO for ${member.user.tag}: ${newChannel.name}`);
    } catch (error) {
      console.error("Failed to create temporary VO:", error);
    }
  }

  // Delete Voice Channel
  if (oldState.channelId && !CREATE_CHANNEL_IDS.includes(oldState.channelId)) {
    const oldChannel = oldState.channel;
    if (!oldChannel) return;

    if (TEMP_VOICE_CHANNEL_IDS.has(oldChannel.id) && oldChannel.members.size === 0) {
      try {
        await oldChannel.delete();
        TEMP_VOICE_CHANNEL_IDS.delete(oldChannel.id);
        console.log(`Deleted empty VO channel: ${oldChannel.name}`);
      } catch (error) {
        console.error(`Failed to delete VO channel (${oldChannel.name}):`, error.message);
      }
    }
  }
});

// =====================================================
// PREFIX COMMANDS & CHAT FILTER + LEVELING
// =====================================================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();
  const isCommand = cmd && cmd.startsWith("!");
  const member = message.member;

  // ---------------- CHAT FILTER ----------------
  // NOTE: Users with SILVER_ROLE_ID are now exempt from the filter (can use GIFs)
  const isExempt =
    isCommand ||
    FILTER_EXEMPT_ROLES.some((roleId) => member.roles.cache.has(roleId)) ||
    member.roles.cache.has(SILVER_ROLE_ID); 

  if (!isExempt) {
    let foundLinkFilterMatch = null;
    const normalizedMessage = message.content.toLowerCase();

    // Invite Filter
    if (normalizedMessage.includes("discord.gg/") && !normalizedMessage.includes("discord.gg/gosugeneral")) {
        foundLinkFilterMatch = "Unpermitted Discord Invite";
    }
    // OnlyFans Filter
    else if (normalizedMessage.includes("onlyfans") || normalizedMessage.includes("only fans")) {
        foundLinkFilterMatch = "Explicit Content (OnlyFans)";
    }
    
    // General URL Filter (Blocks GIFs/Links unless exempt)
    const hasGeneralUrl = /(https?:\/\/)?(www\.)?(\w+)\.(\w+)/.test(normalizedMessage);

    if (!foundLinkFilterMatch && hasGeneralUrl) {
      const safeDomains = ["youtube.com", "youtu.be", "twitch.tv", "google.com", "naver.com"];
      if (!safeDomains.some((domain) => normalizedMessage.includes(domain))) {
        foundLinkFilterMatch = "Unpermitted General URL";
      }
    }

    if (foundLinkFilterMatch) {
      // Log the deletion
      if (BOT_CONFIG.msgLogChannelId) {
        const logChannel = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#FF00FF")
            .setTitle("🚨 Filter Detected (Deleted)")
            .addFields(
              { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
              { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
              { name: "Reason", value: foundLinkFilterMatch, inline: true },
              { name: "Content", value: message.content.substring(0, 1024), inline: false }
            )
            .setTimestamp();
          logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      // Delete message
      if (message.deletable) message.delete().catch(() => {});

      const warningMessage = await message.channel.send(
        `**${member}** Your message was removed because it contained an unpermitted link or pattern: **${foundLinkFilterMatch}**.`
      );
      setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
      return;
    }

    // Blacklist Word Check
    for (const raw of BLACKLISTED_WORDS) {
      if (message.content.toLowerCase().includes(raw)) {
         // Log
         if (BOT_CONFIG.filterLogChannelId) {
            const logChannel = message.guild.channels.cache.get(BOT_CONFIG.filterLogChannelId);
            if(logChannel) {
                const embed = new EmbedBuilder().setColor("#FF0000").setTitle("🚨 Blacklist Word")
                    .setDescription(`User: ${message.author}\nWord: ${raw}`);
                logChannel.send({ embeds: [embed] }).catch(() => {});
            }
         }
         // Delete
         if (message.deletable) message.delete().catch(() => {});
         const warn = await message.channel.send(`**${member}** Watch your language! Forbidden word detected.`);
         setTimeout(() => warn.delete().catch(() => {}), 7000);
         return;
      }
    }
  }

  // XP gain (non-bots only)
  if (!message.author.bot) {
    await handleXpGain(message);
  }

  if (!isCommand) return;

  // Cleanup command messages
  const NON_DELETING_COMMANDS = ["!ping", "!invite", "!rank", "!level", "!leaderboard"];
  if (!NON_DELETING_COMMANDS.includes(cmd)) {
    setTimeout(() => {
      if (!message.deleted) message.delete().catch(() => {});
    }, 1000);
  }

  // Admin/Mod Command Checks
  const adminOnly = ["!clearmsglog", "!setmodlog", "!clearmodlog", "!ban", "!reloadblacklist", "!clearactionlog", "!setmsglog", "!setactionlog", "!setfilterlog", "!clearfilterlog", "!setupjoin", "!welcome", "!subscriber", "!creator", "!syncrolexp"];
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      const reply = await message.reply("⛔ Only **Admins/Developers** can use this command.");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }
  }

  const modOnly = ["!kick", "!mute", "!unmute", "!addword", "!removeword", "!listwords", "!freeze", "!unfreeze"];
  if (modOnly.includes(cmd)) {
      if (!isModerator(message.member)) {
          const reply = await message.reply("⛔ Only **Moderators** can use this command.");
          setTimeout(() => reply.delete().catch(() => {}), 1000);
          return;
      }
  }

  // ---------------- RANK COMMAND ----------------
  if (cmd === "!rank") {
    if (!xpCollection) return message.reply("⚠ Level system is not ready.");

    const targetMember = message.mentions.members.first() || message.member;
    const guildId = message.guild.id;
    const userId = targetMember.id;

    const data = await xpCollection.findOne({ guildId, userId });
    if (!data) {
      return message.reply(
        targetMember.id === message.author.id
          ? "You don't have any XP yet. Start chatting to earn some!"
          : `${targetMember.user.username} doesn't have any XP yet.`
      );
    }

    const totalXp = data.xp || 0;
    const currentLevel = data.level || 0;
    
    // XP Calculation
    const prevLevelTotalXp = getTotalXpForLevel(currentLevel);
    const nextLevelTotalXp = getTotalXpForLevel(currentLevel + 1);
    const xpIntoLevel = totalXp - prevLevelTotalXp;
    const xpNeededThisLevel = Math.max(nextLevelTotalXp - prevLevelTotalXp, 1);

    let progress = xpIntoLevel / xpNeededThisLevel;
    progress = Math.max(0, Math.min(1, progress));

    const totalBars = 20;
    const filledBars = Math.round(progress * totalBars);
    const emptyBars = totalBars - filledBars;
    const bar = "█".repeat(filledBars) + "░".repeat(emptyBars);

    const rank = (await xpCollection.countDocuments({ guildId, xp: { $gt: totalXp } })) + 1;
    const totalUsers = await xpCollection.countDocuments({ guildId });

    const rankEmbed = new EmbedBuilder()
      .setColor("#00D1FF")
      .setTitle(`📊 ${targetMember.user.username}'s Rank`)
      .setThumbnail(targetMember.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🧬 Level", value: `${currentLevel}`, inline: true },
        { name: "⭐ Total XP", value: `${totalXp}`, inline: true },
        { name: "🏆 Rank", value: `#${rank} of ${totalUsers}`, inline: true },
        { name: "📈 Progress", value: `\`${bar}\`\n${xpIntoLevel} / ${xpNeededThisLevel} XP`, inline: false }
      )
      .setFooter({ text: "Gosu General TV — Rank System" })
      .setTimestamp();

    await message.channel.send({ embeds: [rankEmbed] });
    return;
  }

  // ---------------- LEVEL COMMAND ----------------
  if (cmd === "!level") {
    const embed = new EmbedBuilder()
      .setColor("#32CD32")
      .setTitle("🎯 Level Rewards")
      .setDescription("Earn XP by chatting and unlock roles!");

    for (const entry of LEVEL_ROLES) {
      const role = message.guild.roles.cache.get(entry.roleId);
      if (role) {
        embed.addFields({ name: `Level ${entry.level}`, value: role.name, inline: true });
      }
    }
    
    // Check next reward for user
    const data = await xpCollection.findOne({ guildId: message.guild.id, userId: message.author.id });
    if(data) {
        const nextReward = LEVEL_ROLES.find(e => e.level > data.level);
        if(nextReward) {
            const r = message.guild.roles.cache.get(nextReward.roleId);
            embed.addFields({ name: "Next Unlock", value: `At Level ${nextReward.level}: ${r ? r.name : 'Unknown'}`, inline: false });
        }
    }

    embed.setFooter({ text: "Level System" }).setTimestamp();
    await message.channel.send({ embeds: [embed] });
    return;
  }

  // ---------------- LEADERBOARD COMMAND ----------------
  if (cmd === "!leaderboard") {
    if (!xpCollection) return message.reply("⚠ DB not ready.");

    try {
      const topUsers = await xpCollection
        .find({ guildId: message.guild.id })
        .sort({ xp: -1 })
        .limit(10)
        .toArray();

      if (!topUsers || topUsers.length === 0) return message.reply("No leaderboard data yet.");

      let description = "";
      topUsers.forEach((user, index) => {
        const memberTop = message.guild.members.cache.get(user.userId);
        const username = memberTop ? memberTop.user.username : `User-${user.userId}`;
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
        description += `${medal} **${username}** — Lv ${user.level} (${user.xp} XP)\n`;
      });

      const lbEmbed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 Server Leaderboard")
        .setDescription(description)
        .setFooter({ text: "Top 10 Chatters" })
        .setTimestamp();

      await message.channel.send({ embeds: [lbEmbed] });
    } catch (err) { console.error(err); }
    return;
  }

  // ---------------- PING ----------------
  if (cmd === "!ping") return message.reply("Pong!");

  // ---------------- FREEZE / UNFREEZE ----------------
  if (cmd === "!freeze" || cmd === "!unfreeze") {
    const targetChannel = message.mentions.channels.first() || message.channel;
    const isFreeze = cmd === "!freeze";
    
    try {
        await targetChannel.permissionOverwrites.edit(message.guild.id, {
            SendMessages: isFreeze ? false : null
        });
        const msg = isFreeze 
            ? `🔒 Channel **${targetChannel.name}** has been frozen.` 
            : `✅ Channel **${targetChannel.name}** has been unfrozen.`;
        message.channel.send(msg);
    } catch (err) { console.error(err); }
    return;
  }

  // ---------------- LOG CONFIG COMMANDS ----------------
  if (["!setmodlog", "!setmsglog", "!setactionlog", "!setfilterlog"].includes(cmd)) {
      const channel = message.mentions.channels.first() || message.channel;
      if(cmd === "!setmodlog") BOT_CONFIG.modLogChannelId = channel.id;
      if(cmd === "!setmsglog") BOT_CONFIG.msgLogChannelId = channel.id;
      if(cmd === "!setactionlog") BOT_CONFIG.actionLogChannelId = channel.id;
      if(cmd === "!setfilterlog") BOT_CONFIG.filterLogChannelId = channel.id;
      
      await saveConfigToMongo();
      message.reply(`✅ Log channel updated for ${cmd}.`);
      return;
  }

  // ---------------- BLACKLIST COMMANDS ----------------
  if (cmd === "!addword") {
    const newWord = args.slice(1).join(" ").toLowerCase();
    if(!newWord) return;
    await addBlacklistWord(newWord);
    await loadBlacklistFromMongo();
    message.reply(`✅ Added word to blacklist.`);
    return;
  }

  if (cmd === "!removeword") {
      const word = args.slice(1).join(" ").toLowerCase();
      if(!word) return;
      await removeBlacklistWord(word);
      await loadBlacklistFromMongo();
      message.reply(`✅ Removed word from blacklist.`);
      return;
  }
});

// =====================================================
// BUTTON INTERACTIONS
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "agree_rules") {
    const member = interaction.member;
    try {
      if (!member.roles.cache.has(GOSU_ROLE)) {
        await member.roles.add(GOSU_ROLE);
      }
      await interaction.reply({
        content: "✅ Rules accepted! You now have access to the server.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[ERROR] Failed to assign role:", err);
      interaction.reply({ content: "❌ Error assigning role.", ephemeral: true });
    }
    return;
  }

  if (interaction.customId === "subscribe_toggle") {
    const member = interaction.member;
    const hasSubRole = member.roles.cache.has(SUB_ROLE);

    try {
      if (hasSubRole) {
        await member.roles.remove(SUB_ROLE);
        await interaction.reply({
          content: "🔕 **Unsubscribed from Live Notifications.**",
          ephemeral: true,
        });
      } else {
        await member.roles.add(SUB_ROLE);
        await interaction.reply({
          content: "🔔 **Subscribed to Live Notifications!**",
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("[ERROR] Toggle role error:", err);
      interaction.reply({ content: "❌ Error toggling role.", ephemeral: true });
    }
  }
});

// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);
