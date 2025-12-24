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
// Filters & Commands (Rich Help + Premium Rank + No Ping)
// =====================================================================

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim();
    const args = content.slice(1).split(/ +/);
    const cmd = args.shift().toLowerCase();
    const isCommand = content.startsWith("!");
    const lowerContent = content.toLowerCase();
    const isMod = isModerator(message.member);
    const isSilver = message.member.roles.cache.has(SILVER_ROLE_ID);

    // 1. FILTER LOGIC
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

    if (!isCommand) {
        await handleXpGain(message);
        return; 
    }

    // 2. COMMAND LOGIC
    if (!["ping", "invite", "rank", "leaderboard", "level", "help"].includes(cmd)) {
        setTimeout(() => { if (!message.deleted) message.delete().catch(() => {}); }, 1000);
    }

    if (cmd === "ping") return message.reply("Pong!");
    if (cmd === "invite") return message.reply("📨 **Official Invite:** https://discord.gg/gosugeneral");
    
    // [RESTORED RICH HELP COMMAND]
    if (cmd === "help") {
        const embed = new EmbedBuilder()
            .setColor("#00FFFF")
            .setTitle("🤖 Gosu Bot Command List")
            .setDescription("Here is the full list of available commands.")
            .addFields(
                { 
                    name: "🌐 General", 
                    value: "`!rank` — Check your (or others') rank & XP\n`!leaderboard` — View Top 10 users\n`!level` — View level rewards\n`!invite` — Get server invite link", 
                    inline: false 
                },
                { 
                    name: "🛡️ Moderation (Mod Only)", 
                    value: "`!kick <@user>` — Kick a user\n`!mute <@user> <min>` — Timeout a user\n`!unmute <@user>` — Remove timeout\n`!freeze` / `!unfreeze` — Lock/Unlock channel\n`!prune <n>` — Delete <n> messages\n`!addword <word>` / `!removeword` — Manage blacklist", 
                    inline: false 
                },
                { 
                    name: "⚙️ Admin & Setup (Admin Only)", 
                    value: "`!ban <@user>` — Ban a user\n`!syncrolexp` — Sync XP based on roles\n`!reloadblacklist` — Reload bad words from DB\n\n**Panels:**\n`!setupjoin` — Rules Panel\n`!welcome` — Welcome Panel\n`!subscriber` — Notification Panel\n`!creator` — Creator Verify Panel", 
                    inline: false 
                },
                {
                    name: "📝 Log Configuration",
                    value: "`!setmodlog #ch` / `!clearmodlog`\n`!setmsglog #ch` / `!clearmsglog`\n`!setactionlog #ch` / `!clearactionlog`",
                    inline: false
                }
            )
            .setFooter({ text: "Gosu General TV", iconURL: message.guild.iconURL() });

        return message.channel.send({ embeds: [embed] });
    }

   // [PREMIUM RANK CARD - MENTION SUPPORT RESTORED]
    if (cmd === "!rank") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        
        // 1. Determine Target: Mentioned User OR Self
        // If user typed "!rank @Gosu", target is Gosu.
        // If user typed "!rank", target is Self.
        const targetMember = message.mentions.members.first() || message.member;
        const targetUser = targetMember.user;
        const guildId = message.guild.id;

        // 2. Fetch Data
        const data = await xpCollection.findOne({ guildId, userId: targetUser.id });
        
        if (!data) {
            if (targetUser.id === message.author.id) {
                return message.reply("📊 You don't have any XP yet. Start chatting to earn some!");
            } else {
                return message.reply(`❌ **${targetUser.username}** has no XP data yet.`);
            }
        }

        // 3. Calculate Stats
        const currentLevel = data.level || 0;
        
        // XP Calculation (Quadratic Formula)
        const currentLevelBaseXp = currentLevel === 0 ? 0 : (100 * currentLevel * currentLevel);
        const nextLevelBaseXp = 100 * (currentLevel + 1) * (currentLevel + 1);
        
        const xpNeededForNextLevel = nextLevelBaseXp - currentLevelBaseXp;
        const xpCurrentProgress = data.xp - currentLevelBaseXp;

        // Rank Calculation
        const rank = (await xpCollection.countDocuments({ guildId, xp: { $gt: data.xp } })) + 1;
        const totalUsers = await xpCollection.countDocuments({ guildId });

        // 4. Progress Bar & Percent
        const percentRaw = Math.min(Math.max(xpCurrentProgress / xpNeededForNextLevel, 0), 1);
        const percentText = Math.floor(percentRaw * 100);
        
        const totalBars = 15;
        const filledBars = Math.round(percentRaw * totalBars);
        const emptyBars = totalBars - filledBars;
        const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

        // 5. Next Reward Info
        const nextRewardEntry = LEVEL_ROLES.find(r => r.level > currentLevel);
        let nextRewardText = "🎉 You have unlocked all rewards!";
        
        if (nextRewardEntry) {
            const role = message.guild.roles.cache.get(nextRewardEntry.roleId);
            const roleName = role ? role.name : `Level ${nextRewardEntry.level} Role`;
            
            const rewardTotalXp = 100 * nextRewardEntry.level * nextRewardEntry.level;
            const xpRemaining = rewardTotalXp - data.xp;
            
            nextRewardText = `**${xpRemaining.toLocaleString()} XP** left until **${roleName}** (Lv ${nextRewardEntry.level})`;
        }

        // 6. Build Embed
        const rankEmbed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor === "#000000" ? "#9B59B6" : targetMember.displayHexColor)
            .setAuthor({ name: `${targetUser.username}'s Rank`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "🧬 Level", value: `${currentLevel}`, inline: true },
                { name: "🏆 Rank", value: `#${rank} / ${totalUsers}`, inline: true },
                { name: "⭐ XP", value: `${data.xp.toLocaleString()}`, inline: true },
                { name: "📈 Progress", value: `${progressBar} **${percentText}%**\n${xpCurrentProgress.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP`, inline: false },
                { name: "🎁 Next Reward", value: nextRewardText, inline: false }
            )
            .setFooter({ text: "Gosu General TV — Rank System", iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [rankEmbed] });
    }

    // [PREMIUM LEADERBOARD - MEDALS & TOP IMAGE]
    if (cmd === "leaderboard") {
        if (!xpCollection) return message.reply("⚠ XP System Offline.");
        const top = await xpCollection.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10).toArray();
        if (!top.length) return message.reply("📉 No data.");
        
        const topMember = message.guild.members.cache.get(top[0].userId);
        const topAvatar = topMember ? topMember.user.displayAvatarURL({ dynamic: true }) : message.guild.iconURL();

        let description = "";
        for (let i = 0; i < top.length; i++) {
            const u = top[i];
            const member = message.guild.members.cache.get(u.userId);
            const name = member ? `**${member.user.username}**` : "Unknown";
            
            let rankEmoji = `#${i + 1}`;
            if (i === 0) rankEmoji = "🥇"; if (i === 1) rankEmoji = "🥈"; if (i === 2) rankEmoji = "🥉";
            
            description += `${rankEmoji} ${name} — Lv ${u.level} (${(u.xp / 1000).toFixed(1)}k XP)\n`;
        }

        const embed = new EmbedBuilder().setColor("#FFD700").setTitle("🏆 Server Leaderboard").setThumbnail(topAvatar).setDescription(description).setFooter({ text: "Keep chatting to climb the ranks!" });
        return message.channel.send({ embeds: [embed] });
    }

    // [LEVEL CHECKLIST - CLICKABLE ROLES]
    if (cmd === "level") {
        let userLevel = 0;
        if (xpCollection) {
            const d = await xpCollection.findOne({ guildId: message.guild.id, userId: message.author.id });
            if (d) userLevel = d.level;
        }
        const list = LEVEL_ROLES.map(r => {
            const role = message.guild.roles.cache.get(r.roleId);
            const roleName = role ? role.toString() : "Unknown Role";
            return `${userLevel >= r.level ? "✅" : "🔒"} **Lv ${r.level}** — ${roleName}`;
        }).join("\n");
        const embed = new EmbedBuilder().setColor("Green").setTitle("🎯 Level Rewards").setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setDescription(`**Current Level: ${userLevel}**\n\n${list}`);
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === "syncrolexp") {
        if(!isAdmin(message.member)) return;
        message.reply("🔄 Syncing...");
        let c = 0;
        for (const r of LEVEL_ROLES) {
            const role = message.guild.roles.cache.get(r.roleId);
            if (!role) continue;
            for (const [id, m] of role.members) {
                const min = getTotalXpForLevel(r.level);
                const doc = await xpCollection.findOne({ guildId: message.guild.id, userId: id });
                if (!doc || doc.level < r.level) {
                    await xpCollection.updateOne({ guildId: message.guild.id, userId: id }, { $set: { level: r.level, xp: min } }, { upsert: true });
                    c++;
                }
            }
        }
        message.channel.send(`✅ Synced **${c}** users.`);
    }

    // MODERATION
    if (cmd === "kick") {
        if(!isMod) return;
        const t = message.mentions.members.first();
        if(t?.kickable) { await t.kick(); message.reply(`👢 Kicked **${t.user.username}**.`); sendModLog(message.guild, t.user, "KICK", message.author, args.slice(1).join(" ")); }
    }
    if (cmd === "ban") {
        if(!isAdmin(message.member)) return;
        const t = message.mentions.members.first();
        if(t?.bannable) { await t.ban(); message.reply(`🔨 Banned **${t.user.username}**.`); sendModLog(message.guild, t.user, "BAN", message.author, args.slice(1).join(" ")); }
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
    
    // DB CONFIG COMMANDS
    if (cmd === "addword") {
        if(!isMod) return;
        const w = args.join(" ").toLowerCase();
        if(w) { BLACKLISTED_WORDS.push(w); await saveBlacklist(); message.reply("Added."); }
    }
    if (cmd === "removeword") {
        if(!isMod) return;
        const w = args.join(" ").toLowerCase();
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(x => x !== w);
        await saveBlacklist(); 
        message.reply("Removed.");
    }
    if (cmd === "reloadblacklist") {
        if (!isAdmin(message.member)) return;
        await connectAndLoad();
        message.reply("✅ Blacklist refreshed from DB.");
    }

// =====================================================================
// Gosu Custom Discord Bot (Final Split Version - Part 4)
// Admin Panels, Logs, Login (Creator Guide Updated)
// =====================================================================

    // -------------------------------------------------------------
    // [Image Banner Setup] GitHub Permanent Links
    // -------------------------------------------------------------
    const BANNERS = {
        RULES: "https://github.com/TichielJuspian/images/blob/main/must%20read.png?raw=true", 
        WELCOME: "https://github.com/TichielJuspian/images/blob/main/welcome.png?raw=true", 
        NOTI: "https://github.com/TichielJuspian/images/blob/main/NOTIFICATION.png?raw=true", 
        CREATOR: "https://github.com/TichielJuspian/images/blob/main/verification.png?raw=true" 
    };

    if (cmd === "reloadblacklist") {
        if (!isAdmin(message.member)) return;
        await connectAndLoad();
        message.reply("✅ Blacklist refreshed from Database.");
    }

    // 1. RULES PANEL (!setupjoin)
    if (cmd === "!setupjoin") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("agree_rules").setLabel("Agree To Rules").setStyle(ButtonStyle.Success).setEmoji("✅"));
        
        try { await message.channel.send({ files: [BANNERS.RULES] }); } catch (e) {}

        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Community!").setDescription("Here you can join events, get updates, talk with the community, and enjoy the content together.\n\n--------------------------------------------------\n\n📜 **Server Rules**\n\n✨ **1 – Be Respectful**\nTreat everyone kindly. No harassment, bullying, or toxicity.\n\n✨ **2 – No Spam**\nAvoid repeated messages, emoji spam, or unnecessary mentions.\n\n✨ **3 – No NSFW or Harmful Content**\nNo adult content, gore, or anything unsafe.\n\n✨ **4 – No Advertising**\nNo links, promos, or self-promotion without staff approval.\n\n✨ **5 – Keep it Clean**\nNo hate speech, slurs, or extreme drama.\n\n✨ **6 – Follow Staff Instructions**\nIf staff gives instructions, please follow them.\n\n--------------------------------------------------\nPress **Agree To Rules** below to enter and enjoy the server! 🎊");
        message.channel.send({ embeds: [embed], components: [row] });
    }

    // 2. WELCOME PANEL (!welcome)
    if (cmd === "!welcome") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("YouTube Channel").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu"), new ButtonBuilder().setLabel("Twitch Channel").setStyle(ButtonStyle.Link).setURL("https://twitch.tv/gosugeneral"), new ButtonBuilder().setLabel("Invite Link").setStyle(ButtonStyle.Link).setURL("https://discord.gg/gosugeneral"));
        
        try { await message.channel.send({ files: [BANNERS.WELCOME] }); } catch (e) {}

        const embed = new EmbedBuilder().setColor("#1e90ff").setTitle("✨ Welcome to the Gosu General TV Discord Server!").setDescription("Greetings, adventurer!\n\nWelcome to the **Gosu General TV** community server.\nHere you can hang out with the community, share plays, ask questions, receive announcements, and join events together.\n\n---\n\n📌 **What you can find here**\n\n• Live stream notifications & announcements\n• Game discussions and guides\n• Clips, highlights, and community content\n• Chill chat with other Gosu viewers\n\n---\nEnjoy your stay and have fun! 💙").addFields({ name: "Official Links", value: "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://twitch.tv/gosugeneral)", inline: true }, { name: "Discord Invite Link", value: "🔗 [Invite Link](https://discord.gg/gosugeneral)", inline: true });
        message.channel.send({ embeds: [embed], components: [row] });
    }

    // 3. SUBSCRIBER PANEL (!subscriber)
    if (cmd === "!subscriber") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("subscribe_toggle").setLabel("Subscribe / Unsubscribe").setStyle(ButtonStyle.Primary).setEmoji("🔔"));
        
        try { await message.channel.send({ files: [BANNERS.NOTI] }); } catch (e) {}

        const embed = new EmbedBuilder().setColor("#FF0000").setTitle("🔔 Live Notification Subscription").setDescription("Stay updated with **Live Streams** and **New Uploads**!\n\nBy subscribing, you will receive:\n• 🔴 Live stream alerts\n• 🆕 New YouTube upload notifications\n• 📢 Special announcements\n\n---\n\n📌 **How It Works**\n\n• Press once → **Subscribe**\n• Press again → **Unsubscribe**\n\n---\nEnjoy real-time updates and never miss a stream! 💙").setFooter({ text: "Gosu General TV — Notification System" });
        message.channel.send({ embeds: [embed], components: [row] });
    }

    // 4. CREATOR PANEL (!creator) - [Guide Only Mode]
    if (cmd === "!creator") {
        if (!isAdmin(message.member)) return;
        // No button needed as roles are handled by Discord Linked Roles
        
        try { await message.channel.send({ files: [BANNERS.CREATOR] }); } catch (e) {}

        const embed = new EmbedBuilder()
            .setColor("#FFB347")
            .setTitle("👑 Creator Role – Automatic Verification")
            .setDescription([
                "Hello, creators! This panel explains how to obtain the **Creator** role and access exclusive creator-only channels.",
                "",
                "Our Creator role is granted through **Discord's automatic verification system**, based on your connected accounts.",
                "",
                "--------------------------------------------",
                "### 1️⃣ Required Conditions",
                "To receive the Creator role, at least **one** connected account must meet **all** requirements below:",
                "",
                "**Supported Platforms:**",
                "• TikTok / YouTube / Twitch / Facebook",
                "",
                "**Requirements:**",
                "• The account must be **connected** to your Discord profile",
                "• The account must be **verified** (e.g., phone verification)",
                "• Minimum **100 followers/subscribers**",
                "• Must be following **100+ users**",
                "• At least **10 likes or activity records**",
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
                "• After linking and meeting the requirements, Discord automatically verifies your account.",
                "• Please wait a moment; syncing account data may take some time.",
                "• Once approved, the **Creator** role will appear and channels like **#creator-chat** will become available.",
                "",
                "--------------------------------------------",
                "### ⚠️ Troubleshooting",
                "**Didn't receive the role?**",
                "• Ensure your linked account meets *all* requirements",
                "• Refresh Discord with **Ctrl + R** (Windows) or **Cmd + R** (Mac)",
                "",
                "**Need help?**",
                "DM an admin if you're experiencing issues or have questions."
            ].join("\n"))
            .setFooter({ text: "Gosu General TV — Creator Role Guide" });

        message.channel.send({ embeds: [embed] });
    }

    // --- LOG CONFIG ---
    if (cmd.startsWith("!set") && cmd.includes("log")) {
        if (!isAdmin(message.member)) return;
        const ch = message.mentions.channels.first() || message.channel;
        if (cmd === "!setmodlog") BOT_CONFIG.modLogChannelId = ch.id;
        if (cmd === "!setmsglog") BOT_CONFIG.msgLogChannelId = ch.id;
        if (cmd === "!setactionlog") BOT_CONFIG.actionLogChannelId = ch.id;
        if (cmd === "!setfilterlog") BOT_CONFIG.filterLogChannelId = ch.id;
        await saveConfig(); 
        message.reply(`✅ Log set to ${ch}`);
    }
    
    if (cmd.startsWith("!clear") && cmd.includes("log")) {
        if (!isAdmin(message.member)) return;
        if (cmd === "!clearmodlog") BOT_CONFIG.modLogChannelId = null;
        if (cmd === "!clearmsglog") BOT_CONFIG.msgLogChannelId = null;
        if (cmd === "!clearactionlog") BOT_CONFIG.actionLogChannelId = null;
        if (cmd === "!clearfilterlog") BOT_CONFIG.filterLogChannelId = null;
        await saveConfig(); 
        message.reply(`✅ Logs cleared.`);
    }
});

