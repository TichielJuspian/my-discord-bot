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
    REST,
    Routes,
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
// Set Admin role ID to 495718851288236032.
const GOSU_ROLE = process.env.GOSU_ROLE_ID || "PUT_GOSU_ROLE_ID_HERE"; // Main Gosu Role (Base role granted after agreeing to rules)
const MOD_ROLE = "495727371140202506"; // Moderator Role (Management and filter exemption role ID)
const ADMIN_ROLE = "495718851288236032"; // ⬅️ Admin Role ID set
const SUB_ROLE = process.env.SUB_ROLE_ID || "PUT_SUB_ROLE_ID_HERE"; // Live Notification Subscriber Role (Notification role ID)
const MUTE_ROLE = process.env.MUTE_ROLE_ID || "PUT_MUTE_ROLE_ID_HERE"; // ⬅️ NEW: Mute Role ID (MUST BE SET)

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
    MOD_ROLE,
    ADMIN_ROLE, // ⬅️ Added Admin role to exemption list
];

// ----------------------------------------------------
// Helper: Function to save blacklist.json
// ----------------------------------------------------
function saveBlacklist() {
    try {
        // Convert array to JSON string and overwrite the file.
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
        // Convert read data to lowercase and store in the global array.
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`[FILE] Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`[WARN] ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = []; // Start with an empty array if file is missing
            saveBlacklist(); // Create an empty file to prevent errors
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
    // 1. Load Log Channel Config
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
    
    // Initialize log channel ID fields (null if not present)
    if (!BOT_CONFIG.actionLogChannelId) BOT_CONFIG.actionLogChannelId = null;
    if (!BOT_CONFIG.msgLogChannelId) BOT_CONFIG.msgLogChannelId = null;
    if (!BOT_CONFIG.modLogChannelId) BOT_CONFIG.modLogChannelId = null;
    saveConfig(); // Save changes and ensure file creation
    
    // 2. Load Blacklist (calling existing loadBlacklist() function)
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
        GatewayIntentBits.MessageContent, // Required to read message content
        GatewayIntentBits.GuildPresences, // (Optional) Helps the bot cache members better
        GatewayIntentBits.GuildMessageReactions, // ⬅️ Added (for message delete/edit logs)
        GatewayIntentBits.GuildVoiceStates, // ⬅️ Added (for voice channel state change logs)
    ],
    // Added Partials to prevent Intent errors and for member management
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
    loadConfigAndBlacklist(); // ⬅️ Load config and blacklist upon bot start
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
    const isCommand = cmd && cmd.startsWith("!"); // Command if it starts with !
    const member = message.member; // member variable declared here

    
// ---------------------------
// 1. CHAT FILTER LOGIC
// ---------------------------
    // Skip filtering for users using commands or members with filter exempt roles.
    const isExempt = isCommand || FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

    if (!isExempt) {
        let foundLinkFilterMatch = null;
        const normalizedMessage = message.content.toLowerCase();

        // ------------------------------------------------------------------
        // NEW: Enhanced Link and Pattern Filter (Scam/Spam Link Filtering)
        // ------------------------------------------------------------------

        // #1 Discord Invite Filter (Check if it's not a whitelisted invite)
        // Please put your official invite links here. (Custom)
        const allowedInvites = ['discord.gg/gosugeneral', 'discord.gg/xgxD5hB'];
        const containsDiscordInvite = normalizedMessage.match(/(discord\.gg)\/(\w+)/g)?.length > 0;
        const isAllowedInvite = allowedInvites.some(invite => normalizedMessage.includes(invite));

        if (containsDiscordInvite && !isAllowedInvite) {
            foundLinkFilterMatch = "Unpermitted Discord Invite";
        }
        
        // #2 OnlyFans Filter (Specific Adult Content Keyword Filter)
        else if (normalizedMessage.includes("only fans") || normalizedMessage.includes("onlyfans")) {
            foundLinkFilterMatch = "Explicit Content Keyword (OnlyFans)";
        }
        
        // #3 General Link/URL Filter
        // NOTE: This filter is broad and blocks even common links (including http). 
        // To reduce false positives, frequently used safe domains are exempted. (Modify if needed)
        const generalUrlMatch = normalizedMessage.match(/(https?:\/\/)?(www\.)?(\w+)\.(\w+)\/(\w)+/g)?.length > 0;
        if (!foundLinkFilterMatch && (normalizedMessage.includes("http") || generalUrlMatch)) {
            const safeDomains = ['youtube.com', 'youtu.be', 'twitch.tv', 'google.com', 'naver.com']; // <-- Add your safe domains here.
            
            // If a link not included in the safe domains is detected
            if (!safeDomains.some(domain => normalizedMessage.includes(domain))) {
                 foundLinkFilterMatch = "Unpermitted General URL";
            }
        }

        // ------------------------------------------------------------------
        // Enhanced Link Filter Check: Delete Message and Log
        // ------------------------------------------------------------------
        if (foundLinkFilterMatch) {
            // Record MSG LOG
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor("#FF00FF") 
                        .setTitle("🚨 Enhanced Filter Detected (Deleted)")
                        .addFields(
                            { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
                            { name: "Reason", value: foundLinkFilterMatch, inline: true }, // Add filtering reason
                            { name: "Content", value: message.content.substring(0, 1024), inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Message Filtered` });

                    logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("[ERROR] Error sending enhanced filter log:", err));
                }
            }
            
            // Delete message
            if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                if (!message.deleted) {
                    message.delete().catch(err => {
                        console.error(`Failed to delete message: ${message.id}`, err);
                    });
                }
            } else {
                console.error("Bot lacks 'Manage Messages' permission to delete filtered messages.");
            }

            // Send warning message
            const warningMessage = await message.channel.send(`**${member}** Your message was removed due to containing an unpermitted link or pattern: **${foundLinkFilterMatch}**.`);
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
            return; // Stop further processing and exit
        }
        
        // ------------------------------------------------------------------
        // Existing BLACKLISTED_WORDS filter logic (runs if link filter didn't catch)
        // ------------------------------------------------------------------
        // 1. Use normalization (NFC) to combine separated Jamo (initial/medial consonants/vowels) into complete characters.
        // NOTE: normalizedMessage was already used in Link Filter, redefining here to maintain existing logic
        const normalizedContentExisting = message.content.normalize('NFC').toLowerCase(); 

        // 2. (Improved) Remove all special characters. Keep spaces.
        // Remove all characters except [Korean Hangul, a-z, 0-9]. (Spaces are kept as they are not in the regex)
        const simplifiedContent = normalizedContentExisting.replace(/[^가-힣a-z0-9\s]/g, '');

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
            // 3. Remove all special characters, including spaces, from the blacklisted word itself.
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, ''); // Remove spaces from the blacklisted word

            if (simplifiedWord.length < 2) continue; // Do not filter single characters (to prevent false positives)

            // 4. Create a version of the message content with spaces *temporarily* removed and compare it with the blacklisted word (spaces removed).
            // This allows finding 's p a c e d w o r d' (message) with 'spacedword' (blacklist).
            const contentWithoutSpaces = simplifiedContent.replace(/\s/g, ''); 
            
            // 5. Check using the 'space removed version' (use this check less strictly to prevent false positives)
            if (contentWithoutSpaces.includes(simplifiedWord)) {
                foundWord = word;
                break;
            }

            // 6. (Added) Split the message content (spaces kept, special chars removed) based on spaces.
            const contentWords = simplifiedContent.split(/\s+/).filter(w => w.length > 0);

            // 7. Check if the blacklisted word (special chars removed) is contained within each word of the message content (less prone to false positives).
            // Example: If 'idiot' is blacklisted, and message is 'I am not an idiot' -> 'idiot' is contained -> filtered.
            if (contentWords.some(w => w.includes(simplifiedWord))) {
                foundWord = word;
                break;
            }

        }

        if (foundWord) {
            // Record MSG LOG
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
            // Message deletion and warning logic remains the same
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
// 2. COMMAND HANDLING
// ---------------------------

    if (!isCommand) return; // Only process if it's a command

    // --- General Commands (Everyone) ---
    if (cmd === "!ping") {
        const latency = Date.now() - message.createdTimestamp;
        return message.reply(`Pong! 📶 Latency: ${latency}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
    }

    if (cmd === "!invite") {
        // NOTE: Replace with your actual invite link
        const inviteLink = "https://discord.gg/your-server-invite";
        return message.reply(`Join our server! You can invite others using this link: ${inviteLink}`);
    }


    // --- Permissions Check for MOD/ADMIN ---
    // If the command is not general, check if the user is at least a Moderator
    if (!isModerator(member)) {
        // Handle unknown command if not MOD/ADMIN
        return message.reply("❌ You do not have permission to use this command.");
    }

    // --- Moderator & Admin Commands Start Here ---
    
    switch (cmd) {
        // --- Moderator Commands ---

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
                saveBlacklist(); // Save to file

                message.reply(`✅ Successfully added blacklisted word **${wordToAdd}**. Total words: ${BLACKLISTED_WORDS.length}.`);
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
                    saveBlacklist(); // Save to file
                    message.reply(`✅ Successfully removed blacklisted word **${wordToRemove}**. Total words: ${BLACKLISTED_WORDS.length}.`);
                } else {
                    message.reply(`⚠ **${wordToRemove}** is not in the blacklist.`);
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
                    .setDescription(`\`\`\`\n${list.substring(0, 4000)}\n\`\`\``) // Discord embed limit 4096
                    .setFooter({ text: "Words are case-insensitive and can bypass special characters or spacing." });

                message.reply({ embeds: [embed] });
                break;
            }

        case "!kick":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ Usage: `!kick [@usermention] [reason]`");
                }
                
                if (isModerator(targetUser)) {
                    return message.reply("❌ Cannot kick Administrators/Moderators.");
                }
                
                try {
                    await targetUser.kick(reason);
                    message.reply(`✅ Kicked ${targetUser.user.tag}. Reason: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'KICK', message.author, reason);
                } catch (error) {
                    console.error("Kick error:", error);
                    message.reply(`❌ Kick failed: ${error.message}`);
                }
                break;
            }
            
        case "!prune": // The official new name
        case "!purge":
        case "!clear":
            {
                if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return message.reply("❌ I need 'Manage Messages' permission.");
                }
                
                const amount = parseInt(args[1]);

                if (isNaN(amount) || amount <= 0 || amount > 100) {
                    return message.reply("❌ Usage: `!prune [number between 1-100]`");
                }

                try {
                    // +1 to delete the command message itself.
                    const deleted = await message.channel.bulkDelete(amount, true);
                    const reply = await message.channel.send(`✅ Deleted ${deleted.size} messages.`);
                    setTimeout(() => reply.delete().catch(() => {}), 5000); // Auto-delete after 5 seconds
                } catch (error) {
                    console.error("Purge error:", error);
                    message.reply("❌ Failed to delete messages. (Messages older than 14 days cannot be deleted.)");
                }
                break;
            }

        case "!mute":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                     return message.reply("❌ Usage: `!mute [@usermention] [reason]`");
                }
                if (MUTE_ROLE === "PUT_MUTE_ROLE_ID_HERE") {
                    return message.reply("❌ Mute role is not configured in the code constants. Please set MUTE_ROLE_ID.");
                }
                if (isModerator(targetUser)) return message.reply("❌ Cannot mute Administrators/Moderators.");
                
                const muteRole = message.guild.roles.cache.get(MUTE_ROLE);
                if (!muteRole) return message.reply("❌ Mute role not found on server. Please check ID.");

                try {
                    await targetUser.roles.add(muteRole, reason);
                    message.reply(`✅ Muted ${targetUser.user.tag}. Reason: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'MUTE', message.author, reason);
                } catch (error) {
                    console.error("Mute error:", error);
                    message.reply(`❌ Mute failed: ${error.message}`);
                }
                break;
            }
            
        case "!unmute":
            {
                const targetUser = message.mentions.members.first();
                if (!targetUser) {
                     return message.reply("❌ Usage: `!unmute [@usermention]`");
                }
                if (MUTE_ROLE === "PUT_MUTE_ROLE_ID_HERE") {
                    return message.reply("❌ Mute role is not configured in the code constants. Please set MUTE_ROLE_ID.");
                }
                
                const muteRole = message.guild.roles.cache.get(MUTE_ROLE);
                if (!muteRole) return message.reply("❌ Mute role not found on server. Please check ID.");

                try {
                    await targetUser.roles.remove(muteRole);
                    message.reply(`✅ Unmuted ${targetUser.user.tag}.`);
                    sendModLog(message.guild, targetUser.user, 'UNMUTE', message.author, "Unmuted by Moderator");
                } catch (error) {
                    console.error("Unmute error:", error);
                    message.reply(`❌ Unmute failed: ${error.message}`);
                }
                break;
            }

        case "!addrole":
            {
                const targetUser = message.mentions.members.first();
                // Tries to get the role by mention, then by ID from the third argument
                const roleToAdd = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
                
                if (!targetUser || !roleToAdd) {
                    return message.reply("❌ Usage: `!addrole [@usermention] [@rolemention/roleID]`");
                }
                
                try {
                    await targetUser.roles.add(roleToAdd);
                    message.reply(`✅ Added role **${roleToAdd.name}** to ${targetUser.user.tag}.`);
                } catch (error) {
                    console.error("Add role error:", error);
                    message.reply(`❌ Failed to add role: ${error.message}`);
                }
                break;
            }
        
        case "!removerole":
            {
                const targetUser = message.mentions.members.first();
                // Tries to get the role by mention, then by ID from the third argument
                const roleToRemove = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
                
                if (!targetUser || !roleToRemove) {
                    return message.reply("❌ Usage: `!removerole [@usermention] [@rolemention/roleID]`");
                }
                
                try {
                    await targetUser.roles.remove(roleToRemove);
                    message.reply(`✅ Removed role **${roleToRemove.name}** from ${targetUser.user.tag}.`);
                } catch (error) {
                    console.error("Remove role error:", error);
                    message.reply(`❌ Failed to remove role: ${error.message}`);
                }
                break;
            }

        // --- Admin Only Commands ---

        case "!ban":
            if (!isAdmin(member)) { // Extra check for Admin only
                return message.reply("❌ This command can only be used by the Admin role.");
            }
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ Usage: `!ban [@usermention] [reason]`");
                }

                if (isAdmin(targetUser)) {
                    return message.reply("❌ Cannot ban Administrators/Moderators.");
                }

                try {
                    await targetUser.ban({ reason: reason });
                    message.reply(`✅ Banned ${targetUser.user.tag}. Reason: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'BAN', message.author, reason);
                } catch (error) {
                    console.error("Ban error:", error);
                    message.reply(`❌ Ban failed: ${error.message}`);
                }
                break;
            }
            
        case "!reloadblacklist":
            if (!isAdmin(member)) return message.reply("❌ This command can only be used by the Admin role.");
            {
                loadBlacklist();
                message.reply(`✅ Blacklist reloaded successfully! Total words: ${BLACKLISTED_WORDS.length}.`);
                break;
            }
        
        case "!logs":
            if (!isAdmin(member)) return message.reply("❌ This command can only be used by the Admin role.");
            {
                const embed = new EmbedBuilder()
                    .setColor("#00FFFF")
                    .setTitle("📜 Current Log Channel Settings")
                    .addFields(
                        { name: "Action Log (Rules/Notifications)", value: BOT_CONFIG.actionLogChannelId ? `<#${BOT_CONFIG.actionLogChannelId}>` : "Not Set", inline: false },
                        { name: "Message Filter Log (Message Filtering)", value: BOT_CONFIG.msgLogChannelId ? `<#${BOT_CONFIG.msgLogChannelId}>` : "Not Set", inline: false },
                        { name: "Moderation Log (Kick/Ban)", value: BOT_CONFIG.modLogChannelId ? `<#${BOT_CONFIG.modLogChannelId}>` : "Not Set", inline: false }
                    )
                    .setFooter({ text: "Set: !setactionlog [ID] | Clear: !clearactionlog" });
                
                message.reply({ embeds: [embed] });
                break;
            }

        // Refactored !setlogchannel commands
        case "!setactionlog": 
        case "!setmsglog": 
        case "!setmodlog": 
            if (!isAdmin(member)) return message.reply("❌ This command can only be used by the Admin role.");
            {
                const channelId = args[1];
                let type;
                let logName;

                if (cmd === "!setactionlog") {
                    type = 'action';
                    logName = "Action Log Channel";
                } else if (cmd === "!setmsglog") {
                    type = 'msg';
                    logName = "Message Filter Log Channel";
                } else if (cmd === "!setmodlog") {
                    type = 'mod';
                    logName = "Moderation Log Channel";
                }

                if (!channelId) {
                    return message.reply(`❌ Usage: \`${cmd} [ChannelID]\``);
                }

                BOT_CONFIG[`${type}LogChannelId`] = channelId;
                saveConfig();
                message.reply(`✅ **${logName}** set to <#${channelId}>.`);
                break;
            }

        // NEW Admin commands: Clear Logs
        case "!clearactionlog":
        case "!clearmsglog":
        case "!clearmodlog":
            if (!isAdmin(member)) return message.reply("❌ This command can only be used by the Admin role.");
            {
                let logName;
                let type;

                if (cmd === "!clearactionlog") {
                    type = 'action';
                    logName = "Action Log Channel";
                } else if (cmd === "!clearmsglog") {
                    type = 'msg';
                    logName = "Message Filter Log Channel";
                } else if (cmd === "!clearmodlog") {
                    type = 'mod';
                    logName = "Moderation Log Channel";
                }

                BOT_CONFIG[`${type}LogChannelId`] = null;
                saveConfig();
                message.reply(`✅ **${logName}** has been cleared/unconfigured.`);
                break;
            }

        // Refactored !embed commands
        case "!setupjoin": // Rules embed
        case "!welcome":   // Welcome embed
        case "!subscriber":// Notification embed
            if (!isAdmin(member)) { 
                return message.reply("❌ This command can only be used by the Admin role.");
            }

            {
                const channelId = args[1];
                let type; // Used to determine which embed to send
                if (cmd === "!setupjoin") type = 'rules';
                else if (cmd === "!welcome") type = 'welcome';
                else if (cmd === "!subscriber") type = 'notification';

                const targetChannel = message.guild.channels.cache.get(channelId);

                if (!targetChannel) {
                    return message.reply(`❌ Usage: \`${cmd} [ChannelID]\`. Channel not found.`);
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
                        .setFooter({ text: "Let's follow the rules to make GO-SU GANG enjoyable for everyone!" });

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
                        .setDescription("Welcome new member! Please agree to the rules in the #rules channel to gain entry.")
                        .setImage(WELCOME_BANNER_URL)
                        .setFooter({ text: "Have a great time in GO-SU GANG!" });
                    
                    components = []; // Welcome message usually has no button
                } else if (type === 'notification') {
                    embed = new EmbedBuilder()
                        .setColor("#FFD700")
                        .setTitle("🔔 Get Real-Time Notifications")
                        .setDescription(
                            "Click the button below to get the **Live Subscriber** role for live notifications. Click again to remove the role."
                        )
                        .setImage(NOTIFICATION_BANNER_URL)
                        .setFooter({ text: "The notification role can be added/removed anytime." });

                    components = [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("toggle_subscriber_role")
                                .setLabel("Get/Remove Live Notification Role")
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji("🔔")
                        ),
                    ];
                }
                
                await targetChannel.send({ embeds: [embed], components: components });
                message.reply(`✅ Sent **${type}** embed to <#${channelId}> channel.`);
                break;
            }
            
        default:
            // Handle unknown command
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
                console.error("GOSU_ROLE ID is incorrect or role is not in the guild.");
                return interaction.reply({
                    content: "⚠ Server configuration error: Cannot find the base role.",
                    ephemeral: true,
                });
            }

            // Check if member already has the role
            if (member.roles.cache.has(GOSU_ROLE)) {
                return interaction.reply({
                    content: "✅ You already have the entry role as you've agreed to the rules.",
                    ephemeral: true,
                });
            }

            // Grant role
            await member.roles.add(gosuRole);

            interaction.reply({
                content: "🎉 Rules agreed. You have been granted server access!",
                ephemeral: true,
            });
        } else if (interaction.customId === "toggle_subscriber_role") {
            const subRole = interaction.guild.roles.cache.get(SUB_ROLE);

            if (!subRole) {
                console.error("SUB_ROLE ID is incorrect or role is not in the guild.");
                return interaction.reply({
                    content: "⚠ Server configuration error: Cannot find the notification role.",
                    ephemeral: true,
                });
            }

            // Toggle role addition/removal
            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(subRole);
                return interaction.reply({
                    content: "❌ Live notification role removed. You will no longer receive notifications.",
                    ephemeral: true,
                });
            } else {
                await member.roles.add(subRole);
                return interaction.reply({
                    content: "🔔 Live notification role granted. You will now receive notifications.",
                    ephemeral: true,
                });
            }
        }
    } catch (err) {
        console.error("Button interaction error:", err);
        return interaction.reply({
            content: "⚠ An error occurred while processing the button. Please check the bot's permissions.",
            ephemeral: true,
        });
    }
});

// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);
