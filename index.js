// =====================================================
// Gosu Custom Discord Bot (Final Build - All Features Merged)
// Discord.js v14 + MongoDB Leveling + MongoDB Config/Blacklist
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

// ----------------------------------------------------
// VOICE CHANNEL CREATOR CONFIG
// ----------------------------------------------------
const CREATE_CHANNEL_IDS = ["720658789832851487", "1441159364298936340"];

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
  { level: 10, roleId: "497491254838427674" },
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
// Mongo 연결
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
      const {
        actionLogChannelId = null,
        msgLogChannelId = null,
        modLogChannelId = null,
        filterLogChannelId = null,
      } = doc;

      BOT_CONFIG = {
        actionLogChannelId,
        msgLogChannelId,
        modLogChannelId,
        filterLogChannelId,
      };

      console.log("[CONFIG] Loaded BOT_CONFIG from MongoDB.");
    } else {
      await configCollection.insertOne({
        _id: "global",
        ...BOT_CONFIG,
      });
      console.log(
        "[CONFIG] No existing BOT_CONFIG found in MongoDB. Created default document."
      );
    }
  } catch (err) {
    console.error("[CONFIG] Error loading BOT_CONFIG from MongoDB:", err);
  }
}

async function saveConfigToMongo() {
  if (!configCollection) {
    console.warn("[CONFIG] configCollection not ready; cannot save BOT_CONFIG.");
    return;
  }
  try {
    await configCollection.updateOne(
      { _id: "global" },
      {
        $set: {
          actionLogChannelId: BOT_CONFIG.actionLogChannelId,
          msgLogChannelId: BOT_CONFIG.msgLogChannelId,
          modLogChannelId: BOT_CONFIG.modLogChannelId,
          filterLogChannelId: BOT_CONFIG.filterLogChannelId,
        },
      },
      { upsert: true }
    );
    console.log("[CONFIG] Saved BOT_CONFIG to MongoDB.");
  } catch (err) {
    console.error("[CONFIG] Error saving BOT_CONFIG to MongoDB:", err);
  }
}

// ----------------------------------------------------
// MongoDB: BLACKLIST load/seeding
// ----------------------------------------------------
async function loadBlacklistFromMongo() {
  if (!blacklistCollection) {
    console.warn("[BLACKLIST] blacklistCollection not ready; using empty blacklist.");
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
      console.log(`[BLACKLIST] Mongo empty -> importing from ${BLACKLIST_FILE_PATH}`);

      const raw = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
      let arr = [];

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
      } catch (err) {
        console.error("[BLACKLIST] Failed to parse blacklist.json:", err);
      }

      BLACKLISTED_WORDS = arr.map((w) => String(w).toLowerCase().trim());

      await blacklistCollection.updateOne(
        { _id: "global" },
        { $set: { words: BLACKLISTED_WORDS } },
        { upsert: true }
      );

      console.log(
        `[BLACKLIST] Seeded ${BLACKLISTED_WORDS.length} words from file into MongoDB`
      );
      return;
    }

    await blacklistCollection.updateOne(
      { _id: "global" },
      { $setOnInsert: { words: [] } },
      { upsert: true }
    );

    BLACKLISTED_WORDS = [];
    console.log("[BLACKLIST] No data. Initialized empty MongoDB blacklist.");
  } catch (err) {
    console.error("[BLACKLIST] Error loading blacklist:", err);
    BLACKLISTED_WORDS = [];
  }
}

// ----------------------------------------------------
// MongoDB Blacklist Helpers (permanent save)
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
  } catch (err) {
    console.error("[MONGO] Failed to add blacklist word:", err);
  }
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
  } catch (err) {
    console.error("[MONGO] Failed to remove blacklist word:", err);
  }
}

// ----------------------------------------------------
// XP 계산
// ----------------------------------------------------
function getRequiredXpForLevel(level) {
  return 100 * level * level + 100;
}

async function handleXpGain(message) {
  if (!xpCollection) return;
  const member = message.member;
  const user = message.author;

  if (!member || !message.guild || user.bot) return;

  const guildId = message.guild.id;
  const userId = user.id;
  const key = `${guildId}:${userId}`;

  const now = Date.now();
  const last = xpCooldowns.get(key) || 0;
  if (now - last < XP_CONFIG.cooldownMs) return;
  xpCooldowns.set(key, now);

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

    let currentLevel = data.level || 0;
    let newLevel = currentLevel;
    let requiredXp = getRequiredXpForLevel(newLevel + 1);

    while (data.xp >= requiredXp && newLevel < 1000) {
      xp -= requiredXp;
      newLevel++;
      requiredXp = getRequiredXpForLevel(newLevel + 1);
    }

    if (newLevel === currentLevel) return;

    await xpCollection.updateOne(filter, { $set: { level: newLevel } });

    for (const entry of LEVEL_ROLES) {
      if (
        currentLevel < entry.level &&
        newLevel >= entry.level &&
        message.guild.roles.cache.has(entry.roleId)
      ) {
        try {
          await member.roles.add(entry.roleId);
        } catch (err) {
          console.error(
            `[LEVEL] Failed to assign role ${entry.roleId} to ${user.tag}:`,
            err.message
          );
        }
      }
    }

    const levelEmbed = new EmbedBuilder()
      .setColor("#00FF7F")
      .setTitle("✨ Level Up!")
      .setDescription(
        `> ${member} has reached **Level ${newLevel}**!\n` +
          "Keep chatting and participating to gain more experience."
      )
      .setFooter({ text: "Gosu General TV — Level System" })
      .setTimestamp();

    await message.channel.send({ embeds: [levelEmbed] });
  } catch (err) {
    console.error("[LEVEL] Error while processing XP:", err);
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
      {
        name: "Moderator",
        value: `${moderator.tag} (${moderator.id})`,
        inline: true,
      },
      {
        name: "Reason",
        value: reason || "Not specified",
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: `Action: ${action}` });

  if (duration) {
    logEmbed.addFields({
      name: "Duration",
      value: `${duration} minutes`,
      inline: true,
    });
  }

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) => console.error("[ERROR] Error sending mod log:", err));
}

