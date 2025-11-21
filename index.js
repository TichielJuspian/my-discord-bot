// =====================================================
// Gosu Custom Discord Bot (Final Build - All Features Merged)
// Discord.js v14
// =====================================================

require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    PermissionsBitField,
    ButtonStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ChannelType, 
} = require("discord.js");
const fs = require('fs'); // File system module

// ----------------------------------------------------
// FILE PATH CONSTANT
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';
const CONFIG_FILE_PATH = 'config.json'; // ⬅️ Log Channel Configuration File
let BOT_CONFIG = {}; // ⬅️ Variable to store Log Channel IDs

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
// Admin Role ID is fixed to 495718851288236032.
const GOSU_ROLE = process.env.GOSU_ROLE_ID || "PUT_GOSU_ROLE_ID_HERE";       // Main Gosu Role (Default role granted after agreeing to rules)
const MOD_ROLE = process.env.MOD_ROLE_ID || "PUT_MOD_ROLE_ID_HERE";         // Moderator Role (Exempt from filtering)
const ADMIN_ROLE = "495718851288236032";   // ⬅️ Admin Role ID
const SUB_ROLE = process.env.SUB_ROLE_ID || "PUT_SUB_ROLE_ID_HERE";         // Live Notification Subscriber Role

// ----------------------------------------------------
// CUSTOM VOICE CHAT CONFIG (NEW FEATURE)
// ----------------------------------------------------
// 🚨 다중 채널 ID
const CREATE_VOICE_CHANNEL_IDS = [
    "720658789832851487", // 기존 채널 ID
    "1441159364298936340" // 추가 요청된 채널 ID
]; 
const createdChannels = new Set(); // Set to track IDs of bot-created channels

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
    MOD_ROLE,
    ADMIN_ROLE, 
];

// ----------------------------------------------------
// Helper: Function to save blacklist.json
// ----------------------------------------------------
function saveBlacklist() {
    try {
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, 'utf8');
        console.log(`[FILE] Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words to ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        console.error("[ERROR] Error saving blacklist.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load blacklist.json
// ----------------------------------------------------
function loadBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, 'utf8');
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`[FILE] Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`[WARN] ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
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
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(BOT_CONFIG, null, 2), 'utf8');
        console.log(`[FILE] Successfully saved BOT_CONFIG to ${CONFIG_FILE_PATH}.`);
    } catch (err) {
        console.error("[ERROR] Error saving config.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load ALL configs (Log Channels, Blacklist)
// ----------------------------------------------------
function loadConfigAndBlacklist() {
    // 1. Log Channel Config Load
    try {
        const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        BOT_CONFIG = JSON.parse(data);
        console.log(`[FILE] Loaded BOT_CONFIG from ${CONFIG_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`[WARN] ${CONFIG_FILE_PATH} file not found. Creating a new one.`);
        } else {
            console.error("[ERROR] Error loading config.json:", err.message);
        }
    }
    
    // Initialize log channel ID fields
    if (!BOT_CONFIG.actionLogChannelId) BOT_CONFIG.actionLogChannelId = null;
    if (!BOT_CONFIG.msgLogChannelId) BOT_CONFIG.msgLogChannelId = null;
    if (!BOT_CONFIG.modLogChannelId) BOT_CONFIG.modLogChannelId = null;
    saveConfig(); 
    
    // 2. Blacklist Load
    loadBlacklist(); 
}

