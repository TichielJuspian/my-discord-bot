// =====================================================================
// Gosu Custom Discord Bot (Original Expanded Version - Part 1)
// Setup, Configuration, MongoDB Connection, Helper Functions
// =====================================================================
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
  ActivityType
} = require("discord.js");

const { MongoClient } = require("mongodb");

// ---------------------------------------------------------------------
// 1. FILE PATH CONFIGURATION
// ---------------------------------------------------------------------
const DATA_DIR = "./Data";
const BLACKLIST_FILE_PATH = path.join(DATA_DIR, "blacklist.json");
const CONFIG_FILE_PATH = path.join(DATA_DIR, "config.json");

// Ensure Data directory exists to prevent startup errors
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[INIT] Created directory: ${DATA_DIR}`);
}

// ---------------------------------------------------------------------
// 2. ROLE & CHANNEL IDs (CRITICAL: Verify these IDs)
// ---------------------------------------------------------------------
// Main Member Role
const GOSU_ROLE = "496717793388134410";
// Moderator Role
const MOD_ROLE = "495727371140202506";
// Administrator Role
const ADMIN_ROLE = "495718851288236032";
// Live Notification Role
const SUB_ROLE = "497654614729031681";
// Content Creator Role
const CREATOR_ROLE = "1441214177128743017";
// Temporary Verification Role
const VERIFICATION_ROLE = "1441311763806031893";

// ★ SILVER ROLE ID (Level 10 Reward - Allows GIFs/Links)
const SILVER_ROLE_ID = "497491254838427674"; 

// Voice Creator Channel Configuration
const CREATE_CHANNEL_IDS = [
    "720658789832851487", 
    "1441159364298936340"
];
const TEMP_VOICE_CHANNEL_IDS = new Set();

// ---------------------------------------------------------------------
// 3. LEVELING SYSTEM CONFIGURATION
// ---------------------------------------------------------------------
const XP_CONFIG = {
  minXP: 5,
  maxXP: 15,
  cooldownMs: 30000, // 30 seconds cooldown per message
};

// Level Reward Roles Configuration
const LEVEL_ROLES = [
  { level: 5, roleId: "497843968151781378" },
  { level: 10, roleId: SILVER_ROLE_ID }, // Level 10 = Silver
  { level: 20, roleId: "687470373331402752" },
  { level: 30, roleId: "497578834376392724" },
  { level: 40, roleId: "1441513975161294889" },
  { level: 50, roleId: "523184440491638795" },
  { level: 70, roleId: "542051690195451907" },
  { level: 80, roleId: "1441514153855422556" },
  { level: 100, roleId: "1441514648275779685" },
  { level: 150, roleId: "1441518689290817646" },
];

// ---------------------------------------------------------------------
// 4. GLOBAL STATE VARIABLES
// ---------------------------------------------------------------------
let BOT_CONFIG = {
  actionLogChannelId: null,
  msgLogChannelId: null,
  modLogChannelId: null,
  filterLogChannelId: null,
};

let BLACKLISTED_WORDS = [];
const xpCooldowns = new Map();

// MongoDB Client Setup
const mongoClient = new MongoClient(process.env.MONGODB_URI);
let xpCollection = null;

// ---------------------------------------------------------------------
// 5. CLIENT INITIALIZATION
// ---------------------------------------------------------------------
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
      Partials.GuildMember
  ],
});

// ---------------------------------------------------------------------
// 6. HELPER FUNCTIONS: FILE MANAGEMENT
// ---------------------------------------------------------------------
function loadLocalFiles() {
    // 1. Load Configuration
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
            BOT_CONFIG = JSON.parse(raw);
            console.log("[FILE] Config loaded successfully.");
        } else {
            // Create default config if missing
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(BOT_CONFIG, null, 2));
            console.log("[FILE] Created new config file.");
        }
    } catch (e) {
        console.error("[ERROR] Failed to load config:", e);
    }

    // 2. Load Blacklist
    try {
        if (fs.existsSync(BLACKLIST_FILE_PATH)) {
            const raw = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
            BLACKLISTED_WORDS = JSON.parse(raw);
            console.log(`[FILE] Blacklist loaded: ${BLACKLISTED_WORDS.length} words.`);
        } else {
            // Create default blacklist if missing
            fs.writeFileSync(BLACKLIST_FILE_PATH, JSON.stringify(BLACKLISTED_WORDS, null, 2));
            console.log("[FILE] Created new blacklist file.");
        }
    } catch (e) {
        console.error("[ERROR] Failed to load blacklist:", e);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(BOT_CONFIG, null, 2));
        console.log("[FILE] Config saved.");
    } catch (e) { console.error("[ERROR] Saving config:", e); }
}

function saveBlacklist() {
    try {
        fs.writeFileSync(BLACKLIST_FILE_PATH, JSON.stringify(BLACKLISTED_WORDS, null, 2));
        console.log("[FILE] Blacklist saved.");
    } catch (e) { console.error("[ERROR] Saving blacklist:", e); }
}

// ---------------------------------------------------------------------
// 7. HELPER FUNCTIONS: PERMISSIONS & DATABASE
// ---------------------------------------------------------------------
function isModerator(member) {
    if (!member) return false;
    // Check hierarchy: Admin Flag > Admin Role > Mod Role
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

async function connectMongo() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(process.env.MONGODB_DB_NAME || "gosuBot");
        xpCollection = db.collection("user_xp");
        console.log("[MONGO] Connected to MongoDB Atlas successfully.");
    } catch (e) {
        console.error("[MONGO] Connection Failed. XP features will be disabled.", e);
    }
}

// ---------------------------------------------------------------------
// 8. BOT READY EVENT
// ---------------------------------------------------------------------
client.once("ready", async () => {
    console.log(`\n=============================================`);
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    console.log(`[BOT] ID: ${client.user.id}`);
    console.log(`=============================================\n`);
    
    // Initialize Systems
    loadLocalFiles();
    await connectMongo();

    // Set Status
    client.user.setActivity("Gosu General TV", { type: ActivityType.Watching });
});
// =====================================================================
// Gosu Custom Discord Bot (Original Expanded Version - Part 2)
// Leveling Logic, Moderation Logger, Voice Creator
// =====================================================================

// ---------------------------------------------------------------------
// 9. LEVEL SYSTEM LOGIC
// ---------------------------------------------------------------------

// Calculate Total XP required to reach a specific level
// Formula: 100 * level * level - 100
function getTotalXpForLevel(level) {
    if (level <= 0) return 0;
    return 100 * level * level - 100;
}

// Calculate current Level based on Total XP
function getLevelFromTotalXp(totalXp) {
    let level = 0;
    while (totalXp >= getTotalXpForLevel(level + 1)) {
        level++;
    }
    return level;
}

async function handleXpGain(message) {
    // Ignore bots or if DB is offline
    if (!xpCollection || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const lastXp = xpCooldowns.get(key) || 0;

    // Check Cooldown
    if (now - lastXp < XP_CONFIG.cooldownMs) return;
    xpCooldowns.set(key, now);

    // Calculate XP Gain
    const xpGain = Math.floor(Math.random() * (XP_CONFIG.maxXP - XP_CONFIG.minXP + 1)) + XP_CONFIG.minXP;

    try {
        // Atomic Update in MongoDB
        const result = await xpCollection.findOneAndUpdate(
            { guildId, userId },
            { 
                $setOnInsert: { level: 0 },
                $inc: { xp: xpGain } 
            },
            { upsert: true, returnDocument: "after" }
        );

        const data = result.value || result; 
        if (!data) return;

        // [SELF-HEALING] Verify if Level matches XP
        const calculatedLevel = getLevelFromTotalXp(data.xp);
        
        // If stored level is different from actual calculation, fix it
        if (data.level !== calculatedLevel) {
            await xpCollection.updateOne(
                { _id: data._id }, 
                { $set: { level: calculatedLevel } }
            );

            // If user Leveled Up
            if (calculatedLevel > data.level) {
                // Check for Role Rewards
                for (const reward of LEVEL_ROLES) {
                    if (data.level < reward.level && calculatedLevel >= reward.level) {
                        const role = message.guild.roles.cache.get(reward.roleId);
                        if (role) {
                            await message.member.roles.add(role).catch(err => {
                                console.error(`[XP] Failed to add role ${role.name}:`, err);
                            });
                            
                            // Special Notification for Silver Rank
                            if (reward.roleId === SILVER_ROLE_ID) {
                                const embed = new EmbedBuilder()
                                    .setColor("#C0C0C0")
                                    .setTitle("🥈 Silver Rank Achieved!")
                                    .setDescription(`Congratulations ${message.member}! You reached **Level 10**.\n✅ You can now use **GIFs and Links**!`)
                                    .setThumbnail(message.author.displayAvatarURL())
                                    .setTimestamp();
                                message.channel.send({ embeds: [embed] });
                            }
                        }
                    }
                }

                // General Level Up Message
                const levelEmbed = new EmbedBuilder()
                    .setColor("#00FF7F")
                    .setTitle("🎉 Level Up!")
                    .setDescription(`**${message.author}** has reached **Level ${calculatedLevel}**!`)
                    .setFooter({ text: "Gosu General TV — Level System" });
                
                const msg = await message.channel.send({ embeds: [levelEmbed] });
                // Optional: Delete notification after 10 seconds to keep chat clean
                // setTimeout(() => msg.delete().catch(() => {}), 10000);
            }
        }
    } catch (e) { 
        console.error("[XP] Error processing XP:", e); 
    }
}

// ---------------------------------------------------------------------
// 10. MODERATION LOGGING SYSTEM
// ---------------------------------------------------------------------
async function sendModLog(guild, user, action, moderator, reason, duration) {
    if (!BOT_CONFIG.modLogChannelId) return;
    
    const channel = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(action === "BAN" ? "#FF0000" : "#FFA500")
        .setTitle(`🔨 Moderation Action: ${action}`)
        .addFields(
            { name: "Target User", value: `${user.tag} (${user.id})`, inline: false },
            { name: "Moderator", value: `${moderator.tag} (${moderator.id})`, inline: true },
            { name: "Reason", value: reason || "No reason provided", inline: true }
        )
        .setTimestamp();

    if (duration) {
        embed.addFields({ name: "Duration", value: `${duration} minutes`, inline: true });
    }
    
    channel.send({ embeds: [embed] }).catch((err) => console.error("[LOG] Failed to send log:", err));
}

// ---------------------------------------------------------------------
// 11. VOICE CHANNEL CREATOR
// ---------------------------------------------------------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
    // 1. Create Channel
    // Check if user joined a "Create Channel"
    if (newState.channelId && CREATE_CHANNEL_IDS.includes(newState.channelId)) {
        const member = newState.member;
        const parent = newState.channel.parent;
        
        try {
            const ch = await newState.guild.channels.create({
                name: `🎧 ${member.user.username}'s VO`,
                type: ChannelType.GuildVoice,
                parent: parent,
                userLimit: 5,
                permissionOverwrites: [
                    { 
                        id: newState.guild.id, 
                        allow: [PermissionsBitField.Flags.Connect], 
                        deny: [PermissionsBitField.Flags.ManageChannels] 
                    },
                    { 
                        id: member.id, 
                        allow: [
                            PermissionsBitField.Flags.ManageChannels, 
                            PermissionsBitField.Flags.MoveMembers,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers
                        ] 
                    }
                ]
            });
            
            // Add to Set to track it
            TEMP_VOICE_CHANNEL_IDS.add(ch.id);
            
            // Move member to new channel
            await member.voice.setChannel(ch);
            console.log(`[VOICE] Created temporary channel for ${member.user.tag}`);
            
        } catch (e) { 
            console.error("[VOICE] Creation Error:", e); 
        }
    }
    
    // 2. Delete Channel
    // Check if user left a temporary channel and it is now empty
    if (oldState.channelId && TEMP_VOICE_CHANNEL_IDS.has(oldState.channelId)) {
        if (oldState.channel.members.size === 0) {
            try {
                await oldState.channel.delete();
                TEMP_VOICE_CHANNEL_IDS.delete(oldState.channelId);
                console.log(`[VOICE] Deleted empty channel: ${oldState.channel.name}`);
            } catch (e) {
                console.error("[VOICE] Deletion Error:", e);
            }
        }
    }
});