// ----------------------------------------------------
// BANNERS
// ----------------------------------------------------
const RULES_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
const WELCOME_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
const NOTIFICATION_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c985f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";
const CREATOR_BANNER_URL =
  "https://media.discordapp.net/attachments/495719121686626323/1441312962903015576/verification.png?format=webp&quality=lossless&width=818&height=180";

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

  if (newState.channelId && CREATE_CHANNEL_IDS.includes(newState.channelId)) {
    const member = newState.member;
    const createChannel = newState.channel;
    const category = createChannel ? createChannel.parent : null;

    if (!member || !category) return;

    if (
      !guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      ) ||
      !guild.members.me.permissions.has(
        PermissionsBitField.Flags.MoveMembers
      )
    ) {
      console.error(
        "Bot lacks 'Manage Channels' or 'Move Members' permission for VO Creator."
      );
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

      await member.voice.setChannel(newChannel);
      console.log(
        `Created and moved ${member.user.tag} to temporary VO channel: ${newChannel.name}`
      );
    } catch (error) {
      console.error(
        "Failed to create or move user to temporary VO channel:",
        error
      );
    }
  }

  if (oldState.channelId && !CREATE_CHANNEL_IDS.includes(oldState.channelId)) {
    const oldChannel = oldState.channel;
    if (!oldChannel) return;

    const isTemporaryChannel =
      oldChannel.name.includes("'s VO") ||
      oldChannel.name.toLowerCase().endsWith("vo");

    if (isTemporaryChannel && oldChannel.members.size === 0) {
      console.log(
        `Attempting to delete empty temporary VO channel: ${oldChannel.name}`
      );
      try {
        await oldChannel.delete();
        console.log(
          `Successfully deleted empty temporary VO channel: ${oldChannel.name}`
        );
      } catch (error) {
        console.error(
          `🔴 Failed to delete empty temporary VO channel (${oldChannel.name}):`,
          error.message
        );
        console.error(
          "CHECK BOT PERMISSIONS: Bot needs 'Manage Channels' permission."
        );
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
  const isExempt =
    isCommand ||
    FILTER_EXEMPT_ROLES.some((roleId) => member.roles.cache.has(roleId));

  if (!isExempt) {
    let foundLinkFilterMatch = null;
    const normalizedMessage = message.content.toLowerCase();

    const allowedInvites = ["discord.gg/gosugeneral", "discord.gg/xgxD5hB"];
    const inviteMatches = normalizedMessage.match(/(discord\.gg)\/(\w+)/g);
    const containsDiscordInvite = inviteMatches?.length > 0;
    const isAllowedInvite = allowedInvites.some((invite) =>
      normalizedMessage.includes(invite)
    );

    if (containsDiscordInvite && !isAllowedInvite) {
      foundLinkFilterMatch = "Unpermitted Discord Invite";
    } else if (
      normalizedMessage.includes("only fans") ||
      normalizedMessage.includes("onlyfans")
    ) {
      foundLinkFilterMatch = "Explicit Content Keyword (OnlyFans)";
    }

    const generalUrlMatches = normalizedMessage.match(
      /(https?:\/\/)?(www\.)?(\w+)\.(\w+)\/(\w)+/g
    );
    const hasGeneralUrl =
      normalizedMessage.includes("http") || generalUrlMatches?.length > 0;

    if (!foundLinkFilterMatch && hasGeneralUrl) {
      const safeDomains = [
        "youtube.com",
        "youtu.be",
        "twitch.tv",
        "google.com",
        "naver.com",
      ];

      if (!safeDomains.some((domain) => normalizedMessage.includes(domain))) {
        foundLinkFilterMatch = "Unpermitted General URL";
      }
    }

    if (foundLinkFilterMatch) {
      if (BOT_CONFIG.msgLogChannelId) {
        const logChannel = message.guild.channels.cache.get(
          BOT_CONFIG.msgLogChannelId
        );
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#FF00FF")
            .setTitle("🚨 Enhanced Filter Detected (Deleted)")
            .addFields(
              {
                name: "User",
                value: `${message.author.tag} (${message.author.id})`,
                inline: false,
              },
              {
                name: "Channel",
                value: `<#${message.channel.id}>`,
                inline: true,
              },
              {
                name: "Reason",
                value: foundLinkFilterMatch,
                inline: true,
              },
              {
                name: "Content",
                value: message.content.substring(0, 1024),
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: "Message Filtered" });

          logChannel
            .send({ embeds: [logEmbed] })
            .catch((err) =>
              console.error(
                "[ERROR] Error sending enhanced filter log:",
                err
              )
            );
        }
      }

      if (
        message.guild.members.me.permissions.has(
          PermissionsBitField.Flags.ManageMessages
        )
      ) {
        if (!message.deleted) {
          message.delete().catch((err) => {
            console.error(`Failed to delete message: ${message.id}`, err);
          });
        }
      } else {
        console.error(
          "Bot lacks 'Manage Messages' permission to delete filtered messages."
        );
      }

      const warningMessage = await message.channel.send(
        `**${member}** Your message was removed because it contained an unpermitted link or pattern: **${foundLinkFilterMatch}**.`
      );
      setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
      return;
    }

    const normalizedContentExisting = message.content
      .normalize("NFC")
      .toLowerCase();

    const simplifiedContent = normalizedContentExisting.replace(
      /[^가-힣a-z0-9\s]/g,
      ""
    );

    let foundWord = null;

    for (const raw of BLACKLISTED_WORDS) {
      const word = String(raw).toLowerCase().trim();
      if (!word) continue;

      const hasHangul = /[가-힣]/.test(word);

      if (hasHangul) {
        const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, "");
        if (simplifiedWord.length < 2) continue;

        const contentWithoutSpaces = simplifiedContent.replace(/\s/g, "");

        if (contentWithoutSpaces.includes(simplifiedWord)) {
          foundWord = word;
          break;
        }

        const contentWords = simplifiedContent
          .split(/\s+/)
          .filter((w) => w.length > 0);

        if (contentWords.some((w) => w.includes(simplifiedWord))) {
          foundWord = word;
          break;
        }
      } else {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!escaped) continue;

        const regex = new RegExp(`\\b${escaped}\\b`, "i");

        if (regex.test(normalizedContentExisting)) {
          foundWord = word;
          break;
        }
      }
    }

    if (foundWord) {
      const logChannelId =
        BOT_CONFIG.filterLogChannelId || BOT_CONFIG.msgLogChannelId;

      if (logChannelId) {
        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#FF00FF")
            .setTitle("🚨 Forbidden Word Detected (Deleted)")
            .addFields(
              {
                name: "User",
                value: `${message.author.tag} (${message.author.id})`,
                inline: false,
              },
              {
                name: "Channel",
                value: `<#${message.channel.id}>`,
                inline: true,
              },
              {
                name: "Matched Word",
                value: `\`${foundWord}\``,
                inline: true,
              },
              {
                name: "Content",
                value: message.content.substring(0, 1024),
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: "Message Filtered" });

          logChannel
            .send({ embeds: [logEmbed] })
            .catch((err) =>
              console.error("[ERROR] Error sending filter log:", err)
            );
        }
      }

      if (
        message.guild.members.me.permissions.has(
          PermissionsBitField.Flags.ManageMessages
        )
      ) {
        if (!message.deleted) {
          message.delete().catch((err) => {
            console.error(`Failed to delete message: ${message.id}`, err);
          });
        }
      } else {
        console.error(
          "Bot lacks 'Manage Messages' permission to delete filtered messages."
        );
      }

      const warningMessage = await message.channel.send(
        `**${member}** Watch your language! Your message contained a blacklisted word and has been removed.`
      );
      setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
      return;
    }
  }

  if (!message.author.bot) {
    await handleXpGain(message);
  }

  if (!isCommand) return;

  const NON_DELETING_COMMANDS = [
    "!ping",
    "!invite",
    "!rank",
    "!level",
    "!leaderboard",
  ];

  if (!NON_DELETING_COMMANDS.includes(cmd)) {
    setTimeout(() => {
      if (!message.deleted) {
        message.delete().catch(() => {});
      }
    }, 1000);
  }

  const adminOnly = [
    "!clearmsglog",
    "!setmodlog",
    "!clearmodlog",
    "!ban",
    "!reloadblacklist",
    "!clearactionlog",
    "!setmsglog",
    "!setactionlog",
    "!setfilterlog",
    "!clearfilterlog",
    "!setupjoin",
    "!welcome",
    "!subscriber",
    "!creator",
    "!syncrolexp",
  ];
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      const reply = await message.reply(
        "⛔ Only **Admins/Developers** can use this command."
      );
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }
  }

  // ---------------- RANK / LEVEL / LB ----------------
  if (cmd === "!rank") {
    if (!xpCollection) {
      return message.reply(
        "⚠ Level system is not ready. Try again in a moment."
      );
    }

    const guild = message.guild;

    const targetMember =
      message.mentions.members.first() || message.member;

    if (!targetMember) {
      return message.reply("⚠ Could not find that user.");
    }

    const userId = targetMember.id;
    const guildId = guild.id;

    const data = await xpCollection.findOne({ guildId, userId });
    if (!data) {
      return message.reply(
        targetMember.id === message.author.id
          ? "You don't have any XP yet. Start chatting to earn some!"
          : `${targetMember.user.username} doesn't have any XP yet.`
      );
    }

    const currentLevel = data.level || 0;

    const currentLevelXp =
      currentLevel > 0 ? getRequiredXpForLevel(currentLevel) : 0;
    const nextLevelXp = getRequiredXpForLevel(currentLevel + 1);

    const xpIntoLevel = data.xp - currentLevelXp;
    const xpNeededThisLevel = Math.max(nextLevelXp - currentLevelXp, 1);

    let progress = xpIntoLevel / xpNeededThisLevel;
    progress = Math.max(0, Math.min(1, progress));

    const totalBars = 20;
    const filledBars = Math.round(progress * totalBars);
    const emptyBars = totalBars - filledBars;
    const bar =
      "█".repeat(filledBars > 0 ? filledBars : 0) +
      "░".repeat(emptyBars > 0 ? emptyBars : 0);

    const rank =
      (await xpCollection.countDocuments({
        guildId,
        xp: { $gt: data.xp },
      })) + 1;

    const totalUsers = await xpCollection.countDocuments({ guildId });

    const nextReward = LEVEL_ROLES.find((entry) => entry.level > currentLevel);
    let nextUnlockText = "";
    if (nextReward) {
      const nextRole = guild.roles.cache.get(nextReward.roleId);
      if (nextRole) {
        nextUnlockText = `At **Level ${nextReward.level}** you will earn role: **${nextRole.name}**`;
      } else {
        nextUnlockText = `Next reward at **Level ${nextReward.level}**`;
      }
    } else {
      nextUnlockText = "You have unlocked all available level roles!";
    }

    let color = "#00D1FF";
    if (currentLevel >= 100) color = "#FF1493";
    else if (currentLevel >= 70) color = "#FFD700";
    else if (currentLevel >= 40) color = "#9B59B6";
    else if (currentLevel >= 20) color = "#1ABC9C";

    const rankEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📊 ${targetMember.user.username}'s Rank`)
      .setThumbnail(targetMember.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🧬 Level", value: `${currentLevel}`, inline: true },
        { name: "⭐ XP", value: `${data.xp} / ${nextLevelXp}`, inline: true },
        {
          name: "🏆 Rank",
          value: `#${rank} of ${totalUsers}`,
          inline: true,
        },
        {
          name: "📈 Progress to Next Level",
          value: `\`${bar}\`\n${xpIntoLevel} / ${xpNeededThisLevel} XP`,
          inline: false,
        },
        { name: "🎁 Next Reward", value: nextUnlockText, inline: false }
      )
      .setFooter({
        text: "Gosu General TV — Rank System",
        iconURL: message.author.displayAvatarURL({ size: 128 }),
      })
      .setTimestamp();

    await message.channel.send({ embeds: [rankEmbed] });
    return;
  }

  if (cmd === "!level") {
    const embed = new EmbedBuilder()
      .setColor("#32CD32")
      .setTitle("🎯 Level Rewards")
      .setDescription("Earn XP by chatting and unlock roles as you level up!");

    for (const entry of LEVEL_ROLES) {
      const role = message.guild.roles.cache.get(entry.roleId);
      if (role) {
        embed.addFields({
          name: `Level ${entry.level}`,
          value: role.name,
          inline: true,
        });
      }
    }

    const userId = message.author.id;
    const guildId = message.guild.id;
    const data = await xpCollection.findOne({ guildId, userId });

    if (data) {
      const currentLevel = data.level || 0;
      const nextReward = LEVEL_ROLES.find(
        (entry) => entry.level > currentLevel
      );

      if (nextReward) {
        const nextRole = message.guild.roles.cache.get(nextReward.roleId);
        if (nextRole) {
          embed.addFields({
            name: "Next Unlock",
            value: `At **Level ${nextReward.level}** you will earn role: **${nextRole.name}**`,
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: "Max Rewards",
          value: "You have unlocked all available level roles!",
          inline: false,
        });
      }
    }

    embed
      .setFooter({ text: "Gosu General TV — Level System" })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (cmd === "!leaderboard") {
    if (!xpCollection) {
      return message.reply(
        "⚠ Level system is not ready. Try again in a moment."
      );
    }

    const guild = message.guild;
    const guildId = guild.id;
    const userId = message.author.id;

    let topUsers;
    try {
      topUsers = await xpCollection
        .find({ guildId })
        .sort({ xp: -1 })
        .limit(10)
        .toArray();
    } catch (err) {
      console.error("[LEADERBOARD] DB error:", err);
      return message.reply(
        "⚠ Failed to load leaderboard. Please try again later."
      );
    }

    if (!topUsers || topUsers.length === 0) {
      return message.reply("No leaderboard data yet.");
    }

    let description = "";
    topUsers.forEach((user, index) => {
      const memberTop = guild.members.cache.get(user.userId);
      const username = memberTop ? memberTop.user.username : `<@${user.userId}>`;
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;

      description += `${medal} **${username}** — Level ${user.level} (${user.xp} XP)\n`;
    });

    const selfData = await xpCollection.findOne({ guildId, userId });
    let selfRankText = "";

    if (selfData) {
      const rank =
        (await xpCollection.countDocuments({
          guildId,
          xp: { $gt: selfData.xp },
        })) + 1;

      if (!topUsers.some((u) => u.userId === userId)) {
        selfRankText = `\n👤 You are currently **#${rank}** — Level ${selfData.level} (${selfData.xp} XP)`;
      } else {
        selfRankText = `\n👤 You are in the **Top 10!** Great job!`;
      }
    } else {
      selfRankText = "\n👤 You don't have any XP yet. Start chatting!";
    }

    const topUser = topUsers[0];
    const topMember = guild.members.cache.get(topUser.userId);
    const topAvatar = topMember
      ? topMember.user.displayAvatarURL({ size: 256 })
      : guild.iconURL({ size: 256 });

    const lbEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 Server Leaderboard (Top 10)")
      .setDescription(description + selfRankText)
      .setThumbnail(topAvatar)
      .setFooter({
        text: "Gosu General TV — Leaderboard",
        iconURL: message.author.displayAvatarURL({ size: 128 }),
      })
      .setTimestamp();

    await message.channel.send({ embeds: [lbEmbed] });
    return;
  }

  const modOnly = [
    "!kick",
    "!mute",
    "!unmute",
    "!prune",
    "!addrole",
    "!removerole",
    "!addword",
    "!removeword",
    "!listwords",
    "!freeze",
    "!unfreeze",
  ];
  if (modOnly.includes(cmd)) {
    if (!isModerator(message.member)) {
      const reply = await message.reply(
        "⛔ Only **Moderators** can use this command."
      );
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }
  }

  // ---------------- LOG CHANNEL SETUP ----------------
  const logCommands = {
    "!setactionlog": { key: "actionLogChannelId", type: "ACTION" },
    "!clearactionlog": { key: "actionLogChannelId", type: "ACTION" },
    "!setmsglog": { key: "msgLogChannelId", type: "MESSAGE" },
    "!clearmsglog": { key: "msgLogChannelId", type: "MESSAGE" },
    "!setmodlog": { key: "modLogChannelId", type: "MODERATION" },
    "!clearmodlog": { key: "modLogChannelId", type: "MODERATION" },
    "!setfilterlog": { key: "filterLogChannelId", type: "FILTER" },
    "!clearfilterlog": { key: "filterLogChannelId", type: "FILTER" },
  };

  if (logCommands[cmd]) {
    const { key, type } = logCommands[cmd];

    if (cmd.startsWith("!set")) {
      let channel =
        args.length === 1
          ? message.channel
          : message.mentions.channels.first() ||
            message.guild.channels.cache.get(args[1]);

      if (!channel || channel.type !== ChannelType.GuildText) {
        const reply = await message.reply(
          `Usage: \`${cmd}\` (in log channel) or \`${cmd} #channel\``
        );
        setTimeout(() => reply.delete().catch(() => {}), 3000);
        return;
      }

      BOT_CONFIG[key] = channel.id;
      await saveConfigToMongo();

      const reply = await message.reply(
        `✅ **${type} Log** channel set to **${channel.name}**.`
      );
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    } else {
      if (!BOT_CONFIG[key]) {
        const reply = await message.reply(
          `⚠ **${type} Log** channel is not currently set.`
        );
        setTimeout(() => reply.delete().catch(() => {}), 3000);
        return;
      }
      BOT_CONFIG[key] = null;
      await saveConfigToMongo();

      const reply = await message.reply(
        `✅ **${type} Log** setting cleared.`
      );
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    }
    return;
  }

  if (cmd === "!ping") {
    return message.reply("Pong!");
  }

  // ---------------- FREEZE / UNFREEZE ----------------
  if (cmd === "!freeze") {
    const targetChannel =
      message.mentions.channels.first() || message.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      const reply = await message.reply(
        "Usage: `!freeze` (current channel) or `!freeze #channel`"
      );
      setTimeout(() => reply.delete().catch(() => {}), 3000);
      return;
    }

    const me = message.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const reply = await message.reply(
        "⚠ I need the **Manage Channels** permission to freeze this channel."
      );
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }

    try {
      await targetChannel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: false,
        SendMessagesInThreads: false,
      });

      const notice = await targetChannel.send(
        `🔒 This channel has been **frozen** by ${message.member}. Messages are temporarily disabled.`
      );

      if (targetChannel.id !== message.channel.id) {
        const reply = await message.reply(
          `✅ Channel **#${targetChannel.name}** has been frozen.`
        );
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }

      setTimeout(() => notice.delete().catch(() => {}), 30000);

      if (BOT_CONFIG.modLogChannelId) {
        const logChannel = message.guild.channels.cache.get(
          BOT_CONFIG.modLogChannelId
        );
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#00BFFF")
            .setTitle("❄️ Channel Frozen")
            .addFields(
              {
                name: "Channel",
                value: `<#${targetChannel.id}>`,
                inline: true,
              },
              {
                name: "Moderator",
                value: `${message.author.tag} (${message.author.id})`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({ text: "Freeze Command" });
          logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[FREEZE] Failed to freeze channel:", err);
      const reply = await message.reply(
        "❌ An error occurred while freezing the channel."
      );
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    return;
  }

  if (cmd === "!unfreeze") {
    const targetChannel =
      message.mentions.channels.first() || message.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      const reply = await message.reply(
        "Usage: `!unfreeze` (current channel) or `!unfreeze #channel`"
      );
      setTimeout(() => reply.delete().catch(() => {}), 3000);
      return;
    }

    const me = message.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const reply = await message.reply(
        "⚠ I need the **Manage Channels** permission to unfreeze this channel."
      );
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }

    try {
      await targetChannel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: null,
        SendMessagesInThreads: null,
      });

      const notice = await targetChannel.send(
        `✅ This channel has been **unfrozen** by ${message.member}. You can chat again.`
      );

      if (targetChannel.id !== message.channel.id) {
        const reply = await message.reply(
          `✅ Channel **#${targetChannel.name}** has been unfrozen.`
        );
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }

      setTimeout(() => notice.delete().catch(() => {}), 30000);

      if (BOT_CONFIG.modLogChannelId) {
        const logChannel = message.guild.channels.cache.get(
          BOT_CONFIG.modLogChannelId
        );
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#32CD32")
            .setTitle("♨️ Channel Unfrozen")
            .addFields(
              {
                name: "Channel",
                value: `<#${targetChannel.id}>`,
                inline: true,
              },
              {
                name: "Moderator",
                value: `${message.author.tag} (${message.author.id})`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({ text: "Unfreeze Command" });
          logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[UNFREEZE] Failed to unfreeze channel:", err);
      const reply = await message.reply(
        "❌ An error occurred while unfreezing the channel."
      );
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    return;
  }

  // ---------------- BLACKLIST COMMANDS ----------------
  if (cmd === "!addword") {
    const newWord = args.slice(1).join(" ").toLowerCase().trim();
    if (!newWord) {
      return message.reply("Usage: `!addword [word]`");
    }

    if (BLACKLISTED_WORDS.includes(newWord)) {
      return message.reply(`⚠ **${newWord}** is already in the blacklist.`);
    }

    BLACKLISTED_WORDS.push(newWord);
    await addBlacklistWord(newWord);

    return message.reply(
      `✅ Added **${newWord}** to the blacklist. (${BLACKLISTED_WORDS.length} total)`
    );
  }

  if (cmd === "!removeword") {
    const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
    if (!wordToRemove) {
      return message.reply("Usage: `!removeword [word]`");
    }

    const initialLength = BLACKLISTED_WORDS.length;
    BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(
      (word) => word !== wordToRemove
    );

    if (BLACKLISTED_WORDS.length === initialLength) {
      return message.reply(
        `⚠ **${wordToRemove}** was not found in the blacklist.`
      );
    }

    await removeBlacklistWord(wordToRemove);

    return message.reply(
      `✅ Removed **${wordToRemove}** from the blacklist. (${BLACKLISTED_WORDS.length} total)`
    );
  }

  if (cmd === "!listwords") {
    const listEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle(
        `🚫 Current Blacklisted Words (${BLACKLISTED_WORDS.length} total)`
      )
      .setDescription(
        BLACKLISTED_WORDS.length > 0
          ? BLACKLISTED_WORDS.slice(0, 50).join(", ") +
              (BLACKLISTED_WORDS.length > 50 ? "..." : "")
          : "No words currently blacklisted."
      )
      .setFooter({ text: "Showing the first 50 words." });

    return message.reply({ embeds: [listEmbed] });
  }

  if (cmd === "!reloadblacklist") {
    await loadBlacklistFromMongo();
    const reply = await message.reply(
      `✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from MongoDB.`
    );
    setTimeout(() => reply.delete().catch(() => {}), 1000);
    return;
  }

  // ---------------- PANELS & SYNC ----------------
  if (cmd === "!setupjoin") {
    const joinEmbed = new EmbedBuilder()
      .setColor("#1e90ff")
      .setTitle("✨ Welcome to the Gosu General TV Community!")
      .setDescription(
        [
          "Here you can join events, get updates, talk with the community, and enjoy the content together.",
          "",
          "--------------------------------------------------------",
          "### 📜 Server Rules",
          "✨ **1 – Be Respectful**",
          "Treat everyone kindly. No harassment, bullying, or toxicity.",
          "",
          "✨ **2 – No Spam**",
          "Avoid repeated messages, emoji spam, or unnecessary mentions.",
          "",
          "✨ **3 – No NSFW or Harmful Content**",
          "No adult content, gore, or anything unsafe.",
          "",
          "✨ **4 – No Advertising**",
          "No links, promos, or self-promotion without staff approval.",
          "",
          "✨ **5 – Keep it Clean**",
          "No hate speech, slurs, or extreme drama.",
          "",
          "✨ **6 – Follow Staff Instructions**",
          "If staff gives instructions, please follow them.",
          "--------------------------------------------------------",
          "Press **Agree To Rules** below to enter and enjoy the server! 🎊",
        ].join("\n")
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("agree_rules")
        .setLabel("Agree To Rules")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({
      files: [{ attachment: RULES_BANNER_URL, name: "must_read.png" }],
    });

    await message.channel.send({
      embeds: [joinEmbed],
      components: [buttons],
    });
    return;
  }

  if (cmd === "!syncrolexp") {
    if (!isAdmin(message.member)) {
      return message.reply("⛔ Only Admins can use this command.");
    }

    if (!xpCollection) {
      return message.reply("⚠ MongoDB is not connected. Try again later.");
    }

    const guild = message.guild;
    const guildId = guild.id;

    const userLevelMap = new Map();

    for (const entry of LEVEL_ROLES) {
      const role = guild.roles.cache.get(entry.roleId);
      if (!role) continue;

      for (const [memberId] of role.members) {
        const prev = userLevelMap.get(memberId) || 0;
        if (entry.level > prev) {
          userLevelMap.set(memberId, entry.level);
        }
      }
    }

    if (userLevelMap.size === 0) {
      return message.reply("⚠ No members with level roles were found.");
    }

    let updatedCount = 0;

    for (const [userId, level] of userLevelMap.entries()) {
      const xp = getRequiredXpForLevel(level);

      await xpCollection.updateOne(
        { guildId, userId },
        {
          $setOnInsert: { guildId, userId },
          $set: { level, xp },
        },
        { upsert: true }
      );

      updatedCount++;
    }

    await message.reply(
      `✅ Synced XP/Levels for **${updatedCount}** members based on their level roles.`
    );
    return;
  }

  if (cmd === "!welcome") {
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#1e90ff")
      .setTitle("✨ Welcome to the Gosu General TV Discord Server!")
      .setDescription(
        [
          "Greetings, adventurer!",
          "",
          "Welcome to the **Gosu General TV** community server.",
          "Here you can hang out with the community, share plays, ask questions,",
          "receive announcements, and join events together.",
          "",
          "---",
          "### 📌 What you can find here",
          "• Live stream notifications & announcements",
          "• Game discussions and guides",
          "• Clips, highlights, and community content",
          "• Chill chat with other Gosu viewers",
          "",
          "---",
          "Enjoy your stay and have fun! 💙",
        ].join("\n")
      )
      .addFields(
        {
          name: "Official Links",
          value:
            "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://www.twitch.tv/gosugeneraltv)",
          inline: true,
        },
        {
          name: "Discord Invite Link",
          value: "🔗 [Invite Link](https://discord.gg/gosugeneral)",
          inline: true,
        }
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("YouTube Channel")
        .setStyle(ButtonStyle.Link)
        .setURL("https://youtube.com/@Teamgosu"),
      new ButtonBuilder()
        .setLabel("Twitch Channel")
        .setStyle(ButtonStyle.Link)
        .setURL("https://www.twitch.tv/gosugeneraltv"),
      new ButtonBuilder()
        .setLabel("Invite Link")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/gosugeneral")
    );

    await message.channel.send({
      files: [{ attachment: WELCOME_BANNER_URL, name: "welcome.png" }],
    });

    await message.channel.send({
      embeds: [welcomeEmbed],
      components: [buttons],
    });
    return;
  }

  if (cmd === "!subscriber") {
    const memberAdmin = message.member;
    if (!isAdmin(memberAdmin)) {
      return message.reply(
        "❌ You do not have permission to use this command."
      );
    }

    await message.channel.send({
      files: [
        { attachment: NOTIFICATION_BANNER_URL, name: "notification.png" },
      ],
    });

    const subscriberEmbed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setTitle("🔔 Live Notification Subscription")
      .setDescription(
        [
          "Stay updated with **Live Streams** and **New Uploads**!",
          "",
          "By subscribing, you will receive:",
          "• 🔴 Live stream alerts",
          "• 🆕 New YouTube upload notifications",
          "• 📢 Special announcements",
          "",
          "---",
          "### 📌 How It Works",
          "• Press once → **Subscribe**",
          "• Press again → **Unsubscribe**",
          "",
          "---",
          "Enjoy real-time updates and never miss a stream! 💙",
        ].join("\n")
      )
      .setFooter({ text: "Gosu General TV – Notification System" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("subscribe_toggle")
        .setLabel("Subscribe / Unsubscribe")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [subscriberEmbed], components: [row] });
    return;
  }

  if (cmd === "!creator") {
    if (!isAdmin(member)) {
      return message.reply(
        "❌ You do not have permission to use this command."
      );
    }

    await message.channel.send({
      files: [{ attachment: CREATOR_BANNER_URL, name: "verification.png" }],
    });

    const creatorEmbed = new EmbedBuilder()
      .setColor("#FFB347")
      .setTitle("👑 Creator Role – Automatic Verification")
      .setDescription(
        [
          "Hello, creators! This panel explains how to obtain the **Creator** role and access exclusive creator-only channels.",
          "",
          "Our Creator role is granted through **Discord’s automatic verification system**, based on your connected accounts.",
          "",
          "--------------------------------------------",
          "### 1️⃣ Required Conditions",
          "To receive the Creator role, at least **one** connected account must meet **requirements** below:",
          "",
          "**Supported Platforms:**",
          "- TikTok / YouTube / Twitch / Facebook",
          "",
          "**Requirements:**",
          "- The account must be **connected** to your Discord profile",
          "- The account must be **verified** (e.g., phone verification)",
          "- Minimum **100 followers/subscribers**",
          "- Must be following **100+ users**",
          "- At least **10 likes or activity records**",
          "",
          "--------------------------------------------",
          "### 2️⃣ How to Connect Your Account to Discord",
          "1. Open **User Settings** (gear icon ⚙️ bottom-left)",
          "2. Select **Connections**",
          "3. Click **Add Connection**",
          "4. Choose TikTok / YouTube / Twitch / Facebook, then log in and link your account",
          "",
          "--------------------------------------------",
          "### 3️⃣ Automatic Creator Role Assignment",
          "- After linking and meeting the requirements, Discord automatically verifies your account.",
          "- Please wait a moment; syncing account data may take some time.",
          "- Once approved, the **Creator** role will appear and channels like **#creator-chat** will become available.",
          "",
          "--------------------------------------------",
          "### ⚠️ Troubleshooting",
          "**Didn't receive the role?**",
          "- Ensure your linked account meets *all* requirements",
          "- Refresh Discord with **Ctrl + R** (Windows) or **Cmd + R** (Mac)",
          "",
          "**Need help?**",
          "DM an admin if you're experiencing issues or have questions.",
        ].join("\n")
      )
      .setFooter({ text: "Gosu General TV — Creator Role Guide" });

    await message.channel.send({ embeds: [creatorEmbed] });

    return;
  }

  // ---------------- MOD COMMANDS ----------------
  if (cmd === "!ban") {
    const user = message.mentions.members?.first();
    if (!user) {
      await message.reply("Usage: `!ban @user [reason]`");
      return;
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.ban({ reason });
      sendModLog(message.guild, user.user, "BAN", message.author, reason);
      await message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
      return;
    } catch (err) {
      console.error("Ban error:", err);
      await message.reply("⚠ Failed to ban that user.");
      return;
    }
  }

  if (cmd === "!kick") {
    const user = message.mentions.members?.first();
    if (!user) {
      await message.reply("Usage: `!kick @user [reason]`");
      return;
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.kick(reason);
      sendModLog(message.guild, user.user, "KICK", message.author, reason);
      await message.reply(
        `👢 Kicked **${user.user.tag}**. Reason: ${reason}`
      );
      return;
    } catch (err) {
      console.error("Kick error:", err);
      await message.reply("⚠ Failed to kick that user.");
      return;
    }
  }

  if (cmd === "!mute") {
    const user = message.mentions.members?.first();
    const minutes = parseInt(args[2]) || 10;
    if (!user) {
      await message.reply("Usage: `!mute @user [minutes] [reason]`");
      return;
    }

    try {
      const reason =
        args.slice(3).join(" ") || `Muted by ${message.author.tag}`;
      await user.timeout(minutes * 60 * 1000, reason);
      sendModLog(
        message.guild,
        user.user,
        "MUTE",
        message.author,
        reason,
        minutes
      );
      await message.reply(
        `🔇 Muted **${user.user.tag}** for ${minutes} minutes.`
      );
      return;
    } catch (err) {
      console.error("Mute error:", err);
      await message.reply("⚠ Failed to mute that user.");
      return;
    }
  }

  if (cmd === "!unmute") {
    const user = message.mentions.members?.first();
    if (!user) {
      await message.reply("Usage: `!unmute @user`");
      return;
    }

    try {
      await user.timeout(null, `Unmuted by ${message.author.tag}`);
      sendModLog(
        message.guild,
        user.user,
        "UNMUTE",
        message.author,
        "Manual Unmute"
      );
      await message.reply(`🔊 Unmuted **${user.user.tag}**.`);
      return;
    } catch (err) {
      console.error("Unmute error:", err);
      await message.reply("⚠ Failed to unmute that user.");
      return;
    }
  }

  if (cmd === "!prune") {
    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100) {
      const reply = await message.reply("Usage: `!prune 1-100`");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    try {
      await message.channel.bulkDelete(amount, true);
      const m = await message.channel.send(
        `🧹 Deleted **${amount}** messages.`
      );
      setTimeout(() => m.delete().catch(() => {}), 1000);
    } catch (err) {
      console.error("Prune error:", err);
      const reply = await message.reply(
        "⚠ Could not delete messages (maybe older than 14 days)."
      );
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }
  }

  if (cmd === "!addrole") {
    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply("Usage: `!addrole @user RoleName`");
      return;
    }

    const roleName = args.slice(2).join(" ");
    if (!roleName) {
      await message.reply("Usage: `!addrole @user RoleName`");
      return;
    }

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) {
      await message.reply("⚠ Could not find that role.");
      return;
    }

    try {
      await target.roles.add(role);
      await message.reply(
        `✅ Added role **${role.name}** to **${target.user.tag}**.`
      );
      return;
    } catch (err) {
      console.error("Add role error:", err);
      await message.reply("⚠ Failed to add that role.");
      return;
    }
  }

  if (cmd === "!removerole") {
    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply("Usage: `!removerole @user RoleName`");
      return;
    }

    const roleName = args.slice(2).join(" ");
    if (!roleName) {
      await message.reply("Usage: `!removerole @user RoleName`");
      return;
    }

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) {
      await message.reply("⚠ Could not find that role.");
      return;
    }

    if (!target.roles.cache.has(role.id)) {
      await message.reply("⚠ That user does not have that role.");
      return;
    }

    try {
      await target.roles.remove(role);
      await message.reply(
        `❎ Removed role **${role.name}** from **${target.user.tag}**.`
      );
      return;
    } catch (err) {
      console.error("Remove role error:", err);
      await message.reply("⚠ Failed to remove that role.");
      return;
    }
  }

  if (cmd === "!invite") {
    return message.reply(
      "📨 **Server Invite:** https://discord.gg/gosugeneral"
    );
  }

  if (cmd === "!help" || cmd === "/?") {
    const help = new EmbedBuilder()
      .setColor("#00FFFF")
      .setTitle("Gosu Bot — Commands")
      .setDescription(
        [
          "**General**",
          "`!ping` — Check if the bot is online.",
          "`!invite` — Show the server invite link.",
          "`!rank` — View your current level, XP, and rank.",
          "`!leaderboard` — See the top 10 users by XP.",
          "`!level` — View level rewards and role unlocks.",
          "",
          "**Moderator Commands**",
          "`!kick @user [reason]` — Kick a user.",
          "`!mute @user [minutes] [reason]` — Timeout a user.",
          "`!unmute @user` — Remove timeout.",
          "`!freeze [#channel]` — Lock a channel so nobody can send messages.",
          "`!unfreeze [#channel]` — Unlock a frozen channel.",
          "`!addrole @user RoleName` — Add a role.",
          "`!removerole @user RoleName` — Remove a role.",
          "`!prune [1-100]` — Delete recent messages.",
          "`!addword [word]` — Add a word to the filter list.",
          "`!removeword [word]` — Remove a word from the filter list.",
          "`!listwords` — Show the current blacklisted words.",
          "",
          "**Admin Commands**",
          "`!setactionlog [#channel]` — Set channel for Join/Leave/Role changes log.",
          "`!clearactionlog` — Clear the Action Log channel setting.",
          "`!setmsglog [#channel]` — Set channel for Message Delete/Edit/Filter log.",
          "`!clearmsglog` — Clear the Message Log channel setting.",
          "`!setmodlog [#channel]` — Set channel for Ban/Kick/Mute log.",
          "`!clearmodlog` — Clear the Moderation Log channel setting.",
          "`!setfilterlog [#channel]` — Set channel for Filtered Message log.",
          "`!clearfilterlog` — Clear the Filter Log channel setting.",
          "`!ban @user [reason]` — Ban a user.",
          "`!reloadblacklist` — Reload filter words from MongoDB.",
          "`!setupjoin` — Create the rules panel.",
          "`!welcome` — Create the main welcome panel.",
          "`!subscriber` — Create the live notification panel.",
          "`!creator` — Create the creator verification panel.",
        ].join("\n")
      );

    return message.reply({ embeds: [help] });
  }
});

