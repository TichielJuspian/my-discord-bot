// =====================================================================
// Gosu Custom Discord Bot (Final Split Version - Part 1)
// Setup, Config, MongoDB (Cloud Safe), Zombie Fix
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
// 1. CONFIGURATION
// ---------------------------------------------------------------------
// ROLE IDs
const GOSU_ROLE = "496717793388134410";
const MOD_ROLE = "495727371140202506";
const ADMIN_ROLE = "495718851288236032";
const SUB_ROLE = "497654614729031681";
const CREATOR_ROLE = "1441214177128743017";
const VERIFICATION_ROLE = "1441311763806031893";
const SILVER_ROLE_ID = "497491254838427674"; 

// VOICE CHANNEL IDs
const CREATE_CHANNEL_IDS = ["720658789832851487", "1441159364298936340"];
const TEMP_VOICE_CHANNEL_IDS = new Set();

// XP CONFIG
const XP_CONFIG = {
  minXP: 5,
  maxXP: 15,
  cooldownMs: 30000, 
};

const LEVEL_ROLES = [
  { level: 5, roleId: "497843968151781378" },
  { level: 10, roleId: SILVER_ROLE_ID },
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
// 2. STATE & DATABASE
// ---------------------------------------------------------------------
let BOT_CONFIG = {
  actionLogChannelId: null,
  msgLogChannelId: null,
  modLogChannelId: null,
  filterLogChannelId: null,
};
let BLACKLISTED_WORDS = [];
const xpCooldowns = new Map();

// MongoDB Clients
const mongoClient = new MongoClient(process.env.MONGODB_URI);
let xpCollection = null;
let configCollection = null;
let blacklistCollection = null;

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

// ---------------------------------------------------------------------
// 3. HELPER FUNCTIONS
// ---------------------------------------------------------------------
function isModerator(member) {
    if (!member) return false;
    return member.roles.cache.has(MOD_ROLE) || member.roles.cache.has(ADMIN_ROLE) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}
function isAdmin(member) {
    if (!member) return false;
    return member.roles.cache.has(ADMIN_ROLE) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// DB Connection & Load
async function connectAndLoad() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(process.env.MONGODB_DB_NAME || "gosuBot");
        
        xpCollection = db.collection("user_xp");
        configCollection = db.collection("bot_config");
        blacklistCollection = db.collection("bot_blacklist");

        console.log("[MONGO] Connected to Atlas.");

        // Load Config
        const configDoc = await configCollection.findOne({ _id: "global_config" });
        if (configDoc) {
            BOT_CONFIG = configDoc.data;
            console.log("[DB] Config loaded.");
        } else {
            await configCollection.insertOne({ _id: "global_config", data: BOT_CONFIG });
        }

        // Load Blacklist
        const blacklistDoc = await blacklistCollection.findOne({ _id: "global_blacklist" });
        if (blacklistDoc) {
            BLACKLISTED_WORDS = blacklistDoc.words;
            console.log(`[DB] Blacklist loaded (${BLACKLISTED_WORDS.length} words).`);
        } else {
            await blacklistCollection.insertOne({ _id: "global_blacklist", words: [] });
        }

    } catch (e) { console.error("[MONGO] Init Error:", e); }
}

async function saveConfig() {
    if (configCollection) await configCollection.updateOne({ _id: "global_config" }, { $set: { data: BOT_CONFIG } }, { upsert: true });
}
async function saveBlacklist() {
    if (blacklistCollection) await blacklistCollection.updateOne({ _id: "global_blacklist" }, { $set: { words: BLACKLISTED_WORDS } }, { upsert: true });
}

// ---------------------------------------------------------------------
// 4. BOT READY (Zombie Fix Included)
// ---------------------------------------------------------------------
client.once("ready", async () => {
    console.log(`\n[BOT] Logged in as ${client.user.tag}`);
    await connectAndLoad();

    // Zombie Voice Channel Cleanup
    const guilds = client.guilds.cache.map(g => g);
    for (const guild of guilds) {
        try {
            const channels = await guild.channels.fetch();
            channels.forEach(ch => {
                if (ch.type === ChannelType.GuildVoice && ch.name.startsWith("🎧")) {
                    if (ch.members.size === 0) {
                        ch.delete().catch(() => {});
                        console.log(`[VOICE] Cleaned zombie channel: ${ch.name}`);
                    } else {
                        TEMP_VOICE_CHANNEL_IDS.add(ch.id);
                    }
                }
            });
        } catch (e) {}
    }
    
    client.user.setActivity("Gosu General TV", { type: ActivityType.Watching });
});
// =====================================================================
// Gosu Custom Discord Bot (Final Split Version - Part 2)
// XP Logic, Logging, Voice Creator
// =====================================================================

