// =====================================================
// Gosu Custom Discord Bot (Real Complete Version)
// Features: All Commands, MongoDB Leveling, Smart Filter, Full Logging
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
// 1. CONFIGURATION & FILE PATHS
// -----------------------------
const DATA_DIR = "./Data";
const BLACKLIST_FILE_PATH = path.join(DATA_DIR, "blacklist.json");
const CONFIG_FILE_PATH = path.join(DATA_DIR, "config.json");

// 데이터 폴더가 없으면 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -----------------------------
// 2. ROLE & CHANNEL IDs (서버 ID 확인 필수)
// -----------------------------
const GOSU_ROLE = "496717793388134410";
const MOD_ROLE = "495727371140202506";
const ADMIN_ROLE = "495718851288236032";
const SUB_ROLE = "497654614729031681";
const CREATOR_ROLE = "1441214177128743017";
const VERIFICATION_ROLE = "1441311763806031893";

// ★ SILVER ROLE ID (Level 10 - GIF/링크 사용 권한)
const SILVER_ROLE_ID = "497491254838427674"; 

// 자동 생성 음성 채널 ID
const CREATE_CHANNEL_IDS = ["720658789832851487", "1441159364298936340"];
const TEMP_VOICE_CHANNEL_IDS = new Set();

// -----------------------------
// 3. LEVELING SYSTEM CONFIG
// -----------------------------
const XP_CONFIG = {
  minXP: 5,
  maxXP: 15,
  cooldownMs: 30000, // 30초 쿨타임
};

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

// -----------------------------
// 4. GLOBAL STATE VARIABLES
// -----------------------------
let BOT_CONFIG = {
  actionLogChannelId: null,
  msgLogChannelId: null,
  modLogChannelId: null,
  filterLogChannelId: null,
};
let BLACKLISTED_WORDS = [];
const xpCooldowns = new Map();

// MongoDB Client
const mongoClient = new MongoClient(process.env.MONGODB_URI);
let xpCollection = null;

// -----------------------------
// 5. CLIENT INITIALIZATION
// -----------------------------
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
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
});

// -----------------------------
// 6. HELPER FUNCTIONS
// -----------------------------

// 파일 로드 (설정 및 블랙리스트)
function loadLocalFiles() {
    // Config 로드
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            BOT_CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8"));
            console.log("[FILE] Config loaded.");
        } else {
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(BOT_CONFIG, null, 2));
        }
    } catch (e) { console.error("Config Load Error:", e); }

    // Blacklist 로드
    try {
        if (fs.existsSync(BLACKLIST_FILE_PATH)) {
            BLACKLISTED_WORDS = JSON.parse(fs.readFileSync(BLACKLIST_FILE_PATH, "utf8"));
            console.log(`[FILE] Blacklist loaded (${BLACKLISTED_WORDS.length} words).`);
        } else {
            fs.writeFileSync(BLACKLIST_FILE_PATH, JSON.stringify(BLACKLISTED_WORDS, null, 2));
        }
    } catch (e) { console.error("Blacklist Load Error:", e); }
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(BOT_CONFIG, null, 2));
}

function saveBlacklist() {
    fs.writeFileSync(BLACKLIST_FILE_PATH, JSON.stringify(BLACKLISTED_WORDS, null, 2));
}

// 권한 확인 함수
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

// 로그 전송 함수
async function sendModLog(guild, user, action, moderator, reason, duration) {
    if (!BOT_CONFIG.modLogChannelId) return;
    const channel = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(action === "BAN" ? "#FF0000" : "#FFA500")
        .setTitle(`🔨 Moderation: ${action}`)
        .addFields(
            { name: "Target", value: `${user.tag} (${user.id})`, inline: false },
            { name: "Moderator", value: `${moderator.tag}`, inline: true },
            { name: "Reason", value: reason, inline: true }
        )
        .setTimestamp();

    if (duration) embed.addFields({ name: "Duration", value: `${duration}m`, inline: true });
    
    channel.send({ embeds: [embed] }).catch(() => {});
}