// ----------------------------------------------------
// Helper: Function to send Moderation Log
// ----------------------------------------------------
async function sendModLog(guild, user, action, moderator, reason, duration) {
    if (!BOT_CONFIG.modLogChannelId) return;

    const logChannel = guild.channels.cache.get(BOT_CONFIG.modLogChannelId);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
        .setColor(action === 'BAN' ? '#B22222' : action === 'KICK' ? '#FF4500' : '#4169E1')
        .setTitle(`🔨 User ${action}`)
        .addFields(
            { name: "Target", value: `${user.tag} (${user.id})`, inline: false },
            { name: "Moderator", value: `${moderator.tag} (${moderator.id})`, inline: true },
            { name: "Reason", value: reason || 'Not specified', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Action: ${action}` });

    if (duration) {
        logEmbed.addFields({ name: "Duration", value: `${duration} minutes`, inline: true });
    }

    logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("[ERROR] Error sending mod log:", err));
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
// CUSTOM VOICE CHANNEL MANAGER (NEW FEATURE)
// =====================================================

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    
    // --- 1. Channel Creation Logic ---
    if (CREATE_VOICE_CHANNEL_IDS.includes(newState.channelId)) {
        // User joined one of the creation channels
        const guild = newState.guild;
        const channelName = `${member.user.username}'s Room`;
        
        try {
            // Find the category of the specific channel the user joined
            const category = guild.channels.cache.get(newState.channelId)?.parent;
            
            if (!category) {
                console.error("[VC] Creation channel's parent category not found or the creation channel is not set up correctly.");
                return; 
            }

            // Create a new voice channel
            const newChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: category.id, // Put it under the same category
                userLimit: 5, // 최대 인원수 5명으로 제한 (0은 제한 없음)
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone role
                        // @everyone에게는 채널 보기만 허용, 접속은 차단 (프라이빗 설정)
                        allow: [PermissionsBitField.Flags.ViewChannel],
                        deny: [PermissionsBitField.Flags.Connect], 
                    },
                    {
                        id: member.id, // Owner of the channel
                        allow: [
                            PermissionsBitField.Flags.ManageChannels, // ⬅️ 채널 관리 권한 유지
                            // PermissionsBitField.Flags.MoveMembers, // 🚨 제거됨: 강제 이동 권한 제거
                            PermissionsBitField.Flags.MuteMembers, // 뮤트 권한
                            PermissionsBitField.Flags.DeafenMembers, // 디프닝 권한
                            PermissionsBitField.Flags.Connect, // 접속 권한
                        ],
                    },
                ],
            });
            
            // Add the new channel ID to our tracking set
            createdChannels.add(newChannel.id);
            console.log(`[VC] Created new channel: ${newChannel.name} (${newChannel.id})`);

            // Move the user to the newly created channel
            await member.voice.setChannel(newChannel);
            
        } catch (error) {
            console.error("[VC ERROR] Failed to create or move user to new voice channel:", error);
            // Move user back to null if moving failed
            if (member.voice.channel) member.voice.setChannel(null).catch(console.error);
        }
    }

    // --- 2. Channel Deletion Logic ---
    // User left a channel, and the channel they left is not one of the creation channels
    if (oldState.channelId && !CREATE_VOICE_CHANNEL_IDS.includes(oldState.channelId)) {
        
        const oldChannel = oldState.channel;
        
        if (oldChannel && createdChannels.has(oldChannel.id)) {
            // The channel the user left is one we created.
            
            // Wait a moment to ensure user count is updated (a small delay)
            setTimeout(async () => {
                // Check if the channel is now empty (user count 0)
                if (oldChannel.members.size === 0) {
                    try {
                        await oldChannel.delete();
                        createdChannels.delete(oldChannel.id); // Remove from tracking set
                        console.log(`[VC] Deleted empty custom channel: ${oldChannel.name} (${oldChannel.id})`);
                    } catch (error) {
                        console.error("[VC ERROR] Failed to delete empty custom channel:", error);
                    }
                }
            }, 500); // 0.5 second delay
        }
    }
});


// =====================================================
// PREFIX COMMANDS & CHAT FILTER
// =====================================================

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

// ---------------------------
// 0. COMMAND PARSING
// ---------------------------
    const args = message.content.trim().split(/ +/g);
    const cmd = args[0]?.toLowerCase();
    const isCommand = cmd && cmd.startsWith("!"); 
    const member = message.member; 

    