// ---------------------------------------------------------------------
// EVENT LISTENERS (Interactions & Logs)
// ---------------------------------------------------------------------
client.on("guildMemberUpdate", async (oldM, newM) => {
    // Remove temporary verification role if user gets Creator role
    if (!oldM.roles.cache.has(CREATOR_ROLE) && newM.roles.cache.has(CREATOR_ROLE)) {
        if (newM.roles.cache.has(VERIFICATION_ROLE)) {
            await newM.roles.remove(VERIFICATION_ROLE).catch(() => {});
        }
    }
});

client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    const { customId, member } = i;
    try {
        if (customId === "agree_rules") {
            await member.roles.add(GOSU_ROLE);
            i.reply({ content: "✅ Welcome!", ephemeral: true });
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
        // [Removed] apply_creator button logic (Handled by auto-integration)
    } catch (e) {
        console.error("Interaction Error:", e);
        if(!i.replied) i.reply({ content: "Error", ephemeral: true });
    }
});

client.on("messageDelete", m => {
    if(BOT_CONFIG.msgLogChannelId && m.guild) m.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId)?.send(`🗑️ Deleted: ${m.author?.tag} - ${m.content}`).catch(()=>{});
});

client.on("guildMemberAdd", m => {
    if(BOT_CONFIG.actionLogChannelId) m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId)?.send(`✅ ${m.user.tag} Joined`).catch(()=>{});
});

client.on("guildMemberRemove", m => {
    if(BOT_CONFIG.actionLogChannelId) m.guild.channels.cache.get(BOT_CONFIG.actionLogChannelId)?.send(`🚪 ${m.user.tag} Left`).catch(()=>{});
});

client.login(process.env.Bot_Token);
