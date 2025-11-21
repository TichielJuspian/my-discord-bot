// =====================================================
// Gosu Custom Discord Bot (Final Build - All Features Merged)
// Discord.js v14
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
} = require("discord.js");

// -----------------------------
// FILE PATH CONSTANTS
// -----------------------------
const DATA_DIR = "./Data";
const BLACKLIST_FILE_PATH = path.join(DATA_DIR, "blacklist.json");
const CONFIG_FILE_PATH   = path.join(DATA_DIR, "config.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[INIT] Created directory ${DATA_DIR}`);
}

let BOT_CONFIG = {};       
let BLACKLISTED_WORDS = [];  

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
// Main Gosu role (granted after agreeing to rules)
const GOSU_ROLE = "496717793388134410";
// Moderator role (filter exemption, moderation commands)
const MOD_ROLE = "495727371140202506";
// Admin role
const ADMIN_ROLE = "495718851288236032";
// Live Notification Subscriber role
const SUB_ROLE = "497654614729031681";

// ----------------------------------------------------
// VOICE CHANNEL CREATOR CONFIG
// ----------------------------------------------------
// Voice channels that trigger auto personal VO channel
const CREATE_CHANNEL_IDS = [
    "720658789832851487",
    "1441159364298936340",
];

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
const FILTER_EXEMPT_ROLES = [
    MOD_ROLE,
    ADMIN_ROLE, // Admins are also exempt from filters
];

// ----------------------------------------------------
// Helper: Function to save blacklist.json
// ----------------------------------------------------
function saveBlacklist() {
    try {
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, "utf8");
        console.log(
            `[FILE] Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words to ${BLACKLIST_FILE_PATH}.`
        );
    } catch (err) {
        console.error("[ERROR] Error saving blacklist.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load blacklist.json
// ----------------------------------------------------
function loadBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, "utf8");
        BLACKLISTED_WORDS = JSON.parse(data).map((word) =>
            String(word).toLowerCase()
        );
        console.log(
            `[FILE] Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`
        );
    } catch (err) {
        if (err.code === "ENOENT") {
            console.error(
                `[WARN] ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`
            );
            BLACKLISTED_WORDS = [];
            saveBlacklist();
        } else {
            console.error("[ERROR] Error loading blacklist.json:", err.message);
            BLACKLISTED_WORDS = [];
        }
    }
}