// ---------------------------
// 1. CHAT FILTER LOGIC
// ---------------------------
    const isExempt = isCommand || FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

    if (!isExempt) {
        let foundLinkFilterMatch = null;
        const normalizedMessage = message.content.toLowerCase();

        // ------------------------------------------------------------------
        // NEW: Enhanced Link and Pattern Filter (Spam/Scam link filtering)
        // ------------------------------------------------------------------

        // #1 Discord Invite Filter (Custom: Add allowed invites here)
        const allowedInvites = ['discord.gg/gosugeneral', 'discord.gg/xgxD5hB'];
        const containsDiscordInvite = normalizedMessage.match(/(discord\.gg)\/(\w+)/g)?.length > 0;
        const isAllowedInvite = allowedInvites.some(invite => normalizedMessage.includes(invite));

        if (containsDiscordInvite && !isAllowedInvite) {
            foundLinkFilterMatch = "Unpermitted Discord Invite";
        }
        
        // #2 OnlyFans Filter
        else if (normalizedMessage.includes("only fans") || normalizedMessage.includes("onlyfans")) {
            foundLinkFilterMatch = "Explicit Content Keyword (OnlyFans)";
        }
        
        // #3 General Link/URL Filter
        const generalUrlMatch = normalizedMessage.match(/(https?:\/\/)?(www\.)?(\w+)\.(\w+)\/(\w)+/g)?.length > 0;
        if (!foundLinkFilterMatch && (normalizedMessage.includes("http") || generalUrlMatch)) {
            const safeDomains = ['youtube.com', 'youtu.be', 'twitch.tv', 'google.com', 'naver.com']; // <-- Add allowed domains here.
            
            if (!safeDomains.some(domain => normalizedMessage.includes(domain))) {
                 foundLinkFilterMatch = "Unpermitted General URL";
            }
        }

        // ------------------------------------------------------------------
        // Handle Link Filter Match
        // ------------------------------------------------------------------
        if (foundLinkFilterMatch) {
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor("#FF00FF") 
                        .setTitle("🚨 Enhanced Filter Detected (Deleted)")
                        .addFields(
                            { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
                            { name: "Reason", value: foundLinkFilterMatch, inline: true }, 
                            { name: "Content", value: message.content.substring(0, 1024), inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Message Filtered` });

                    logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("[ERROR] Error sending enhanced filter log:", err));
                }
            }
            
            if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                if (!message.deleted) {
                    message.delete().catch(err => {
                        console.error(`Failed to delete message: ${message.id}`, err);
                    });
                }
            } else {
                console.error("Bot lacks 'Manage Messages' permission to delete filtered messages.");
            }

            const warningMessage = await message.channel.send(`**${member}** Your message was removed due to containing an unpermitted link or pattern: **${foundLinkFilterMatch}**.`);
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
            return; 
        }
        
        // ------------------------------------------------------------------
        // Existing BLACKLISTED_WORDS Filter Logic
        // ------------------------------------------------------------------
        const normalizedContentExisting = message.content.normalize('NFC').toLowerCase(); 
        const simplifiedContent = normalizedContentExisting.replace(/[^가-힣a-z0-9\s]/g, '');

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, ''); 

            if (simplifiedWord.length < 2) continue; 

            const contentWithoutSpaces = simplifiedContent.replace(/\s/g, ''); 
            
            if (contentWithoutSpaces.includes(simplifiedWord)) {
                foundWord = word;
                break;
            }

            const contentWords = simplifiedContent.split(/\s+/).filter(w => w.length > 0);

            if (contentWords.some(w => w.includes(simplifiedWord))) {
                foundWord = word;
                break;
            }

        }

        if (foundWord) {
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor("#FF00FF") 
                        .setTitle("🚨 Forbidden Word Detected (Deleted)")
                        .addFields(
                            { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
                            { name: "Content", value: message.content.substring(0, 1024), inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Message Filtered` });

                    logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("[ERROR] Error sending filter log:", err));
                }
            }

            if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                if (!message.deleted) {
                    message.delete().catch(err => {
                        console.error(`Failed to delete message: ${message.id}`, err);
                    });
                }
            } else {
                console.error("Bot lacks 'Manage Messages' permission to delete filtered messages.");
            }

            const warningMessage = await message.channel.send(`**${member}** Watch your language! Your message contained a blacklisted word and has been removed.`);
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
            return;
        }
    }