// XP Formulas
function getTotalXpForLevel(level) {
    if (level <= 0) return 0;
    return 100 * level * level - 100;
}
function getLevelFromTotalXp(totalXp) {
    let level = 0;
    while (totalXp >= getTotalXpForLevel(level + 1)) level++;
    return level;
}

// XP Handler
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
        if (!data) return;

        const calculatedLevel = getLevelFromTotalXp(data.xp);
        if (data.level !== calculatedLevel) {
            await xpCollection.updateOne({ _id: data._id }, { $set: { level: calculatedLevel } });
            if (calculatedLevel > data.level) {
                for (const reward of LEVEL_ROLES) {
                    if (data.level < reward.level && calculatedLevel >= reward.level) {
                        const role = message.guild.roles.cache.get(reward.roleId);
                        if (role) {
                            await message.member.roles.add(role).catch(() => {});
                            if (reward.roleId === SILVER_ROLE_ID) {
                                message.channel.send(`🥈 **${message.author}** achieved **Silver Rank**! GIFs unlocked.`);
                            }
                        }
                    }
                }
                const embed = new EmbedBuilder().setColor("#00FF7F").setDescription(`🎉 **${message.author}** reached **Level ${calculatedLevel}**!`);
                message.channel.send({ embeds: [embed] });
            }
        }
    } catch (e) { console.error("[XP] Error:", e); }
}

// Mod Logger
async function sendModLog(guild, user, action, mod, reason) {
    if (!BOT_CONFIG.modLogChannelId) return;
    const ch = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if(ch) ch.send({ embeds: [new EmbedBuilder().setColor("Red").setTitle(action).setDescription(`Target: ${user.tag}\nMod: ${mod.tag}\nReason: ${reason}`).setTimestamp()] }).catch(()=>{});
}

// Voice Creator
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
    if (oldS.channelId && TEMP_VOICE_CHANNEL_IDS.has(oldS.channelId) && oldS.channel.members.size===0) {
        oldS.channel.delete().catch(()=>{});
        TEMP_VOICE_CHANNEL_IDS.delete(oldS.channelId);
    }
});