// =====================================================
// MESSAGE UPDATE/DELETE EVENTS (MSG Log)
// =====================================================
client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  if (!BOT_CONFIG.msgLogChannelId) return;
  const logChannel = message.guild.channels.cache.get(
    BOT_CONFIG.msgLogChannelId
  );
  if (!logChannel) return;

  const deletedContent = message.content
    ? message.content.substring(0, 1024)
    : "*Content not available in cache.*";

  const logEmbed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("🗑️ Message Deleted")
    .addFields(
      {
        name: "User",
        value: `${message.author?.tag || "Unknown User"} (${
          message.author?.id || "Unknown ID"
        })`,
        inline: false,
      },
      {
        name: "Channel",
        value: `<#${message.channel.id}>`,
        inline: true,
      },
      {
        name: "Content",
        value: deletedContent,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Message Deleted" });

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) =>
      console.error("[ERROR] Error sending messageDelete log:", err)
    );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (
    !newMessage.guild ||
    newMessage.author.bot ||
    oldMessage.content === newMessage.content
  )
    return;

  if (!BOT_CONFIG.msgLogChannelId) return;
  const logChannel = newMessage.guild.channels.cache.get(
    BOT_CONFIG.msgLogChannelId
  );
  if (!logChannel) return;

  const oldContent = oldMessage.content
    ? oldMessage.content.substring(0, 1024)
    : "*Content not available in cache.*";
  const newContent = newMessage.content.substring(0, 1024);

  const logEmbed = new EmbedBuilder()
    .setColor("#FFA500")
    .setTitle("✏️ Message Edited")
    .setURL(newMessage.url)
    .addFields(
      {
        name: "User",
        value: `${newMessage.author.tag} (${newMessage.author.id})`,
        inline: false,
      },
      {
        name: "Channel",
        value: `<#${newMessage.channel.id}>`,
        inline: true,
      },
      { name: "Old Content", value: oldContent, inline: false },
      { name: "New Content", value: newContent, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: "Message Edited" });

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) =>
      console.error("[ERROR] Error sending messageUpdate log:", err)
    );
});