// -----------------------------
// 7. MONGODB & XP LOGIC
// -----------------------------
async function connectMongo() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(process.env.MONGODB_DB_NAME || "gosuBot");
        xpCollection = db.collection("user_xp");
        console.log("[MONGO] Connected to MongoDB for XP System.");
    } catch (e) {
        console.error("[MONGO] Connection Failed:", e);
    }
}

function getLevelFromTotalXp(totalXp) {
    let level = 0;
    // XP 공식: 100 * level^2 + 100
    while (totalXp >= (100 * (level + 1) * (level + 1) - 100)) {
        level++;
    }
    return level;
}

async function handleXpGain(message) {
    if (!xpCollection || message.author.bot) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const lastXp = xpCooldowns.get(key) || 0;

    // 쿨타임 체크
    if (now - lastXp < XP_CONFIG.cooldownMs) return;
    xpCooldowns.set(key, now);

    const xpGain = Math.floor(Math.random() * (XP_CONFIG.maxXP - XP_CONFIG.minXP + 1)) + XP_CONFIG.minXP;

    try {
        // DB 업데이트
        const result = await xpCollection.findOneAndUpdate(
            { guildId: message.guild.id, userId: message.author.id },
            { 
                $setOnInsert: { level: 0 },
                $inc: { xp: xpGain } 
            },
            { upsert: true, returnDocument: "after" }
        );

        const data = result.value || result; 
        if (!data) return;

        const newLevel = getLevelFromTotalXp(data.xp);
        
        // 레벨업 로직
        if (newLevel > data.level) {
            await xpCollection.updateOne({ _id: data._id }, { $set: { level: newLevel } });

            // 보상 역할 지급
            for (const reward of LEVEL_ROLES) {
                if (data.level < reward.level && newLevel >= reward.level) {
                    const role = message.guild.roles.cache.get(reward.roleId);
                    if (role) {
                        await message.member.roles.add(role).catch(console.error);
                        
                        // ★ SILVER ROLE 획득 알림 (Level 10)
                        if (reward.roleId === SILVER_ROLE_ID) {
                            const embed = new EmbedBuilder()
                                .setColor("#C0C0C0")
                                .setTitle("🥈 Silver Rank Achieved!")
                                .setDescription(`Congratulations ${message.member}! You reached **Level 10**.\n✅ You can now use **GIFs and Links**!`);
                            message.channel.send({ embeds: [embed] });
                        }
                    }
                }
            }

            const levelEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setDescription(`🎉 **${message.author}** has reached **Level ${newLevel}**!`);
            message.channel.send({ embeds: [levelEmbed] });
        }
    } catch (e) { console.error("[XP] Error:", e); }
}

// -----------------------------
// 8. INITIALIZATION
// -----------------------------
client.once("ready", async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    loadLocalFiles();
    await connectMongo();
});

// -----------------------------
// 9. VOICE CHANNEL CREATOR
// -----------------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
    // 1. Create Channel
    if (newState.channelId && CREATE_CHANNEL_IDS.includes(newState.channelId)) {
        const member = newState.member;
        const parent = newState.channel.parent;
        
        try {
            const ch = await newState.guild.channels.create({
                name: `🎧 ${member.user.username}'s VO`,
                type: ChannelType.GuildVoice,
                parent: parent,
                permissionOverwrites: [
                    { id: newState.guild.id, allow: [PermissionsBitField.Flags.Connect], deny: [PermissionsBitField.Flags.ManageChannels] },
                    { id: member.id, allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers] }
                ]
            });
            TEMP_VOICE_CHANNEL_IDS.add(ch.id);
            member.voice.setChannel(ch);
        } catch (e) { console.error("VO Create Error", e); }
    }
    
    // 2. Delete Channel
    if (oldState.channelId && TEMP_VOICE_CHANNEL_IDS.has(oldState.channelId)) {
        if (oldState.channel.members.size === 0) {
            oldState.channel.delete().catch(() => {});
            TEMP_VOICE_CHANNEL_IDS.delete(oldState.channelId);
        }
    }
});