// ----------------------------------------------------
// Helper: Function to save config.json (Log Channel Settings)
// ----------------------------------------------------
function saveConfig() {
    try {
        fs.writeFileSync(
            CONFIG_FILE_PATH,
            JSON.stringify(BOT_CONFIG, null, 2),
            "utf8"
        );
        console.log(
            `[FILE] Successfully saved BOT_CONFIG to ${CONFIG_FILE_PATH}.`
        );
    } catch (err) {
        console.error("[ERROR] Error saving config.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load ALL configs (Log Channels, Blacklist)
// ----------------------------------------------------
function loadConfigAndBlacklist() {
    // 1. Load Log Channel Config
    try {
        const data = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
        BOT_CONFIG = JSON.parse(data);
        console.log(`[FILE] Loaded BOT_CONFIG from ${CONFIG_FILE_PATH}.`);
    } catch (err) {
        if (err.code === "ENOENT") {
            console.error(
                `[WARN] ${CONFIG_FILE_PATH} file not found. Creating a new one.`
            );
        } else {
            console.error("[ERROR] Error loading config.json:", err.message);
        }
    }

    // Initialize log channel ID fields (set to null if missing)
    if (!BOT_CONFIG.actionLogChannelId) BOT_CONFIG.actionLogChannelId = null;
    if (!BOT_CONFIG.msgLogChannelId) BOT_CONFIG.msgLogChannelId = null;
    if (!BOT_CONFIG.modLogChannelId) BOT_CONFIG.modLogChannelId = null;
    saveConfig();

    // 2. Load blacklist
    loadBlacklist();
}

// ----------------------------------------------------
// Helper: Function to send Moderation Log
// ----------------------------------------------------
async function sendModLog(
    guild,
    user,
    action,
    moderator,
    reason,
    duration
) {
    if (!BOT_CONFIG.modLogChannelId) return;

    const logChannel = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
        .setColor(
            action === "BAN"
                ? "#B22222"
                : action === "KICK"
                ? "#FF4500"
                : "#4169E1"
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
// WELCOME / RULES / NOTIFICATION BANNERS (Image URLs)
// ----------------------------------------------------
const RULES_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
const WELCOME_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
const NOTIFICATION_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c985f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";

// --------------------
// Client Initialization
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

// --------------------
// Helper: Role Checking
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
// Bot Ready Event
// --------------------
client.once("ready", () => {
    console.log(`[BOT] Bot logged in as ${client.user.tag}`);
    loadConfigAndBlacklist();
});

// =====================================================
// VOICE CHANNEL CREATOR
// =====================================================
client.on("voiceStateUpdate", async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    // 1. Join – create personal VO channel
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
                        id: guild.id, // @everyone
                        allow: [PermissionsBitField.Flags.Connect],
                        deny: [PermissionsBitField.Flags.ManageChannels],
                    },
                    {
                        id: member.id, // creator
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

    // 2. Delete – when temporary VO is empty
    if (
        oldState.channelId &&
        !CREATE_CHANNEL_IDS.includes(oldState.channelId)
    ) {
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
// PREFIX COMMANDS & CHAT FILTER
// =====================================================
client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    // 0. COMMAND PARSING
    const args = message.content.trim().split(/ +/g);
    const cmd = args[0]?.toLowerCase();
    const isCommand = cmd && cmd.startsWith("!");
    const member = message.member;

    // 1. CHAT FILTER LOGIC
    const isExempt =
        isCommand ||
        FILTER_EXEMPT_ROLES.some((roleId) => member.roles.cache.has(roleId));

    if (!isExempt) {
        let foundLinkFilterMatch = null;
        const normalizedMessage = message.content.toLowerCase();

        // #1 Discord invite filter
        const allowedInvites = ["discord.gg/gosugeneral", "discord.gg/xgxD5hB"];
        const inviteMatches = normalizedMessage.match(
            /(discord\.gg)\/(\w+)/g
        );
        const containsDiscordInvite = inviteMatches?.length > 0;
        const isAllowedInvite = allowedInvites.some((invite) =>
            normalizedMessage.includes(invite)
        );

        if (containsDiscordInvite && !isAllowedInvite) {
            foundLinkFilterMatch = "Unpermitted Discord Invite";
        }
        // #2 OnlyFans filter
        else if (
            normalizedMessage.includes("only fans") ||
            normalizedMessage.includes("onlyfans")
        ) {
            foundLinkFilterMatch = "Explicit Content Keyword (OnlyFans)";
        }
        // #3 General URL filter
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

            if (
                !safeDomains.some((domain) =>
                    normalizedMessage.includes(domain)
                )
            ) {
                foundLinkFilterMatch = "Unpermitted General URL";
            }
        }

        if (foundLinkFilterMatch) {
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel =
                    message.guild.channels.cache.get(
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
                        console.error(
                            `Failed to delete message: ${message.id}`,
                            err
                        );
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

        // BLACKLISTED_WORDS filter
        const normalizedContentExisting = message.content
            .normalize("NFC")
            .toLowerCase();
        const simplifiedContent = normalizedContentExisting.replace(
            /[^가-힣a-z0-9\s]/g,
            ""
        );

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
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
        }

        if (foundWord) {
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel =
                    message.guild.channels.cache.get(
                        BOT_CONFIG.msgLogChannelId
                    );
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
                                "[ERROR] Error sending filter log:",
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
                        console.error(
                            `Failed to delete message: ${message.id}`,
                            err
                        );
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

    // 2. COMMAND LOGIC
    if (!isCommand) return;

    // Delete original command message after 1 second
    setTimeout(() => {
        if (!message.deleted) {
            message.delete().catch(() => {});
        }
    }, 1000);

    // Permission checks
    const adminOnly = [
        "!clearmsglog",
        "!setmodlog",
        "!clearmodlog",
        "!ban",
        "!reloadblacklist",
        "!clearactionlog",
        "!setmsglog",
        "!setactionlog",
        "!setupjoin",
        "!welcome",
        "!subscriber",
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

    // LOG SETTING & CLEARING COMMANDS (Admin Only)
    const logCommands = {
        "!setactionlog": { key: "actionLogChannelId", type: "ACTION" },
        "!clearactionlog": { key: "actionLogChannelId", type: "ACTION" },
        "!setmsglog": { key: "msgLogChannelId", type: "MESSAGE" },
        "!clearmsglog": { key: "msgLogChannelId", type: "MESSAGE" },
        "!setmodlog": { key: "modLogChannelId", type: "MODERATION" },
        "!clearmodlog": { key: "modLogChannelId", type: "MODERATION" },
    };

    if (logCommands[cmd]) {
        const { key, type } = logCommands[cmd];

        if (cmd.startsWith("!set")) {
            let channel =
                args.length === 1
                    ? message.channel
                    : message.mentions.channels.first() ||
                      message.guild.channels.cache.get(args[1]);

            if (!channel || channel.type !== 0) {
                const reply = await message.reply(
                    `Usage: \`${cmd}\` (in log channel) or \`${cmd} #channel\``
                );
                setTimeout(() => reply.delete().catch(() => {}), 3000);
                return;
            }

            BOT_CONFIG[key] = channel.id;
            saveConfig();
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
            saveConfig();
            const reply = await message.reply(
                `✅ **${type} Log** setting cleared.`
            );
            setTimeout(() => reply.delete().catch(() => {}), 3000);
        }
        return;
    }

    // !ping
    if (cmd === "!ping") {
        return message.reply("Pong!");
    }

    // BLACKLIST MANAGEMENT COMMANDS
   // ========== !addword ==========
if (cmd === "!addword") {
    const newWord = args.slice(1).join(" ").toLowerCase().trim();
    if (!newWord) {
        return message.reply("Usage: `!addword [word]`");
    }

    if (BLACKLISTED_WORDS.includes(newWord)) {
        return message.reply(`⚠ **${newWord}** is already in the blacklist.`);
    }

    BLACKLISTED_WORDS.push(newWord);
    saveBlacklist(); // Save to file

    return message.reply(
        `✅ Added **${newWord}** to the blacklist. (${BLACKLISTED_WORDS.length} total)`
    );
}
// ========== !removeword ==========
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
        return message.reply(`⚠ **${wordToRemove}** was not found in the blacklist.`);
    }

    saveBlacklist(); // Save to file

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
        loadBlacklist();
        const reply = await message.reply(
            `✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`
        );
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // PANEL SETUP COMMANDS (Admin Only)
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

    // !subscriber — Create the Live Notification Panel
    // !subscriber — Create the Live Notification Panel
    if (cmd === "!subscriber") {
        const member = message.member;
        if (!isAdmin(member)) {
            return message.reply(
                "❌ You do not have permission to use this command."
            );
        }

        // 1) 배너 이미지 (위에 크게)
        await message.channel.send({
            files: [{ attachment: NOTIFICATION_BANNER_URL, name: "notification.png" }],
        });

        // 2) welcome 스타일 설명 embed
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

        // 3) 버튼
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("subscribe_toggle")
                .setLabel("Subscribe / Unsubscribe")
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ embeds: [subscriberEmbed], components: [row] });
        return; // 깔끔하게 끝 (추가 텍스트 reply 없음)
    }

    // MODERATION COMMANDS
    if (cmd === "!ban") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply(
                "Usage: `!ban @user [reason]`"
            );
            return;
        }

        const reason = args.slice(2).join(" ") || "No reason provided";
        try {
            await user.ban({ reason });
            sendModLog(message.guild, user.user, "BAN", message.author, reason);
            await message.reply(
                `🔨 Banned **${user.user.tag}**. Reason: ${reason}`
            );
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
            const reply = await message.reply(
                "Usage: `!kick @user [reason]`"
            );
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
            const reply = await message.reply(
                "Usage: `!mute @user [minutes] [reason]`"
            );
            return;
        }

        try {
            const reason =
                args.slice(3).join(" ") ||
                `Muted by ${message.author.tag}`;
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
            const reply = await message.reply("Usage: `!unmute @user`");
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
            const reply = await message.reply(
                "Usage: `!addrole @user RoleName`"
            );
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            const reply = await message.reply(
                "Usage: `!addrole @user RoleName`"
            );
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            const reply = await message.reply("⚠ Could not find that role.");
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
            const reply = await message.reply(
                "Usage: `!removerole @user RoleName`"
            );
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            const reply = await message.reply(
                "Usage: `!removerole @user RoleName`"
            );
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            const reply = await message.reply("⚠ Could not find that role.");
            return;
        }

        if (!target.roles.cache.has(role.id)) {
            const reply = await message.reply(
                "⚠ That user does not have that role."
            );
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

    // INVITE + HELP
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
                    "",
                    "**Moderator Commands**",
                    "`!kick @user [reason]` — Kick a user.",
                    "`!mute @user [minutes] [reason]` — Timeout a user.",
                    "`!unmute @user` — Remove timeout.",
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
                    "`!ban @user [reason]` — Ban a user.",
                    "`!reloadblacklist` — Reload filter words from JSON file.",
                    "`!setupjoin` — Create the rules panel.",
                    "`!welcome` — Create the main welcome panel.",
                    "`!subscriber` — Create the live notification panel.",
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
            console.error(
                "[ERROR] Error sending guildMemberUpdate log:",
                err
            )
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
                value: `<t:${Math.floor(
                    member.joinedTimestamp / 1000
                )}:f>`,
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

    // Rules agreement
    if (interaction.customId === "agree_rules") {
        const member = interaction.member;

        try {
            if (!member.roles.cache.has(GOSU_ROLE)) {
                await member.roles.add(GOSU_ROLE);
            }
            await interaction.reply({
                content:
                    "✅ Rules accepted! You now have access to the server.",
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

    // Subscriber toggle
    if (interaction.customId === "subscribe_toggle") {
        const member = interaction.member;
        const hasSubRole = member.roles.cache.has(SUB_ROLE);

        try {
            if (hasSubRole) {
                await member.roles.remove(SUB_ROLE);
                await interaction.reply({
                    content:
                        "🔕 **You have unsubscribed from Live Notifications.**",
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