// =====================================================
// SERVER ACTIVITY EVENTS (ACTION Log)
// =====================================================
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const rolesAdded = newMember.roles.cache.filter(
    (role) => !oldMember.roles.cache.has(role.id)
  );
  const rolesRemoved = oldMember.roles.cache.filter(
    (role) => !newMember.roles.cache.has(role.id)
  );

  if (rolesAdded.size === 0 && rolesRemoved.size === 0) return;

  if (!BOT_CONFIG.actionLogChannelId) return;
  const logChannel = newMember.guild.channels.cache.get(
    BOT_CONFIG.actionLogChannelId
  );
  if (!logChannel) return;

  let description = [];

  if (rolesAdded.size > 0) {
    description.push(
      `**Added Roles:**\n${rolesAdded.map((r) => r.name).join(", ")}`
    );
  }

  if (rolesRemoved.size > 0) {
    description.push(
      `**Removed Roles:**\n${rolesRemoved.map((r) => r.name).join(", ")}`
    );
  }

  const logEmbed = new EmbedBuilder()
    .setColor("#00FF00")
    .setTitle("⚙️ Member Roles Updated")
    .setDescription(description.join("\n\n"))
    .addFields({
      name: "Member",
      value: `${newMember.user.tag} (${newMember.id})`,
      inline: false,
    })
    .setThumbnail(newMember.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: "Member Role Change" });

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) =>
      console.error("[ERROR] Error sending guildMemberUpdate log:", err)
    );
});