// =====================================================
// 10. MAIN MESSAGE EVENT (FILTERS & COMMANDS)
// =====================================================
client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim();
    const lowerContent = content.toLowerCase();
    const isMod = isModerator(message.member);
    
    // ★ SILVER ROLE CHECK
    const isSilver = message.member.roles.cache.has(SILVER_ROLE_ID);

    // ---------------------------------------------------
    // A. SCAM & MALICIOUS PATTERNS (최우선 차단)
    // ---------------------------------------------------
    const scamPatterns = [
        "free nitro", "steamcommunity.com/gift", "airdrop", "discord.gg/invite", 
        "dlscord.gg", "bit.ly/", "tinyurl.com", "hacked"
    ];

    if (!isMod && scamPatterns.some(p => lowerContent.includes(p))) {
        if (message.deletable) message.delete().catch(() => {});
        const msg = await message.channel.send(`🚨 **${message.author}** Malicious/Scam link detected and blocked.`);
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return; // 종료
    }

    // ---------------------------------------------------
    // B. LINK & GIF FILTER
    // ---------------------------------------------------
    const hasLink = /(https?:\/\/[^\s]+)/.test(lowerContent);
    const hasDiscordInvite = /discord\.gg\//.test(lowerContent) && !lowerContent.includes("gosugeneral");
    const hasOnlyFans = lowerContent.includes("onlyfans") || lowerContent.includes("only fans");

    if (!isMod && (hasLink || hasDiscordInvite || hasOnlyFans)) {
        let allow = false;

        // ★ Silver Role: 일반 링크(GIF, 유튜브 등) 허용
        if (isSilver) {
            allow = true;
        }

        // ★ 예외: Silver라도 초대 링크와 야한 사이트는 차단
        if (hasDiscordInvite || hasOnlyFans) {
            allow = false;
        }

        if (!allow) {
            if (message.deletable) message.delete().catch(() => {});
            const msg = await message.channel.send(`🚫 **${message.author}** Links/GIFs are restricted to **Silver Rank (Level 10+)**.`);
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return; // 종료
        }
    }

    // ---------------------------------------------------
    // C. BLACKLIST WORD FILTER
    // ---------------------------------------------------
    if (!isMod && BLACKLISTED_WORDS.some(w => lowerContent.includes(w))) {
        if (message.deletable) message.delete().catch(() => {});
        const msg = await message.channel.send(`🚫 **${message.author}** Forbidden word detected.`);
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return; // 종료
    }

    // ---------------------------------------------------
    // D. XP GAIN (필터 통과 시)
    // ---------------------------------------------------
    await handleXpGain(message);

    // ---------------------------------------------------
    // E. COMMAND HANDLER
    // ---------------------------------------------------
    if (!content.startsWith("!")) return;

    const args = content.slice(1).split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Clean up command message (optional)
    if (!["ping", "invite", "rank", "leaderboard", "level"].includes(cmd)) {
        setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
    }

    // --- GENERAL COMMANDS ---
    if (cmd === "!ping") {
        return message.reply("Pong!");
    }
    if (cmd === "!invite") {
        return message.reply("📨 https://discord.gg/gosugeneral");
    }
    if (cmd === "!help") {
        const embed = new EmbedBuilder().setColor("#00FFFF").setTitle("🤖 Bot Commands")
            .setDescription(
                "**General**: `!ping`, `!invite`, `!rank`, `!leaderboard`, `!level`\n" +
                "**Mod**: `!kick`, `!mute`, `!unmute`, `!freeze`, `!unfreeze`, `!prune`, `!addword`, `!removeword`, `!listwords`\n" +
                "**Admin**: `!ban`, `!setupjoin`, `!welcome`, `!subscriber`, `!creator`, `!setmodlog`..."
            );
        return message.channel.send({ embeds: [embed] });
    }

    // --- LEVELING COMMANDS ---
    if (cmd === "!rank") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const target = message.mentions.users.first() || message.author;
        const data = await xpCollection.findOne({ guildId: message.guild.id, userId: target.id });
        
        if (!data) return message.reply("No XP data found.");
        
        const rank = (await xpCollection.countDocuments({ guildId: message.guild.id, xp: { $gt: data.xp } })) + 1;
        const embed = new EmbedBuilder().setColor("#00D1FF").setTitle(`📊 Rank: ${target.username}`)
            .addFields(
                { name: "Level", value: `${data.level}`, inline: true },
                { name: "XP", value: `${data.xp}`, inline: true },
                { name: "Rank", value: `#${rank}`, inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "!leaderboard") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
        
        const description = top.map((u, i) => `${i + 1}. <@${u.userId}> — Level ${u.level}`).join("\n");
        const embed = new EmbedBuilder().setColor("Gold").setTitle("🏆 Leaderboard").setDescription(description || "No data.");
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "!level") {
        const embed = new EmbedBuilder().setColor("Green").setTitle("🎯 Level Rewards")
            .setDescription(LEVEL_ROLES.map(r => `**Lv ${r.level}**: <@&${r.roleId}>`).join("\n"));
        return message.channel.send({ embeds: [embed] });
    }

    // --- MODERATION COMMANDS ---
    if (cmd === "!kick") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason";
        
        if (target && target.kickable) {
            await target.kick(reason);
            message.reply(`👢 Kicked ${target.user.tag}`);
            sendModLog(message.guild, target.user, "KICK", message.author, reason);
        } else {
            message.reply("❌ Cannot kick user.");
        }
    }

    if (cmd === "!ban") {
        if (!isAdmin(message.member)) return;
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "No reason";

        if (target && target.bannable) {
            await target.ban({ reason });
            message.reply(`🔨 Banned ${target.user.tag}`);
            sendModLog(message.guild, target.user, "BAN", message.author, reason);
        } else {
            message.reply("❌ Cannot ban user.");
        }
    }

    if (cmd === "!mute") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const mins = parseInt(args[1]);
        const reason = args.slice(2).join(" ") || "No reason";

        if (target && !isNaN(mins)) {
            await target.timeout(mins * 60 * 1000, reason);
            message.reply(`🔇 Muted ${target.user.tag} for ${mins}m`);
            sendModLog(message.guild, target.user, "MUTE", message.author, reason, mins);
        } else {
            message.reply("Usage: `!mute @user [minutes]`");
        }
    }

    if (cmd === "!unmute") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        if (target) {
            await target.timeout(null);
            message.reply(`🔊 Unmuted ${target.user.tag}`);
        }
    }

    if (cmd === "!freeze") {
        if (!isModerator(message.member)) return;
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.channel.send(`❄️ Channel ${channel} has been frozen.`);
    }

    if (cmd === "!unfreeze") {
        if (!isModerator(message.member)) return;
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
        message.channel.send(`♨️ Channel ${channel} has been thawed.`);
    }

    if (cmd === "!prune") {
        if (!isModerator(message.member)) return;
        const amount = parseInt(args[0]);
        if (amount && amount <= 100) {
            await message.channel.bulkDelete(amount, true);
            const msg = await message.channel.send(`🧹 Deleted ${amount} messages.`);
            setTimeout(() => msg.delete().catch(() => {}), 2000);
        } else {
            message.reply("Usage: `!prune 1-100`");
        }
    }

    // Blacklist Commands
    if (cmd === "!addword") {
        if (!isModerator(message.member)) return;
        const word = args.join(" ").toLowerCase();
        if (word) {
            BLACKLISTED_WORDS.push(word);
            saveBlacklist();
            message.reply(`✅ Added "${word}" to blacklist.`);
        }
    }

    if (cmd === "!removeword") {
        if (!isModerator(message.member)) return;
        const word = args.join(" ").toLowerCase();
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(w => w !== word);
        saveBlacklist();
        message.reply(`✅ Removed "${word}" from blacklist.`);
    }

    if (cmd === "!listwords") {
        if (!isModerator(message.member)) return;
        message.reply(`🚫 **Blacklist:** ${BLACKLISTED_WORDS.join(", ")}`);
    }

    if (cmd === "!reloadblacklist") {
        if (!isAdmin(message.member)) return;
        loadLocalFiles();
        message.reply("✅ Blacklist reloaded.");
    }

    // Role Commands
    if (cmd === "!addrole") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const roleName = args.slice(1).join(" ");
        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        
        if (target && role) {
            await target.roles.add(role);
            message.reply(`✅ Added role **${role.name}**.`);
        } else {
            message.reply("Usage: `!addrole @user RoleName`");
        }
    }

    if (cmd === "!removerole") {
        if (!isModerator(message.member)) return;
        const target = message.mentions.members.first();
        const roleName = args.slice(1).join(" ");
        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        
        if (target && role) {
            await target.roles.remove(role);
            message.reply(`✅ Removed role **${role.name}**.`);
        }
    }

    // --- ADMIN SETUP COMMANDS (PANELS) ---
    if (cmd === "!setupjoin") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅")
        );
        // Banner
        if (RULES_BANNER_URL) await message.channel.send({ files: [RULES_BANNER_URL] });
        
        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("📜 Server Rules").setDescription("Please read the rules and click the button below.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "!welcome") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("YouTube").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu")
        );
        if (WELCOME_BANNER_URL) await message.channel.send({ files: [WELCOME_BANNER_URL] });
        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("Welcome!").setDescription("Enjoy your stay.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "!subscriber") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Subscribe").setStyle(ButtonStyle.Primary).setEmoji("🔔")
        );
        if (NOTIFICATION_BANNER_URL) await message.channel.send({ files: [NOTIFICATION_BANNER_URL] });
        const embed = new EmbedBuilder().setColor("#FF0000").setTitle("🔴 Live Notifications").setDescription("Click to toggle alerts.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === "!creator") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("apply_creator").setLabel("Apply").setStyle(ButtonStyle.Secondary)
        );
        if (CREATOR_BANNER_URL) await message.channel.send({ files: [CREATOR_BANNER_URL] });
        const embed = new EmbedBuilder().setColor("#FFB347").setTitle("👑 Creator Role").setDescription("Apply for creator verification.");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- LOG CONFIG COMMANDS ---
    if (cmd.startsWith("!set") && cmd.includes("log")) {
        if (!isAdmin(message.member)) return;
        const channel = message.mentions.channels.first() || message.channel;
        
        if (cmd === "!setmodlog") BOT_CONFIG.modLogChannelId = channel.id;
        if (cmd === "!setmsglog") BOT_CONFIG.msgLogChannelId = channel.id;
        if (cmd === "!setactionlog") BOT_CONFIG.actionLogChannelId = channel.id;
        if (cmd === "!setfilterlog") BOT_CONFIG.filterLogChannelId = channel.id;
        
        saveConfig();
        message.reply(`✅ **${cmd.replace("set", "").toUpperCase()}** set to ${channel}.`);
    }
});