// =====================================================================
// Gosu Custom Discord Bot (Original Expanded Version - Part 3)
// Message Filters (Scam, Silver GIF), General & Mod Commands
// =====================================================================

client.on("messageCreate", async (message) => {
    // Ignore bots and DMs
    if (!message.guild || message.author.bot) return;

    // ---------------------------------------------------
    // PRE-PROCESSING
    // ---------------------------------------------------
    const content = message.content.trim();
    const args = content.slice(1).split(/ +/);
    const cmd = args.shift().toLowerCase(); // Prefix removed
    const isCommand = content.startsWith("!");

    const lowerContent = content.toLowerCase();
    const isMod = isModerator(message.member);
    const isSilver = message.member.roles.cache.has(SILVER_ROLE_ID);

    // ---------------------------------------------------
    // 1. FILTER LOGIC (Skipped if user is Mod or sending a command)
    // ---------------------------------------------------
    if (!isMod && !isCommand) {
        
        // A. SCAM & MALICIOUS PATTERNS (Critical Priority)
        const scamPatterns = [
            "free nitro", 
            "steamcommunity.com/gift", 
            "airdrop", 
            "discord.gg/invite", 
            "dlscord.gg", 
            "bit.ly/", 
            "tinyurl.com", 
            "hacked", 
            "gift free"
        ];

        if (scamPatterns.some(p => lowerContent.includes(p))) {
            if (message.deletable) message.delete().catch(() => {});
            const msg = await message.channel.send(`🚨 **${message.author}** Malicious/Scam link detected and blocked.`);
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            
            // Log to Filter Log Channel
            if(BOT_CONFIG.filterLogChannelId) {
                const ch = message.guild.channels.cache.get(BOT_CONFIG.filterLogChannelId);
                if(ch) ch.send(`🚨 **Scam Blocked**\nUser: ${message.author.tag}\nContent: ||${content}||`);
            }
            return; // Stop processing
        }

        // B. LINK & GIF FILTER
        // General link detection
        const hasLink = /(https?:\/\/[^\s]+)/.test(lowerContent);
        // Discord invites
        const hasDiscordInvite = /discord\.gg\//.test(lowerContent) && !lowerContent.includes("gosugeneral");
        // NSFW
        const hasOnlyFans = lowerContent.includes("onlyfans") || lowerContent.includes("only fans");

        if (hasLink || hasDiscordInvite || hasOnlyFans) {
            let allow = false;

            // ★ Silver Role: Allow general links/GIFs
            if (isSilver) {
                allow = true;
            }

            // ★ Exception: Invites and NSFW are blocked even for Silver
            if (hasDiscordInvite || hasOnlyFans) {
                allow = false;
            }

            if (!allow) {
                if (message.deletable) message.delete().catch(() => {});
                const msg = await message.channel.send(`🚫 **${message.author}** Links/GIFs are restricted to **Silver Rank (Level 10+)**.`);
                setTimeout(() => msg.delete().catch(() => {}), 5000);
                return; // Stop processing
            }
        }

        // C. BLACKLIST WORD FILTER
        // Check if message contains any blacklisted word
        if (BLACKLISTED_WORDS.some(w => lowerContent.includes(w))) {
            if (message.deletable) message.delete().catch(() => {});
            const msg = await message.channel.send(`🚫 **${message.author}** Forbidden word detected.`);
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return; // Stop processing
        }
    }

    // ---------------------------------------------------
    // 2. XP GAIN (Only for non-command messages)
    // ---------------------------------------------------
    if (!isCommand) {
        await handleXpGain(message);
        return; // Exit here if it's just a chat message
    }

    // ---------------------------------------------------
    // 3. COMMAND EXECUTION
    // ---------------------------------------------------
    
    // Auto-delete command invocation message to keep chat clean
    // (Except for simple info commands)
    if (!["ping", "invite", "rank", "leaderboard", "level"].includes(cmd)) {
        setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
    }

    // [GENERAL COMMANDS]
    if (cmd === "ping") {
        return message.reply("Pong!");
    }

    if (cmd === "invite") {
        return message.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");
    }
    
    if (cmd === "help") {
        const embed = new EmbedBuilder()
            .setColor("#00FFFF")
            .setTitle("🤖 Bot Commands")
            .addFields(
                { name: "General", value: "`!ping`, `!invite`, `!rank`, `!leaderboard`, `!level`" },
                { name: "Moderation", value: "`!kick`, `!ban`, `!mute`, `!unmute`, `!freeze`, `!unfreeze`, `!prune`" },
                { name: "Filter", value: "`!addword`, `!removeword`, `!listwords`, `!reloadblacklist`" },
                { name: "Admin", value: "`!setupjoin`, `!welcome`, `!subscriber`, `!creator`, `!syncrolexp`" },
                { name: "Logging", value: "`!setmodlog`, `!setmsglog`, `!setactionlog`" }
            );
        return message.channel.send({ embeds: [embed] });
    }

    // [LEVELING COMMANDS]
    if (cmd === "rank") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const target = message.mentions.users.first() || message.author;
        const data = await xpCollection.findOne({ guildId: message.guild.id, userId: target.id });
        
        if (!data) return message.reply("No XP data found for this user.");
        
        const rank = (await xpCollection.countDocuments({ guildId: message.guild.id, xp: { $gt: data.xp } })) + 1;
        const embed = new EmbedBuilder()
            .setColor("#00D1FF")
            .setTitle(`📊 Rank: ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "Level", value: `${data.level}`, inline: true },
                { name: "XP", value: `${data.xp}`, inline: true },
                { name: "Rank", value: `#${rank}`, inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "leaderboard") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        
        const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
        if (top.length === 0) return message.reply("No data available yet.");

        const description = top.map((u, i) => {
            return `${i + 1}. <@${u.userId}> — Level ${u.level} (${u.xp} XP)`;
        }).join("\n");

        const embed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🏆 Leaderboard")
            .setDescription(description);
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "level") {
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🎯 Level Rewards")
            .setDescription(LEVEL_ROLES.map(r => `**Lv ${r.level}**: <@&${r.roleId}>`).join("\n"));
        return message.channel.send({ embeds: [embed] });
    }

    // [ADMIN - SYNC]
    if (cmd === "syncrolexp") {
        if (!isAdmin(message.member)) return message.reply("⛔ Admin only.");
        const statusMsg = await message.channel.send("🔄 Syncing roles to DB... This might take a moment.");
        
        let count = 0;
        for (const reward of LEVEL_ROLES) {
            const role = message.guild.roles.cache.get(reward.roleId);
            if (!role) continue;
            
            for (const [memberId, member] of role.members) {
                const minXp = getTotalXpForLevel(reward.level);
                
                // Check DB
                const userDoc = await xpCollection.findOne({ guildId: message.guild.id, userId: memberId });
                
                // If user has role but level is too low in DB, force update
                if (!userDoc || userDoc.level < reward.level) {
                    await xpCollection.updateOne(
                        { guildId: message.guild.id, userId: memberId },
                        { $set: { level: reward.level, xp: minXp } }, 
                        { upsert: true }
                    );
                    count++;
                }
            }
        }
        await statusMsg.edit(`✅ Synced **${count}** users based on their roles.`);
    }

    // [MODERATION COMMANDS]
    if (cmd === "kick") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason provided";
        
        if (target && target.kickable) {
            await target.kick(reason);
            message.reply(`👢 Successfully kicked **${target.user.tag}**.`);
            sendModLog(message.guild, target.user, "KICK", message.author, reason);
        } else {
            message.reply("❌ Cannot kick user. Check role hierarchy.");
        }
    }

    if (cmd === "ban") {
        if (!isAdmin(message.member)) return;
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason provided";

        if (target && target.bannable) {
            await target.ban({ reason });
            message.reply(`🔨 Successfully banned **${target.user.tag}**.`);
            sendModLog(message.guild, target.user, "BAN", message.author, reason);
        } else {
            message.reply("❌ Cannot ban user.");
        }
    }

    if (cmd === "mute") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const mins = parseInt(args[1]);
        const reason = args.slice(2).join(" ") || "No reason provided";

        if (target && !isNaN(mins)) {
            await target.timeout(mins * 60 * 1000, reason);
            message.reply(`🔇 Muted **${target.user.tag}** for ${mins} minutes.`);
            sendModLog(message.guild, target.user, "MUTE", message.author, reason, mins);
        } else {
            message.reply("Usage: `!mute @user [minutes] [reason]`");
        }
    }

    if (cmd === "unmute") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        if (target) {
            await target.timeout(null);
            message.reply(`🔊 Unmuted **${target.user.tag}**.`);
        }
    }

    if (cmd === "freeze") {
        if (!isModerator(message.member)) return;
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.channel.send(`❄️ Channel ${channel} has been **frozen**.`);
    }

    if (cmd === "unfreeze") {
        if (!isModerator(message.member)) return;
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
        message.channel.send(`♨️ Channel ${channel} has been **thawed**.`);
    }

    if (cmd === "prune") {
        if (!isModerator(message.member)) return;
        const amount = parseInt(args[0]);
        if (amount && amount <= 100) {
            await message.channel.bulkDelete(amount, true);
            const msg = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
            setTimeout(() => msg.delete().catch(() => {}), 2000);
        } else {
            message.reply("Usage: `!prune [1-100]`");
        }
    }

    if (cmd === "addword") {
        if (!isModerator(message.member)) return;
        const word = args.join(" ").toLowerCase();
        if (word) {
            BLACKLISTED_WORDS.push(word);
            saveBlacklist();
            message.reply(`✅ Added "**${word}**" to blacklist.`);
        }
    }

    if (cmd === "removeword") {
        if (!isModerator(message.member)) return;
        const word = args.join(" ").toLowerCase();
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(w => w !== word);
        saveBlacklist();
        message.reply(`✅ Removed "**${word}**" from blacklist.`);
    }

    if (cmd === "listwords") {
        if (!isModerator(message.member)) return;
        message.reply(`🚫 **Blacklist:** ${BLACKLISTED_WORDS.join(", ")}`);
    }