// =====================================================================
// Gosu Custom Discord Bot (Final Split Version - Part 3)
// Filters & Unified Command Handler (Fixed Prefix Parsing)
// =====================================================================

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim();
    const isCommand = content.startsWith("!");
    const lowerContent = content.toLowerCase();
    const isMod = isModerator(message.member);
    const isSilver = message.member.roles.cache.has(SILVER_ROLE_ID);

    // 1. CHAT FILTERS (Only for non-mods and non-commands)
    if (!isMod && !isCommand) {
        const scams = ["free nitro", "steamcommunity.com", "discord.gg/invite", "dlscord.gg", "bit.ly/"];
        if (scams.some(s => lowerContent.includes(s))) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚨 **${message.author.username}** Scam link blocked.`).then(m=>setTimeout(()=>m.delete(),5000));
        }
        
        const hasLink = /(https?:\/\/[^\s]+)/.test(lowerContent);
        if (hasLink && !isSilver) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚫 **${message.author.username}** Links require **Silver Rank (Lv 10)**.`).then(m=>setTimeout(()=>m.delete(),5000));
        }

        if (BLACKLISTED_WORDS.some(w => lowerContent.includes(w))) {
            if(message.deletable) message.delete().catch(()=>{});
            return message.channel.send(`🚫 **${message.author.username}** Forbidden word detected.`).then(m=>setTimeout(()=>m.delete(),5000));
        }
    }

    // 2. XP SYSTEM (Process if not a command)
    if (!isCommand) {
        await handleXpGain(message);
        return; 
    }

    // 3. COMMAND PARSING
    const args = content.slice(1).split(/ +/); // Remove "!" and split
    const cmd = args.shift().toLowerCase();    // Now cmd is "ping", "rank", etc.

    // Auto-delete command messages for cleanliness (except general ones)
    const keepMessages = ["ping", "invite", "rank", "leaderboard", "level", "help"];
    if (!keepMessages.includes(cmd)) {
        setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
    }

    // --- GENERAL COMMANDS ---
    if (cmd === "ping") return message.reply("Pong!");
    
    if (cmd === "invite") return message.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");

    if (cmd === "help") {
        const embed = new EmbedBuilder()
            .setColor("#00FFFF")
            .setTitle("🤖 Gosu Bot Command List")
            .setDescription("Full list of available commands:")
            .addFields(
                { name: "🌐 General", value: "`!rank` / `!rank @user`\n`!leaderboard`\n`!level`\n`!invite` / `!ping`" },
                { name: "🛡️ Mod", value: "`!kick` / `!mute` / `!unmute`\n`!freeze` / `!unfreeze`\n`!prune <n>`\n`!addword` / `!removeword`" },
                { name: "⚙️ Admin", value: "`!ban` / `!syncrolexp`\n`!setmodlog` / `!setmsglog` / `!setactionlog`\n`!setupjoin` / `!welcome` / `!subscriber` / `!creator`" }
            )
            .setFooter({ text: "Gosu General TV" });
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "rank") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const targetMember = message.mentions.members.first() || message.member;
        const targetUser = targetMember.user;
        const data = await xpCollection.findOne({ guildId: message.guild.id, userId: targetUser.id });
        
        if (!data) {
            return message.reply(targetUser.id === message.author.id ? "📊 You don't have XP yet." : `❌ **${targetUser.username}** has no XP data.`);
        }

        const rank = (await xpCollection.countDocuments({ guildId: message.guild.id, xp: { $gt: data.xp } })) + 1;
        const currentLevel = data.level || 0;
        const nextLevelBaseXp = 100 * (currentLevel + 1) * (currentLevel + 1);
        const xpCurrentProgress = data.xp - (100 * currentLevel * currentLevel || 0);
        const xpNeeded = nextLevelBaseXp - (100 * currentLevel * currentLevel || 0);
        
        const percent = Math.min(Math.max(xpCurrentProgress / xpNeeded, 0), 1);
        const bar = "█".repeat(Math.round(percent * 15)) + "░".repeat(15 - Math.round(percent * 15));

        const nextRewardEntry = LEVEL_ROLES.find(r => r.level > currentLevel);
        let rewardText = "🎉 Max rewards reached!";
        if (nextRewardEntry) {
            const xpLeft = (100 * nextRewardEntry.level * nextRewardEntry.level) - data.xp;
            rewardText = `**${xpLeft.toLocaleString()} XP** left until **Lv ${nextRewardEntry.level}**`;
        }

        const embed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor === "#000000" ? "#9B59B6" : targetMember.displayHexColor)
            .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "🧬 Level", value: `${currentLevel}`, inline: true },
                { name: "🏆 Rank", value: `#${rank}`, inline: true },
                { name: "⭐ XP", value: `${data.xp.toLocaleString()}`, inline: true },
                { name: "📈 Progress", value: `${bar} **${Math.floor(percent * 100)}%**\n${xpCurrentProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP` },
                { name: "🎁 Next Reward", value: rewardText }
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "leaderboard") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
        if (!top.length) return message.reply("📉 No data.");
        
        const topMember = message.guild.members.cache.get(top[0].userId);
        const topAvatar = topMember ? topMember.user.displayAvatarURL({ dynamic: true }) : message.guild.iconURL();

        let list = "";
        for (let i = 0; i < top.length; i++) {
            const member = message.guild.members.cache.get(top[i].userId);
            const name = member ? `**${member.user.username}**` : "Unknown";
            let medal = `#${i + 1}`;
            if (i === 0) medal = "🥇"; if (i === 1) medal = "🥈"; if (i === 2) medal = "🥉";
            list += `${medal} ${name} — Lv ${top[i].level} (${(top[i].xp / 1000).toFixed(1)}k XP)\n`;
        }

        const embed = new EmbedBuilder().setColor("#FFD700").setTitle("🏆 Leaderboard").setThumbnail(topAvatar).setDescription(list);
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "level") {
        const data = await xpCollection.findOne({ guildId: message.guild.id, userId: message.author.id });
        const userLevel = data ? data.level : 0;
        const list = LEVEL_ROLES.map(r => {
            const role = message.guild.roles.cache.get(r.roleId);
            return `${userLevel >= r.level ? "✅" : "🔒"} **Lv ${r.level}** — ${role ? role.toString() : "Unknown Role"}`;
        }).join("\n");
        const embed = new EmbedBuilder().setColor("Green").setTitle("🎯 Level Rewards").setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setDescription(`**Your Level: ${userLevel}**\n\n${list}`);
        return message.channel.send({ embeds: [embed] });
    }