// =====================================================
// 11. EVENT LOGGING (Delete/Update/Members)
// =====================================================
client.on("messageDelete", async (message) => {
    if (!message.guild || !BOT_CONFIG.msgLogChannelId) return;
    const ch = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (ch) {
        const embed = new EmbedBuilder().setColor("Red").setTitle("🗑️ Message Deleted")
            .setDescription(`**User:** ${message.author?.tag}\n**Content:** ${message.content || "N/A"}`);
        ch.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on("messageUpdate", async (oldM, newM) => {
    if (!newM.guild || !BOT_CONFIG.msgLogChannelId || oldM.content === newM.content) return;
    const ch = newM.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
    if (ch) {
        const embed = new EmbedBuilder().setColor("Orange").setTitle("✏️ Message Edited")
            .addFields({ name: "Old", value: oldM.content.substring(0, 1000) || "N/A" }, { name: "New", value: newM.content.substring(0, 1000) || "N/A" });
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

// =====================================================
// 12. BUTTON INTERACTIONS
// =====================================================
client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    const { customId, member } = i;

    try {
        if (customId === "agree_rules") {
            await member.roles.add(GOSU_ROLE);
            i.reply({ content: "✅ Welcome! Access Granted.", ephemeral: true });
        }
        if (customId === "subscribe_toggle") {
            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(SUB_ROLE);
                i.reply({ content: "🔕 Unsubscribed.", ephemeral: true });
            } else {
                await member.roles.add(SUB_ROLE);
                i.reply({ content: "🔔 Subscribed!", ephemeral: true });
            }
        }
        if (customId === "apply_creator") {
            i.reply({ content: "📝 Application submitted.", ephemeral: true });
        }
    } catch (e) { console.error(e); }
});

// =====================================================
// 13. BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);