// =====================================================================
// Gosu Custom Discord Bot (Original Expanded Version - Part 4)
// Admin Panels, Button Logic, Events, Login
// =====================================================================

    if (cmd === "reloadblacklist") {
        if (!isAdmin(message.member)) return;
        loadLocalFiles();
        message.reply("✅ Blacklist reloaded from file.");
    }

    // --- SETUP COMMANDS (Panels) ---
    // Banner URLs
    const RULES_BANNER = "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png";
    const WELCOME_BANNER = "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png";
    const NOTI_BANNER = "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png";
    const CREATOR_BANNER = "https://cdn.discordapp.com/attachments/495719121686626323/1441312962903015576/verification.png";

    if (cmd === "setupjoin") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅")
        );
        
        await message.channel.send({ files: [RULES_BANNER] });
        const embed = new EmbedBuilder()
            .setColor("#1e90ff")
            .setTitle("📜 Server Rules")
            .setDescription("Please read the rules carefully and click the button below to join the community.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "welcome") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("YouTube").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu")
        );
        if (WELCOME_BANNER) await message.channel.send({ files: [WELCOME_BANNER] });
        const embed = new EmbedBuilder()
            .setColor("#1e90ff")
            .setTitle("Welcome!")
            .setDescription("Welcome to Gosu General TV. Enjoy your stay!");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "subscriber") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Subscribe").setStyle(ButtonStyle.Primary).setEmoji("🔔")
        );
        if (NOTI_BANNER) await message.channel.send({ files: [NOTI_BANNER] });
        const embed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("🔴 Live Notifications")
            .setDescription("Click the button below to toggle live stream alerts.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "creator") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("apply_creator").setLabel("Apply").setStyle(ButtonStyle.Secondary)
        );
        if (CREATOR_BANNER) await message.channel.send({ files: [CREATOR_BANNER] });
        const embed = new EmbedBuilder()
            .setColor("#FFB347")
            .setTitle("👑 Creator Role")
            .setDescription("Click below to apply for creator verification.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- LOG CONFIG ---
    if (cmd.startsWith("set") && cmd.includes("log")) {
        if (!isAdmin(message.member)) return;
        const ch = message.mentions.channels.first() || message.channel;
        
        if (cmd === "setmodlog") BOT_CONFIG.modLogChannelId = ch.id;
        if (cmd === "setmsglog") BOT_CONFIG.msgLogChannelId = ch.id;
        if (cmd === "setactionlog") BOT_CONFIG.actionLogChannelId = ch.id;
        if (cmd === "setfilterlog") BOT_CONFIG.filterLogChannelId = ch.id;
        
        saveConfig();
        message.reply(`✅ **${cmd.replace("set", "").toUpperCase()}** has been set to ${ch}.`);
    }
    
    // --- CLEAR LOG CONFIG ---
    if (cmd.startsWith("clear") && cmd.includes("log")) {
        if (!isAdmin(message.member)) return;
        
        if (cmd === "clearmodlog") BOT_CONFIG.modLogChannelId = null;
        if (cmd === "clearmsglog") BOT_CONFIG.msgLogChannelId = null;
        if (cmd === "clearactionlog") BOT_CONFIG.actionLogChannelId = null;
        if (cmd === "clearfilterlog") BOT_CONFIG.filterLogChannelId = null;
        
        saveConfig();
        message.reply(`✅ Log channel setting cleared.`);
    }
});