client.on("guildMemberAdd", async (member) => {
  if (!BOT_CONFIG.actionLogChannelId) return;

  const logChannel = member.guild.channels.cache.get(
    BOT_CONFIG.actionLogChannelId
  );
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setColor("#00FF00")
    .setTitle("✅ Member Joined")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      {
        name: "User",
        value: `${member.user.tag} (${member.id})`,
        inline: false,
      },
      {
        name: "Account Created",
        value: `<t:${Math.floor(
          member.user.createdTimestamp / 1000
        )}:f>`,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${member.id}` });

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) =>
      console.error("[ERROR] Error sending join log:", err)
    );
});

client.on("guildMemberRemove", async (member) => {
  if (!BOT_CONFIG.actionLogChannelId) return;

  const logChannel = member.guild.channels.cache.get(
    BOT_CONFIG.actionLogChannelId
  );
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("🚪 Member Left")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      {
        name: "User",
        value: `${member.user.tag} (${member.id})`,
        inline: false,
      },
      {
        name: "Joined At",
        value: member.joinedTimestamp
          ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`
          : "Unknown",
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${member.id}` });

  logChannel
    .send({ embeds: [logEmbed] })
    .catch((err) =>
      console.error("[ERROR] Error sending leave log:", err)
    );
});

// =====================================================
// BUTTON INTERACTIONS (Rules / Subscriber)
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
      console.error("[ERROR] Failed to assign Gosu role:", err);
      return interaction.reply({
        content: "❌ There was an error while assigning your role.",
        ephemeral: true,
      });
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
          content: "🔕 **You have unsubscribed from Live Notifications.**",
          ephemeral: true,
        });
      } else {
        await member.roles.add(SUB_ROLE);
        await interaction.reply({
          content:
            "🔔 **You are now subscribed to Live Notifications!**",
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("[ERROR] Failed to toggle subscriber role:", err);
      return interaction.reply({
        content: "❌ There was an error while assigning your role.",
        ephemeral: true,
      });
    }
  }
});

// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);