// ---------------------------
// 2. MODERATION COMMANDS (Moderator Commands)
// ---------------------------

    if (!isCommand || !isModerator(member)) return; 

    switch (cmd) {
        case "!addword":
            {
                const wordToAdd = args.slice(1).join(" ").toLowerCase();
                if (!wordToAdd) {
                    return message.reply("❌ Usage: `!addword [word/phrase to add]`");
                }

                if (BLACKLISTED_WORDS.includes(wordToAdd)) {
                    return message.reply(`⚠ **${wordToAdd}** is already in the blacklist.`);
                }

                BLACKLISTED_WORDS.push(wordToAdd);
                saveBlacklist(); 

                message.reply(`✅ Successfully added **${wordToAdd}** to the blacklist. Total words: ${BLACKLISTED_WORDS.length}.`);
                break;
            }

        case "!removeword":
            {
                const wordToRemove = args.slice(1).join(" ").toLowerCase();
                if (!wordToRemove) {
                    return message.reply("❌ Usage: `!removeword [word/phrase to remove]`");
                }

                const initialLength = BLACKLISTED_WORDS.length;
                BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(w => w !== wordToRemove);

                if (BLACKLISTED_WORDS.length < initialLength) {
                    saveBlacklist(); 
                    message.reply(`✅ Successfully removed **${wordToRemove}**. Total words: ${BLACKLISTED_WORDS.length}.`);
                } else {
                    message.reply(`⚠ **${wordToRemove}** was not found in the blacklist.`);
                }
                break;
            }

        case "!listwords":
            {
                if (BLACKLISTED_WORDS.length === 0) {
                    return message.reply("✅ The blacklist is currently empty.");
                }

                const list = BLACKLISTED_WORDS.map((w, i) => `${i + 1}. ${w}`).join('\n');
                const embed = new EmbedBuilder()
                    .setColor("#87CEEB")
                    .setTitle(`🚫 Current Blacklisted Words (${BLACKLISTED_WORDS.length})`)
                    .setDescription(`\`\`\`\n${list.substring(0, 4000)}\n\`\`\``) 
                    .setFooter({ text: "Filtering is case-insensitive and bypasses most special characters/spaces." });

                message.reply({ embeds: [embed] });
                break;
            }

        case "!setlogchannel":
            {
                const channelId = args[1];
                const type = args[2]?.toLowerCase();
                
                if (!channelId || !type) {
                    return message.reply("❌ Usage: `!setlogchannel [ChannelID] [action/msg/mod]`");
                }
                
                if (type === 'action') {
                    BOT_CONFIG.actionLogChannelId = channelId;
                    message.reply(`✅ **Action Log Channel** set to <#${channelId}>.`);
                } else if (type === 'msg') {
                    BOT_CONFIG.msgLogChannelId = channelId;
                    message.reply(`✅ **Message Filter Log Channel** set to <#${channelId}>.`);
                } else if (type === 'mod') {
                    BOT_CONFIG.modLogChannelId = channelId;
                    message.reply(`✅ **Moderation Log Channel** set to <#${channelId}>.`);
                } else {
                    return message.reply("❌ Invalid log type. Use one of [action/msg/mod].");
                }
                
                saveConfig();
                break;
            }

        case "!logs":
            {
                const embed = new EmbedBuilder()
                    .setColor("#00FFFF")
                    .setTitle("📜 Current Log Channel Settings")
                    .addFields(
                        { name: "Action Log (Rules/Notifications)", value: BOT_CONFIG.actionLogChannelId ? `<#${BOT_CONFIG.actionLogChannelId}>` : "Not Set", inline: false },
                        { name: "Message Filter Log (Chat Filtering)", value: BOT_CONFIG.msgLogChannelId ? `<#${BOT_CONFIG.msgLogChannelId}>` : "Not Set", inline: false },
                        { name: "Moderation Log (Kick/Ban)", value: BOT_CONFIG.modLogChannelId ? `<#${BOT_CONFIG.modLogChannelId}>` : "Not Set", inline: false }
                    )
                    .setFooter({ text: "Set with: !setlogchannel [ID] [action/msg/mod]" });
                
                message.reply({ embeds: [embed] });
                break;
            }

        case "!kick":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ Usage: `!kick [@user mention] [reason]`");
                }
                
                if (isModerator(targetUser)) {
                    return message.reply("❌ Cannot kick a Moderator or Admin.");
                }
                
                try {
                    await targetUser.kick(reason);
                    message.reply(`✅ Kicked ${targetUser.user.tag}. Reason: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'KICK', message.author, reason);
                } catch (error) {
                    console.error("Kick error:", error);
                    message.reply(`❌ Failed to kick: ${error.message}`);
                }
                break;
            }
            
        case "!ban":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ Usage: `!ban [@user mention] [reason]`");
                }

                if (isModerator(targetUser)) {
                    return message.reply("❌ Cannot ban a Moderator or Admin.");
                }

                try {
                    await targetUser.ban({ reason: reason });
                    message.reply(`✅ Banned ${targetUser.user.tag}. Reason: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'BAN', message.author, reason);
                } catch (error) {
                    console.error("Ban error:", error);
                    message.reply(`❌ Failed to ban: ${error.message}`);
                }
                break;
            }
            
        case "!purge":
        case "!clear":
            {
                if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return message.reply("❌ I require the 'Manage Messages' permission to clear messages.");
                }
                
                const amount = parseInt(args[1]);

                if (isNaN(amount) || amount <= 0 || amount > 100) {
                    return message.reply("❌ Usage: `!clear [number between 1-100]`");
                }

                try {
                    // +1 to also delete the command message itself.
                    const deleted = await message.channel.bulkDelete(amount + 1, true); // Deletes command + specified amount
                    const reply = await message.channel.send(`✅ Deleted ${deleted.size -1} messages.`);
                    setTimeout(() => reply.delete().catch(() => {}), 5000); // Auto-delete reply after 5s
                } catch (error) {
                    console.error("Purge error:", error);
                    message.reply("❌ Failed to delete messages. (Cannot delete messages older than 14 days.)");
                }
                break;
            }
            
        case "!embed":
            {
                if (!isAdmin(member)) { 
                    return message.reply("❌ This command is restricted to the Admin role.");
                }

                const channelId = args[1];
                const type = args[2]?.toLowerCase();
                const targetChannel = message.guild.channels.cache.get(channelId);

                if (!targetChannel || !type) {
                    return message.reply("❌ Usage: `!embed [ChannelID] [rules/welcome/notification]`");
                }

                let embed;
                let components = [];

                if (type === 'rules') {
                    embed = new EmbedBuilder()
                        .setColor("#0000FF")
                        .setTitle("✅ 📜 RULES & REGULATION 📜")
                        .setDescription(
                            "You must read the **GO-SU GANG** community rules and click the button below to gain access to the channels."
                        )
                        .setImage(RULES_BANNER_URL)
                        .setFooter({ text: "Let's all enjoy GO-SU GANG by following the rules!" });

                    components = [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("agree_rules")
                                .setLabel("✅ I agree to the rules.")
                                .setStyle(ButtonStyle.Success)
                                .setEmoji("✅")
                        ),
                    ];
                } else if (type === 'welcome') {
                    embed = new EmbedBuilder()
                        .setColor("#00FF00")
                        .setTitle("🎉 Welcome to GO-SU GANG!")
                        .setDescription("Welcome to the new member! Please agree to the rules in the #rules channel to gain entry.")
                        .setImage(WELCOME_BANNER_URL)
                        .setFooter({ text: "Have a great time at GO-SU GANG!" });
                    
                    components = []; 
                } else if (type === 'notification') {
                    embed = new EmbedBuilder()
                        .setColor("#FFD700")
                        .setTitle("🔔 Get Real-time Notifications")
                        .setDescription(
                            "To receive live notifications from Gosu, click the button below to get the **Live Subscriber** role. Click again to remove the role."
                        )
                        .setImage(NOTIFICATION_BANNER_URL)
                        .setFooter({ text: "You can add or remove the notification role at any time." });

                    components = [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("toggle_subscriber_role")
                                .setLabel("Get/Remove Live Notification Role")
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji("🔔")
                        ),
                    ];
                } else {
                    return message.reply("❌ Invalid embed type. Use one of [rules/welcome/notification].");
                }

                await targetChannel.send({ embeds: [embed], components: components });
                message.reply(`✅ **${type}** embed successfully sent to <#${channelId}>.`);
                break;
            }
            
        default:
            message.reply("❓ Unknown command. Please check moderator commands.");
            break;
    }
});

