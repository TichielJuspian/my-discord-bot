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
// Gosu Custom Discord Bot (Final English Build - Part 3)
// Filters, Commands (Enhanced Rank Search)
// =====================================================================

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    // Parse Command First
    const content = message.content.trim();
    const args = content.slice(1).split(/ +/);
    const cmd = args.shift().toLowerCase();
    const isCommand = content.startsWith("!");

    const lowerContent = content.toLowerCase();
    const isMod = isModerator(message.member);
    const isSilver = message.member.roles.cache.has(SILVER_ROLE_ID);

    // ---------------------------------------------------
    // 1. FILTER LOGIC (Skip for commands)
    // ---------------------------------------------------
    if (!isMod && !isCommand) {
        // A. Scam Check
        const scams = ["free nitro", "steamcommunity.com/gift", "airdrop", "discord.gg/invite", "dlscord.gg", "bit.ly/", "gift free"];
        if (scams.some(s => lowerContent.includes(s))) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚨 **${message.author.username}** Scam link blocked.`).then(m=>setTimeout(()=>m.delete(),5000));
        }
        
        // B. Link Check (Silver Only)
        const hasLink = /(https?:\/\/[^\s]+)/.test(lowerContent);
        if (hasLink && !isSilver) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚫 **${message.author.username}** Links require **Silver Rank (Lv 10)**.`).then(m=>setTimeout(()=>m.delete(),5000));
        }

        // C. Blacklist Check
        if (BLACKLISTED_WORDS.some(w => lowerContent.includes(w))) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚫 **${message.author.username}** Forbidden word detected.`).then(m=>setTimeout(()=>m.delete(),5000));
        }
    }

    // XP Gain (Skip for commands)
    if (!isCommand) {
        await handleXpGain(message);
        return; 
    }

    // ---------------------------------------------------
    // 2. COMMAND LOGIC
    // ---------------------------------------------------
    
    // Auto-delete trigger message
    if (!["ping", "invite", "rank", "leaderboard", "level"].includes(cmd)) {
        setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
    }

    // [GENERAL]
    if (cmd === "ping") return message.reply("Pong!");
    if (cmd === "invite") return message.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");
    
    if (cmd === "help") {
        const embed = new EmbedBuilder().setColor("#00FFFF").setTitle("🤖 Bot Commands")
            .setDescription("**General**: `!ping`, `!rank`, `!leaderboard`, `!level`\n**Mod**: `!kick`, `!mute`, `!freeze`\n**Admin**: `!setupjoin`, `!syncrolexp`...");
        return message.channel.send({ embeds: [embed] });
    }

    // [LEVELING - ENHANCED RANK SEARCH]
    if (cmd === "rank") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        
        let targetMember;

        // 1. Check for Mention (@User)
        if (message.mentions.members.size > 0) {
            targetMember = message.mentions.members.first();
        } 
        // 2. Check for Name/ID Search (e.g. !rank gosu)
        else if (args.length > 0) {
            const search = args.join(" ").toLowerCase();
            targetMember = message.guild.members.cache.find(m => 
                m.user.username.toLowerCase().includes(search) || 
                (m.nickname && m.nickname.toLowerCase().includes(search)) ||
                m.user.id === search
            );
        } 
        // 3. Default to Self
        else {
            targetMember = message.member;
        }

        if (!targetMember) return message.reply("❌ User not found.");

        const targetUser = targetMember.user;
        const data = await xpCollection.findOne({ guildId: message.guild.id, userId: targetUser.id });
        
        if (!data) return message.reply(`❌ No XP data found for **${targetUser.username}**.`);

        // Rank Calculation
        const rank = (await xpCollection.countDocuments({ guildId: message.guild.id, xp: { $gt: data.xp } })) + 1;
        const totalUsers = await xpCollection.countDocuments({ guildId: message.guild.id });

        // XP Progress
        const currentLevel = data.level || 0;
        const xpForCurrentLevel = getTotalXpForLevel(currentLevel);
        const xpForNextLevel = getTotalXpForLevel(currentLevel + 1);
        
        const xpIntoLevel = data.xp - xpForCurrentLevel;
        const xpToNextLevel = xpForNextLevel - xpForCurrentLevel;
        
        // Progress Bar
        const percentage = Math.min(Math.max(xpIntoLevel / xpToNextLevel, 0), 1);
        const totalBars = 15;
        const filledBars = Math.round(percentage * totalBars);
        const emptyBars = totalBars - filledBars;
        const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

        // Next Reward Info
        const nextRewardEntry = LEVEL_ROLES.find(r => r.level > currentLevel);
        let nextRewardText = "You have unlocked all rewards!";
        if (nextRewardEntry) {
            const role = message.guild.roles.cache.get(nextRewardEntry.roleId);
            const roleName = role ? role.name : `Level ${nextRewardEntry.level} Role`;
            nextRewardText = `At **Level ${nextRewardEntry.level}** you will earn role: **${roleName}**`;
        }

        // Build Rich Embed (No Ping - Uses Username)
        const rankEmbed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor === "#000000" ? "#9B59B6" : targetMember.displayHexColor)
            .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "🧬 Level", value: `${currentLevel}`, inline: true },
                { name: "⭐ XP", value: `${data.xp} / ${xpForNextLevel}`, inline: true },
                { name: "🏆 Rank", value: `#${rank} of ${totalUsers}`, inline: true },
                { name: "📈 Progress to Next Level", value: `${progressBar}\n${xpIntoLevel} / ${xpToNextLevel} XP`, inline: false },
                { name: "🎁 Next Reward", value: nextRewardText, inline: false }
            )
            .setFooter({ text: "Gosu General TV — Rank System", iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [rankEmbed] });
    }

    if (cmd === "leaderboard") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
        const description = top.map((u, i) => `${i+1}. <@${u.userId}> — Lv ${u.level} (${u.xp} XP)`).join("\n");
        const embed = new EmbedBuilder().setColor("Gold").setTitle("🏆 Leaderboard").setDescription(description || "No Data");
        return message.channel.send({ embeds: [embed] });
    }

   // [LEVELING - ENHANCED REWARD LIST]
    if (cmd === "level") {
        // 1. Fetch User Data
        let userLevel = 0;
        if (xpCollection) {
            const data = await xpCollection.findOne({ guildId: message.guild.id, userId: message.author.id });
            if (data) userLevel = data.level;
        }

        // 2. Build Progress List
        // Use map to create a visual list of rewards
        const description = LEVEL_ROLES.map(entry => {
            const role = message.guild.roles.cache.get(entry.roleId);
            const roleName = role ? role.toString() : `Unknown Role (ID: ${entry.roleId})`;
            
            // Check if user has reached this level
            if (userLevel >= entry.level) {
                return `✅ **Lv ${entry.level}** — ${roleName} (Unlocked)`;
            } else {
                return `🔒 **Lv ${entry.level}** — ${roleName}`;
            }
        }).join("\n");

        // 3. Find Next Milestone
        const nextReward = LEVEL_ROLES.find(r => r.level > userLevel);
        let progressText = "🎉 You have unlocked all rewards!";
        
        if (nextReward) {
            const levelsLeft = nextReward.level - userLevel;
            progressText = `🔥 **${levelsLeft}** more levels to unlock **Level ${nextReward.level}** reward!`;
        }

        // 4. Create Rich Embed
        const levelEmbed = new EmbedBuilder()
            .setColor(userLevel > 0 ? "#00FF7F" : "#95A5A6") // Green if active, Gray if lvl 0
            .setTitle("🎯 Level Rewards & Progress")
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(`**Current Level: ${userLevel}**\n\n${description}`)
            .addFields(
                { name: "🚀 Next Milestone", value: progressText, inline: false }
            )
            .setFooter({ text: "Keep chatting to unlock more roles!", iconURL: message.guild.iconURL() });

        return message.channel.send({ embeds: [levelEmbed] });
    }

    // [ADMIN]
    if (cmd === "syncrolexp") {
        if(!isAdmin(message.member)) return message.reply("⛔ Admin only.");
        message.reply("🔄 Syncing roles...");
        let count = 0;
        for (const reward of LEVEL_ROLES) {
            const role = message.guild.roles.cache.get(reward.roleId);
            if (!role) continue;
            for (const [mid, m] of role.members) {
                const minXp = getTotalXpForLevel(reward.level);
                const userDoc = await xpCollection.findOne({ guildId: message.guild.id, userId: mid });
                if (!userDoc || userDoc.level < reward.level) {
                    await xpCollection.updateOne({ guildId: message.guild.id, userId: mid }, { $set: { level: reward.level, xp: minXp } }, { upsert: true });
                    count++;
                }
            }
        }
        message.channel.send(`✅ Synced **${count}** users.`);
    }

    // [MODERATION]
    if (cmd === "kick") {
        if(!isMod) return;
        const t = message.mentions.members.first();
        if(t?.kickable) { await t.kick(); message.reply(`👢 Kicked **${t.user.username}**.`); sendModLog(message.guild, t.user, "KICK", message.author, "Manual"); }
    }
    if (cmd === "ban") {
        if(!isAdmin(message.member)) return;
        const t = message.mentions.members.first();
        if(t?.bannable) { await t.ban(); message.reply(`🔨 Banned **${t.user.username}**.`); sendModLog(message.guild, t.user, "BAN", message.author, "Manual"); }
    }
    if (cmd === "mute") {
        if(!isMod) return;
        const t = message.mentions.members.first();
        const m = parseInt(args[1]);
        if(t && m) { await t.timeout(m*60000); message.reply(`🔇 Muted **${t.user.username}** for ${m}m.`); sendModLog(message.guild, t.user, "MUTE", message.author, "Manual"); }
    }
    if (cmd === "unmute") {
        if(!isMod) return;
        const t = message.mentions.members.first();
        if(t) { await t.timeout(null); message.reply(`🔊 Unmuted **${t.user.username}**.`); }
    }
    if (cmd === "freeze") {
        if(!isMod) return;
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.channel.send("❄️ Frozen");
    }
    if (cmd === "unfreeze") {
        if(!isMod) return;
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
        message.channel.send("♨️ Thawed");
    }
    if (cmd === "prune") {
        if(!isMod) return;
        const n = parseInt(args[0]);
        if(n) message.channel.bulkDelete(n, true);
    }
    if (cmd === "addword") {
        if(!isMod) return;
        const w = args.join(" ").toLowerCase();
        if(w) { BLACKLISTED_WORDS.push(w); saveBlacklist(); message.reply("Added."); }
    }// =====================================================================
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