// ---------------------------------------------------------------------
// 12. EVENT LISTENERS (Role Cleanup & Logging)
// ---------------------------------------------------------------------

// [ROLE CLEANUP] Safety Net: Remove Verification Role when Creator Role is gained
client.on("guildMemberUpdate", async (oldM, newM) => {
    // If user gained CREATOR_ROLE
    if (!oldM.roles.cache.has(CREATOR_ROLE) && newM.roles.cache.has(CREATOR_ROLE)) {
        // And still has VERIFICATION_ROLE
        if (newM.roles.cache.has(VERIFICATION_ROLE)) {
            await newM.roles.remove(VERIFICATION_ROLE).catch(console.error);
            // Log
            if(BOT_CONFIG.actionLogChannelId) {
                const ch = newM.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
                if(ch) ch.send(`⚙️ **${newM.user.tag}** verified as Creator. Verification role removed.`);
            }
        }
    }
});

// Logs
client.on("messageDelete", async (message) => {
    if (!message.guild || !BOT_CONFIG.msgLogChannelId) return;
    const ch = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (ch) {
        const embed = new EmbedBuilder().setColor("Red").setTitle("🗑️ Message Deleted")
            .setDescription(`**User:** ${message.author?.tag}\n**Content:** ${message.content || "N/A"}`)
            .setTimestamp();
        ch.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on("messageUpdate", async (oldM, newM) => {
    if (!newM.guild || !BOT_CONFIG.msgLogChannelId || oldM.content === newM.content) return;
    const ch = newM.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (ch) {
        const embed = new EmbedBuilder().setColor("Orange").setTitle("✏️ Message Edited")
            .addFields(
                { name: "Old", value: oldM.content.substring(0, 1000) || "N/A" }, 
                { name: "New", value: newM.content.substring(0, 1000) || "N/A" }
            )
            .setTimestamp();
        ch.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on("guildMemberAdd", member => {
    if (BOT_CONFIG.actionLogChannelId) {
        const ch = member.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
        if (ch) ch.send(`✅ **${member.user.tag}** Joined the server.`);
    }
});

client.on("guildMemberRemove", member => {
    if (BOT_CONFIG.actionLogChannelId) {
        const ch = member.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
        if (ch) ch.send(`🚪 **${member.user.tag}** Left the server.`);
    }
});

// ---------------------------------------------------------------------
// 13. BUTTON INTERACTIONS (English Responses)
// ---------------------------------------------------------------------
client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    const { customId, member } = i;

    try {
        if (customId === "agree_rules") {
            await member.roles.add(GOSU_ROLE);
            i.reply({ content: "✅ Rules accepted! Welcome to the server.", ephemeral: true });
        }
        
        if (customId === "subscribe_toggle") {
            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(SUB_ROLE);
                i.reply({ content: "🔕 **Unsubscribed from live notifications.**", ephemeral: true });
            } else {
                await member.roles.add(SUB_ROLE);
                i.reply({ content: "🔔 **Subscribed to live notifications!**", ephemeral: true });
            }
        }

        // [Creator Approval Logic]
        if (customId === "apply_creator") {
            // 1. Grant Creator Role
            await member.roles.add(CREATOR_ROLE);
            
            // 2. Remove Verification (Temporary) Role if exists
            if (member.roles.cache.has(VERIFICATION_ROLE)) {
                await member.roles.remove(VERIFICATION_ROLE);
            }

            i.reply({ content: "✅ **Creator Verified!** Verification role removed.", ephemeral: true });
            
            // 3. Log
            if(BOT_CONFIG.actionLogChannelId) {
                const ch = member.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId);
                if(ch) ch.send(`👑 **${member.user.tag}** used the Apply button and is now a Creator.`);
            }
        }
    } catch (e) {
        console.error("Interaction Error:", e);
        if (!i.replied) i.reply({ content: "❌ Error occurred.", ephemeral: true });
    }
});

// ---------------------------------------------------------------------
// 14. BOT LOGIN
// ---------------------------------------------------------------------
client.login(process.env.Bot_Token);