// =====================================================
// BUTTON INTERACTION HANDLING
// =====================================================

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    const member = interaction.member;

    try {
        if (interaction.customId === "agree_rules") {
            const gosuRole = interaction.guild.roles.cache.get(GOSU_ROLE);

            if (!gosuRole) {
                console.error("GOSU_ROLE ID is incorrect or role is missing.");
                return interaction.reply({
                    content: "⚠ Server configuration error: Default role not found.",
                    ephemeral: true,
                });
            }

            if (member.roles.cache.has(GOSU_ROLE)) {
                return interaction.reply({
                    content: "✅ You have already agreed to the rules and have the entry role.",
                    ephemeral: true,
                });
            }

            await member.roles.add(gosuRole);

            interaction.reply({
                content: "🎉 Rules agreed! You have been granted access to the server.",
                ephemeral: true,
            });
        } else if (interaction.customId === "toggle_subscriber_role") {
            const subRole = interaction.guild.roles.cache.get(SUB_ROLE);

            if (!subRole) {
                console.error("SUB_ROLE ID is incorrect or role is missing.");
                return interaction.reply({
                    content: "⚠ Server configuration error: Notification role not found.",
                    ephemeral: true,
                });
            }

            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(subRole);
                return interaction.reply({
                    content: "❌ Live notification role removed. You will no longer receive notifications.",
                    ephemeral: true,
                });
            } else {
                await member.roles.add(subRole);
                return interaction.reply({
                    content: "🔔 Live notification role assigned. You will now receive notifications.",
                    ephemeral: true,
                });
            }
        }
    } catch (err) {
        console.error("Button interaction error:", err);
        return interaction.reply({
            content: "⚠ An error occurred while processing the button. Please check bot permissions.",
            ephemeral: true,
        });
    }
});

// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);