// --- MODERATION ---
    if (cmd === "kick" && isMod) {
        const t = message.mentions.members.first();
        if(t?.kickable) { await t.kick(); message.reply(`👢 Kicked **${t.user.username}**.`); sendModLog(message.guild, t.user, "KICK", message.author, args.slice(1).join(" ")); }
    }
    if (cmd === "ban" && isAdmin(message.member)) {
        const t = message.mentions.members.first();
        if(t?.bannable) { await t.ban(); message.reply(`🔨 Banned **${t.user.username}**.`); sendModLog(message.guild, t.user, "BAN", message.author, args.slice(1).join(" ")); }
    }
    if (cmd === "mute" && isMod) {
        const t = message.mentions.members.first();
        const m = parseInt(args[1]);
        if(t && m) { await t.timeout(m*60000); message.reply(`🔇 Muted **${t.user.username}** for ${m}m.`); }
    }
    if (cmd === "freeze" && isMod) {
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.channel.send("❄️ Frozen");
    }
    if (cmd === "unfreeze" && isMod) {
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
        message.channel.send("♨️ Thawed");
    }
    if (cmd === "prune" && isMod) {
        const n = parseInt(args[0]);
        if(n) message.channel.bulkDelete(n, true);
    }
    if (cmd === "addword" && isMod) {
        const w = args.join(" ").toLowerCase();
        if(w) { BLACKLISTED_WORDS.push(w); await saveBlacklist(); message.reply("Added to DB."); }
    }
    if (cmd === "syncrolexp" && isAdmin(message.member)) {
        message.reply("🔄 Syncing...");
        let c = 0;
        for (const r of LEVEL_ROLES) {
            const role = message.guild.roles.cache.get(r.roleId);
            if (!role) continue;
            for (const [id, m] of role.members) {
                await xpCollection.updateOne({ guildId: message.guild.id, userId: id }, { $set: { level: r.level, xp: 100 * r.level * r.level } }, { upsert: true });
                c++;
            }
        }
        message.channel.send(`✅ Synced **${c}** users.`);
    }

    // --- ADMIN PANELS ---
    const BANNERS = {
        RULES: "https://github.com/TichielJuspian/images/blob/main/must%20read.png?raw=true", 
        WELCOME: "https://github.com/TichielJuspian/images/blob/main/welcome.png?raw=true", 
        NOTI: "https://github.com/TichielJuspian/images/blob/main/NOTIFICATION.png?raw=true", 
        CREATOR: "https://github.com/TichielJuspian/images/blob/main/verification.png?raw=true" 
    };

    if (cmd === "setupjoin" && isAdmin(message.member)) {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅"));
        await message.channel.send({ files: [BANNERS.RULES] });
        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("📜 Server Rules").setDescription("Please read the rules and click Agree to join.");
        message.channel.send({ embeds: [embed], components: [row] });
    }
    if (cmd === "welcome" && isAdmin(message.member)) {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("YouTube").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu"));
        await message.channel.send({ files: [BANNERS.WELCOME] });
        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("Welcome!").setDescription("Enjoy your stay at Gosu General TV!");
        message.channel.send({ embeds: [embed], components: [row] });
    }
    if (cmd === "subscriber" && isAdmin(message.member)) {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Toggle Notifications").setStyle(ButtonStyle.Primary).setEmoji("🔔"));
        await message.channel.send({ files: [BANNERS.NOTI] });
        message.channel.send({ embeds: [new EmbedBuilder().setColor("#FF0000").setTitle("🔔 Live Notifications").setDescription("Click below to toggle alerts.")], components: [row] });
    }
    if (cmd === "creator" && isAdmin(message.member)) {
        await message.channel.send({ files: [BANNERS.CREATOR] });
        const embed = new EmbedBuilder().setColor("#FFB347").setTitle("👑 Creator Role").setDescription("To get the Creator role, link your YouTube/Twitch account in Discord settings. 100+ followers required.");
        message.channel.send({ embeds: [embed] });
    }

    // --- LOG SETTINGS ---
    if (cmd.startsWith("set") && cmd.includes("log") && isAdmin(message.member)) {
        const ch = message.mentions.channels.first() || message.channel;
        if (cmd === "setmodlog") BOT_CONFIG.modLogChannelId = ch.id;
        if (cmd === "setmsglog") BOT_CONFIG.msgLogChannelId = ch.id;
        if (cmd === "setactionlog") BOT_CONFIG.actionLogChannelId = ch.id;
        await saveConfig(); 
        message.reply(`✅ Log set to ${ch}`);
    }
}); // End of messageCreate

// --- EVENTS ---
client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    try {
        if (i.customId === "agree_rules") {
            await i.member.roles.add(GOSU_ROLE);
            i.reply({ content: "✅ Welcome!", ephemeral: true });
        }
        if (i.customId === "subscribe_toggle") {
            if (i.member.roles.cache.has(SUB_ROLE)) { await i.member.roles.remove(SUB_ROLE); i.reply({ content: "🔕 Notifications Off", ephemeral: true }); }
            else { await i.member.roles.add(SUB_ROLE); i.reply({ content: "🔔 Notifications On!", ephemeral: true }); }
        }
    } catch (e) { i.reply({ content: "Error processing request.", ephemeral: true }); }
});

client.on("messageDelete", m => {
    if(BOT_CONFIG.msgLogChannelId && m.guild) m.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId)?.send(`🗑️ Deleted: ${m.author?.tag} - ${m.content}`).catch(()=>{});
});

client.login(process.env.Bot_Token);
