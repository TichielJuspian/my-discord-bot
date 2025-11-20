const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
// ❗ 환경 변수 로드 (BOT_TOKEN, ROLE IDs 등)
require('dotenv').config(); 

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
// .env 파일에 다음 ID들을 설정해야 합니다. (예: ADMIN_ROLE_ID="123456789012345678")
const MEMBER_ROLE = process.env.MEMBER_ROLE_ID;         // 멤버에게 부여할 기본 역할 ID (규칙 동의 역할)
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID;           // 관리자 역할 ID
const MOD_ROLE = process.env.MOD_ROLE_ID;               // Moderation 명령어 사용 가능 역할 ID
const SUB_ROLE = process.env.SUB_ROLE_ID;               // 알림 구독 역할 ID

// ----------------------------------------------------
// FILE PATH CONSTANTS
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';
const LOG_CONFIG_FILE_PATH = 'log_config.json'; // 3단계 로그 설정을 저장하는 파일

// ---------------------------
// CHAT FILTER CONFIG
// ---------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

// 🔥 관리자/모더레이터만 필터 우회
const FILTER_EXEMPT_ROLES = [
    ADMIN_ROLE,
    MOD_ROLE,
];

// ----------------------------------------------------
// GLOBAL LOG CONFIG (3단계 세분화된 로그 시스템)
// ----------------------------------------------------
let LOG_CHANNELS = {
    action: null, // User actions (join, leave, voice, role changes, message delete)
    mod: null,    // Moderation actions (ban, kick, mute, external ban)
    filter: null  // Filter hits (blacklisted words)
};

// =====================================================
// HELPER FUNCTIONS (파일 관리 및 로깅)
// =====================================================

// -------- BLACKLIST JSON 파일 저장 --------
function saveBlacklist() {
    try {
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words.`);
    } catch (err) {
        console.error("Error saving blacklist.json:", err.message);
    }
}

// -------- BLACKLIST JSON 파일 로드 --------
function loadBlacklist() {
    try {
        // 읽어온 데이터를 소문자로 변환하여 저장
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, 'utf8');
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`Loaded ${BLACKLISTED_WORDS.length} blacklisted words.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = [];
            saveBlacklist(); 
        } else {
            console.error("Error loading blacklist.json:", err.message);
        }
    }
}

// -------- LOG JSON 파일 저장 --------
function saveLogConfig() {
    try {
        const jsonString = JSON.stringify(LOG_CHANNELS, null, 2);
        fs.writeFileSync(LOG_CONFIG_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved log config to ${LOG_CONFIG_FILE_PATH}.`);
    } catch (err) {
        console.error("Error saving log_config.json:", err.message);
    }
}

// -------- LOG JSON 파일 로드 --------
function loadLogConfig() {
    try {
        const data = fs.readFileSync(LOG_CONFIG_FILE_PATH, 'utf8');
        const loadedConfig = JSON.parse(data);
        LOG_CHANNELS = { ...LOG_CHANNELS, ...loadedConfig };
        console.log(`Loaded log config from ${LOG_CONFIG_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${LOG_CONFIG_FILE_PATH} file not found. Creating a new one.`);
            saveLogConfig(); 
        } else {
            console.error("Error loading log_config.json:", err.message);
        }
    }
}

// -------- Log Embed 전송 (3가지 타입) --------
function sendLog(guild, logType, embed) {
    const channelId = LOG_CHANNELS[logType];
    if (!channelId) return;

    const logChannel = guild.channels.cache.get(channelId);
    if (logChannel && logChannel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
        logChannel.send({ embeds: [embed] }).catch(err => {
            console.error(`Failed to send ${logType} log:`, err.message);
        });
    }
}

// -------- 권한 확인 --------
function hasAdminPermission(member) {
    if (!member || !ADMIN_ROLE) return false;
    return member.roles.cache.has(ADMIN_ROLE) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function hasModPermission(member) {
    if (!member || !ADMIN_ROLE || !MOD_ROLE) return false;
    return member.roles.cache.has(ADMIN_ROLE) || member.roles.cache.has(MOD_ROLE) || member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}


// =====================================================
// CLIENT INITIALIZATION & READY EVENT
// =====================================================

// -------- Client 초기화 (올바른 Intents 설정) --------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // ❗ 명령어 읽기에 필수
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.GuildBans, 
        GatewayIntentBits.MessageReactions,
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER'],
});

// -------- Bot Ready Event (파일 로드) --------
client.once("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    loadBlacklist();
    loadLogConfig(); 
});


// =====================================================
// COMMANDS (MESSAGE CREATE)
// =====================================================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    const member = message.member;
    const isCommand = cmd && cmd.startsWith("!");

    // ---------------------------
    // Permission Checks & Filter Exemption
    // ---------------------------
    const isAdmin = hasAdminPermission(member);
    const isMod = hasModPermission(member);
    
    // 필터 면제: 관리자/모더레이터 역할이 있거나, 명령어(Command)인 경우
    const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId)) || isCommand;

    // ---------------------------
    // 1. CHAT FILTER LOGIC (안정적인 단어 단위 필터링)
    // ---------------------------
    if (!isExempt) {
        const normalizedContent = message.content.normalize('NFC').toLowerCase();
        const contentWords = normalizedContent.split(/\s+/).filter(w => w.length > 0);

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, '');

            if (!simplifiedWord) continue;

            for (const contentWord of contentWords) {
                const simplifiedContentWord = contentWord.replace(/[^가-힣a-z0-9]/g, '');

                if (simplifiedContentWord.includes(simplifiedWord)) {
                    foundWord = word;
                    break; 
                }
            }
            if (foundWord) break;
        }


        if (foundWord) {
            // ⭐ FILTER LOG 전송
            const filterLogEmbed = new EmbedBuilder()
                .setColor("#8B0000") 
                .setTitle("🚨 FILTER HIT DETECTED")
                .setDescription(`User **@${message.author.tag}** used a blacklisted word.`)
                .addFields(
                    { name: "Channel", value: `${message.channel}`, inline: true },
                    { name: "Word Used", value: `\`${foundWord}\``, inline: true },
                    { name: "Original Message", value: `\`\`\`${message.content.substring(0, 1000)}\`\`\`` }
                )
                .setTimestamp();
            sendLog(message.guild, 'filter', filterLogEmbed);
            
            // 메시지 삭제
            if (!message.deleted) {
                message.delete().catch(() => {
                    console.error(`Failed to delete message: ${message.id}`);
                });
            }

            // 🌟 필터 경고 메시지 (7초 후 삭제)
            const warningEmbed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("🚫 Watch Your Language!")
                .setDescription(`**${member}**, your message contained a blacklisted word and has been removed.`);

            const warningMessage = await message.channel.send({ embeds: [warningEmbed] });
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);

            return;
        }
    }
    
    // ---------------------------
    // 2. COMMAND LOGIC
    // ---------------------------
    if (!isCommand) return; 

    // ---- 명령어 권한 체크 ----
    const adminOnly = ["!setupjoin", "!color", "!welcome", "!subscriber", "!addactionlog", "!removeactionlog", "!addmodlog", "!removemodlog", "!addfilterlog", "!removefilterlog", "!addlog", "!deletelog"];
    if (adminOnly.includes(cmd) && !isAdmin) {
        const reply = await message.reply("⛔ Permission Denied. This command is restricted to **Admin**.");
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    const modOnly = ["!ban", "!kick", "!mute", "!unmute", "!prune", "!addword", "!removeword", "!listwords", "!reloadblacklist", "!addrole", "!removerole"];
    if (modOnly.includes(cmd) && !isMod) {
        const reply = await message.reply("⛔ Permission Denied. This command is restricted to **Moderators**.");
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }
    
    // 명령어 메시지 자체 삭제
    const commandsToDeleteOriginal = [
        "!ping", "!invite", "!help", "/?", "!prune", 
        "!addword", "!removeword", "!reloadblacklist", 
        "!setupjoin", "!color", "!welcome", "!subscriber",
        "!addlog", "!deletelog", "!addactionlog", "!removeactionlog", "!addmodlog", "!removemodlog", "!addfilterlog", "!removefilterlog"
    ];

    if (commandsToDeleteOriginal.includes(cmd)) {
        setTimeout(() => {
            if (!message.deleted) {
                message.delete().catch(() => {});
            }
        }, 1000); 
    }

    // ---------------------------
    // ADMIN COMMANDS (LOG MANAGEMENT)
    // ---------------------------
    async function handleLogCommand(message, logType, enable) {
        const channelId = message.channel.id;
        const logName = {
            action: 'Action (활동)',
            mod: 'Moderation (관리)',
            filter: 'Filter (금지어)'
        }[logType];
        
        let replyMessage;

        if (enable) {
            LOG_CHANNELS[logType] = channelId;
            saveLogConfig();
            replyMessage = `✅ **${logName}** 로그가 이 채널(${message.channel})에 **설정**되었습니다.`;
        } else {
            if (LOG_CHANNELS[logType] === channelId) {
                LOG_CHANNELS[logType] = null;
                saveLogConfig();
                replyMessage = `❎ **${logName}** 로그가 이 채널에서 **해제**되었습니다.`;
            } else {
                replyMessage = `⚠ **${logName}** 로그는 이 채널에 설정되어 있지 않습니다.`;
            }
        }

        const reply = await message.reply(replyMessage);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
    }

    if (cmd === "!addactionlog") { return handleLogCommand(message, 'action', true); }
    if (cmd === "!removeactionlog") { return handleLogCommand(message, 'action', false); }
    if (cmd === "!addmodlog") { return handleLogCommand(message, 'mod', true); }
    if (cmd === "!removemodlog") { return handleLogCommand(message, 'mod', false); }
    if (cmd === "!addfilterlog") { return handleLogCommand(message, 'filter', true); }
    if (cmd === "!removefilterlog") { return handleLogCommand(message, 'filter', false); }

    if (cmd === "!addlog") {
        LOG_CHANNELS.action = message.channel.id;
        LOG_CHANNELS.mod = message.channel.id;
        LOG_CHANNELS.filter = message.channel.id;
        saveLogConfig();
        const reply = await message.reply(`✅ 모든 유형의 로그 (Action, Mod, Filter)가 이 채널(${message.channel})에 **설정**되었습니다.`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    if (cmd === "!deletelog") {
        LOG_CHANNELS.action = null;
        LOG_CHANNELS.mod = null;
        LOG_CHANNELS.filter = null;
        saveLogConfig();
        const reply = await message.reply(`❎ 모든 유형의 로그 (Action, Mod, Filter)가 **해제**되었습니다.`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }
    
    // ---------------------------
    // MODERATION COMMANDS (Moderator+)
    // ---------------------------
    
    // ========== !addword ==========
    if (cmd === "!addword") {
        const newWord = args.slice(1).join(" ").toLowerCase().trim();
        if (!newWord) {
            const reply = await message.reply("Usage: `!addword [word]`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        if (BLACKLISTED_WORDS.includes(newWord)) {
            const reply = await message.reply(`⚠ **${newWord}** is already in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        BLACKLISTED_WORDS.push(newWord);
        saveBlacklist(); 
        const reply = await message.reply(`✅ Added **${newWord}** to the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }

    // ========== !removeword ==========
    if (cmd === "!removeword") {
        const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
        if (!wordToRemove) {
            const reply = await message.reply("Usage: `!removeword [word]`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        const initialLength = BLACKLISTED_WORDS.length;
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== wordToRemove);
        
        if (BLACKLISTED_WORDS.length === initialLength) {
            const reply = await message.reply(`⚠ **${wordToRemove}** was not found in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        saveBlacklist(); 
        const reply = await message.reply(`✅ Removed **${wordToRemove}** from the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }
    
    // ========== !listwords ==========
    if (cmd === "!listwords") {
        const words = BLACKLISTED_WORDS.length > 0 ? BLACKLISTED_WORDS.join(', ') : "The blacklist is empty.";
        const listEmbed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle(`🚫 Current Blacklisted Words (${BLACKLISTED_WORDS.length} total)`)
            .setDescription(words.substring(0, 4096));
        await message.reply({ embeds: [listEmbed] });
        return;
    }
    
    // ========== !reloadblacklist ==========
    if (cmd === "!reloadblacklist") {
        loadBlacklist(); 
        const reply = await message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }
    
    // ========== !ban ==========
    if (cmd === "!ban") {
        const user = message.mentions.members?.first();
        const reason = args.slice(2).join(" ") || "No reason provided";
        if (!user) {
            const reply = await message.reply("Usage: `!ban @user [reason]`");
            return; 
        }

        try {
            await user.ban({ reason });
            const reply = await message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
            
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
                .setColor("#DC143C")
                .setTitle("🔨 User Banned (Command)")
                .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.user.tag}**\n**Reason:** ${reason}`)
                .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            return; 
        } catch (err) {
            const reply = await message.reply("⚠ Failed to ban that user. Check hierarchy/permissions.");
            return; 
        }
    }

    // ========== !kick ==========
    if (cmd === "!kick") {
        const user = message.mentions.members?.first();
        const reason = args.slice(2).join(" ") || "No reason provided";
        if (!user) {
            const reply = await message.reply("Usage: `!kick @user [reason]`");
            return; 
        }

        try {
            await user.kick(reason);
            const reply = await message.reply(`👢 Kicked **${user.user.tag}**. Reason: ${reason}`);

            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#FFD700")
              .setTitle("👢 User Kicked")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.user.tag}**\n**Reason:** ${reason}`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            return; 
        } catch (err) {
            const reply = await message.reply("⚠ Failed to kick that user. Check hierarchy/permissions.");
            return; 
        }
    }

    // ========== !mute (Timeout) ==========
    if (cmd === "!mute") {
        const user = message.mentions.members?.first();
        const minutes = parseInt(args[2]) || 10;
        if (!user || minutes <= 0 || isNaN(minutes)) {
            const reply = await message.reply("Usage: `!mute @user <minutes>` (e.g., `!mute @user 5`)");
            return; 
        }

        try {
            await user.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
            const reply = await message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
            
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#4682B4")
              .setTitle("🔇 User Timed Out/Muted")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.user.tag}**\n**Duration:** ${minutes} minutes`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            return; 
        } catch (err) {
            const reply = await message.reply("⚠ Failed to mute that user. Check permissions.");
            return; 
        }
    }

    // ========== !unmute ==========
    if (cmd === "!unmute") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply("Usage: `!unmute @user`");
            return; 
        }

        try {
            await user.timeout(null, `Unmuted by ${message.author.tag}`);
            const reply = await message.reply(`🔊 Unmuted **${user.user.tag}**.`);
            
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#7FFF00")
              .setTitle("🔊 User Untimed Out/Unmuted")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.user.tag}**`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);
            
            return; 
        } catch (err) {
            const reply = await message.reply("⚠ Failed to unmute that user. Check permissions.");
            return; 
        }
    }

    // ========== !prune (Clear Messages) ==========
    if (cmd === "!prune") {
        const amount = parseInt(args[1]);
        if (!amount || amount < 1 || amount > 100) {
            const reply = await message.reply("Usage: `!prune 1-100`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        try {
            await message.channel.bulkDelete(amount, true);
            const m = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
            setTimeout(() => m.delete().catch(() => {}), 1000); 
        } catch (err) {
            const reply = await message.reply("⚠ Could not delete messages (maybe older than 14 days).");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
    }
    
    // ========== !addrole / !removerole ==========
    async function handleRoleCommand(message, action) {
        const target = message.mentions.members?.first();
        if (!target) {
            const reply = await message.reply(`Usage: \`${cmd} @user RoleName\``);
            return;
        }

        const roleName = args.slice(2).join(" ").trim();
        if (!roleName) {
            const reply = await message.reply("Please provide a role name or ID.");
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase() || r.id === roleName
        );
        if (!role) {
            const reply = await message.reply(`⚠ Could not find a role named or ID **${roleName}**.`);
            return;
        }

        try {
            if (action === 'add') {
                await target.roles.add(role);
                const reply = await message.reply(`✅ Added role **${role.name}** to **${target.user.tag}**.`);
                return;
            } else { // remove
                await target.roles.remove(role);
                const reply = await message.reply(`❎ Removed role **${role.name}** from **${target.user.tag}**.`);
                return;
            }
        } catch (err) {
            const reply = await message.reply(`⚠ Failed to ${action} the role. Check permissions and hierarchy.`);
            return;
        }
    }

    if (cmd === "!addrole") { return handleRoleCommand(message, 'add'); }
    if (cmd === "!removerole") { return handleRoleCommand(message, 'remove'); }
    
    
    // ---------------------------
    // PANEL SETUP COMMANDS (Admin Only)
    // ---------------------------
    
    const RULES_BANNER_URL = "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
    const WELCOME_BANNER_URL = "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
    const NOTIFICATION_BANNER_URL = "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c985f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";

    const COLOR_ROLES = [
        // Role IDs must be modified! (.env 변수를 사용합니다)
        { customId: "color_icey", emoji: "❄️", label: "~ icey azure ~", roleId: process.env.ICEY_AZURE_ROLE_ID },
        { customId: "color_candy", emoji: "🍭", label: "~ candy ~", roleId: process.env.CANDY_ROLE_ID },
        { customId: "color_lilac", emoji: "🌸", label: "~ lilac ~", roleId: process.env.LILAC_ROLE_ID },
        { customId: "color_blush", emoji: "❤️", label: "~ blush ~", roleId: process.env.BLUSH_ROLE_ID },
        { customId: "color_bubblegum", emoji: "🍥", label: "~ bubblegum ~", roleId: process.env.BUBBLEGUM_ROLE_ID },
        { customId: "color_chocolate", emoji: "🍫", label: "~ chocolate ~", roleId: process.env.CHOCOLATE_ROLE_ID },
    ];


    // ========== !setupjoin (Rules Panel) ==========
    if (cmd === "!setupjoin") {
        const joinEmbed = new EmbedBuilder()
            .setColor("#1e90ff")
            .setTitle("✨ Welcome to the Gosu General TV Community!")
            .setDescription(
                [
                    "Press **Agree To Rules** below to enter and enjoy the server! 🎊",
                    "",
                    "--------------------------------------------------------",
                    "### 📜 Server Rules (Click to Agree)",
                    "✨ **1 – Be Respectful** (Treat everyone kindly.)",
                    "✨ **2 – No Spam** (Avoid repeated messages/mentions.)",
                    "✨ **3 – No NSFW or Harmful Content** (Nothing adult or unsafe.)",
                    "✨ **4 – No Advertising** (No links/promos without staff approval.)",
                    "✨ **5 – Keep it Clean** (No hate speech/slurs/drama.)",
                    "✨ **6 – Follow Staff Instructions** (Please follow all staff guidance.)",
                    "--------------------------------------------------------",
                ].join("\n")
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("agree_rules") 
                .setLabel("Agree To Rules")
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ files: [{ attachment: RULES_BANNER_URL, name: 'must_read.png' }] });
        await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
        return;
    }
    
    // ========== !welcome (Welcome Panel) ==========
    if (cmd === "!welcome") {
        const welcomeEmbed = new EmbedBuilder()
            .setColor("#1e90ff")
            .setTitle("✨ Welcome to the Gosu General TV Discord Server!")
            .setDescription(
                [
                    "Greetings, adventurer!", 
                    "Welcome to the **Gosu General TV** community server.",
                    "---",
                    "### 📌 What you can find here",
                    "• Live stream notifications & announcements",
                    "• Game discussions and guides",
                    "• Clips, highlights, and community content",
                    "• Chill chat with other Gosu viewers",
                    "---",
                    "Enjoy your stay and have fun! 💙",
                ].join("\n")
            )
            .addFields(
                { name: "Official Links", value: "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://www.twitch.tv/gosugeneraltv)", inline: true },
                { name: "Discord Invite Link", value: "🔗 [Invite Link](https://discord.gg/gosugeneral)", inline: true }
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("YouTube Channel").setStyle(ButtonStyle.Link).setURL("https://youtube.com/@Teamgosu"), 
            new ButtonBuilder().setLabel("Twitch Channel").setStyle(ButtonStyle.Link).setURL("https://www.twitch.tv/gosugeneraltv"), 
            new ButtonBuilder().setLabel("Invite Link").setStyle(ButtonStyle.Link).setURL("https://discord.gg/gosugeneral")
        );

        await message.channel.send({ files: [{ attachment: WELCOME_BANNER_URL, name: 'welcome.png' }] }); 
        await message.channel.send({ embeds: [welcomeEmbed], components: [buttons] });
        return;
    }
    
    // ========== !color (Color Role Panel) ==========
    if (cmd === "!color") {
        const colorEmbed = new EmbedBuilder()
            .setColor("#FFAACD")
            .setTitle("Color Roles")
            .setDescription(
                [
                    "Choose one of the **Color** roles below.",
                    "You can only have **one** of these colors at a time.",
                    "Click a button to select or remove a color.",
                ].join("\n")
            );

        const rows = [];
        for (let i = 0; i < COLOR_ROLES.length; i += 3) {
            const slice = COLOR_ROLES.slice(i, i + 3);
            const row = new ActionRowBuilder();
            slice.forEach((c) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(c.customId)
                        .setEmoji(c.emoji)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            rows.push(row);
        }

        await message.channel.send({ embeds: [colorEmbed], components: rows });
        return;
    }
    
    // ========== !subscriber (Live Notification Panel - Admin+) ==========
    if (cmd === "!subscriber") {
        const subEmbed = new EmbedBuilder()
            .setColor("#FFCC33")
            .setTitle("📺 Gosu General TV — Live Notifications")
            .setDescription(
                [
                    "If you’d like to receive alerts when **Gosu General TV** goes live or posts important announcements,",
                    "press `Subscribe / Unsubscribe` to get or remove the **Live Notifications** role.",
                    "",
                    "Note: Subscribing will temporarily replace your **Member** role. Press the button again to return to the Member role.",
                    "",
                    "Thank you for being part of the community! 💙",
                ].join("\n")
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("sub_subscribe")
                .setLabel("Subscribe / Unsubscribe")
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ files: [{ attachment: NOTIFICATION_BANNER_URL, name: 'notification_banner.png' }] }); 
        await message.channel.send({ embeds: [subEmbed], components: [row] });
        return;
    }
    
    // ---------------------------
    // GENERAL COMMANDS
    // ---------------------------
    
    // ========== !ping ==========
    if (cmd === "!ping") {
        return message.reply("Pong!");
    }
    
    // ========== !invite ==========
    if (cmd === "!invite") {
        return message.reply("📨 **Server Invite:** https://discord.gg/gosugeneral");
    }

    // ========== !help or /? ==========
    if (cmd === "!help" || cmd === "/?") {
        const help = new EmbedBuilder()
            .setColor("#00FFFF")
            .setTitle("Gosu Bot — Commands")
            .setDescription(
                [
                    "**General**",
                    "`!ping` / `!invite` — Basic commands.",
                    "",
                    "**Moderation / Filter Management (Moderator+)**",
                    "`!ban @user` / `!kick @user` / `!mute @user <min>` / `!unmute @user`",
                    "`!prune [1-100]` — Delete messages.",
                    "`!addword` / `!removeword` / `!listwords` / `!reloadblacklist` — Filter management.",
                    "`!addrole` / `!removerole` — Manual role management.",
                    "",
                    "**Admin / Developer (Log & Panel Setup)**",
                    "`!addlog` / `!deletelog` — Set/unset ALL logs to the current channel.",
                    "`!addactionlog` / `!removeactionlog` — Activity logs (Join, Leave, Voice, Role, Msg Delete).",
                    "`!addmodlog` / `!removemodlog` — Moderation logs (Kick, Ban, Mute).",
                    "`!addfilterlog` / `!removefilterlog` — Filter hit logs.",
                    "`!setupjoin` / `!welcome` / `!subscriber` / `!color` — Panel setup.",
                ].join("\n")
            );
        return message.reply({ embeds: [help] });
    }
});


// =====================================================
// BUTTON INTERACTIONS (Rules + Colors + Subscribe Panel)
// =====================================================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, member } = interaction;

    // -------- Agree To Rules (MEMBER_ROLE 부여) --------
    if (customId === "agree_rules") {
        const role = guild.roles.cache.get(MEMBER_ROLE); 
        if (!role) {
            return interaction.reply({ content: "⚠ Member role is not configured correctly. Please contact staff.", ephemeral: true, });
        }

        if (member.roles.cache.has(role.id)) {
            return interaction.reply({ content: "You already have access. Enjoy the server!", ephemeral: true, });
        }

        try {
            await member.roles.add(role);
            return interaction.reply({ content: `✅ You accepted the rules and received the **${role.name}** role. Welcome!`, ephemeral: true, });
        } catch (err) {
            console.error("Agree rules error:", err);
            return interaction.reply({ content: "⚠ Failed to assign the role. Please contact staff.", ephemeral: true, });
        }
    }

    // -------- Subscribe / Unsubscribe Toggle Button (SUB_ROLE, MEMBER_ROLE 상호 배타적 토글) --------
    if (customId === "sub_subscribe") {
        const subRole = guild.roles.cache.get(SUB_ROLE);
        const memberRole = guild.roles.cache.get(MEMBER_ROLE); 

        if (!subRole || !memberRole) {
            return interaction.reply({ content: "⚠ Subscription or Member role is not configured correctly. Please contact staff.", ephemeral: true, });
        }

        try {
            if (member.roles.cache.has(SUB_ROLE)) {
                // Unsubscribe: SUB_ROLE 제거, MEMBER_ROLE 부여
                await member.roles.remove(subRole);
                await member.roles.add(memberRole);
                return interaction.reply({ content: `🔕 Live notifications **unsubscribed**. Your role has been reset to **${memberRole.name}**.`, ephemeral: true, });
            } else {
                // Subscribe: SUB_ROLE 부여, MEMBER_ROLE 제거
                if (member.roles.cache.has(memberRole.id)) {
                    await member.roles.remove(memberRole);
                }
                await member.roles.add(subRole);
                return interaction.reply({ content: `✅ You are now **subscribed** to Live Notifications. Your **${memberRole.name}** role has been replaced.`, ephemeral: true, });
            }
        } catch (err) {
            console.error("Subscribe toggle error:", err);
            return interaction.reply({ content: "⚠ Failed to update your roles. Please contact staff.", ephemeral: true, });
        }
    }

    // -------- Color buttons (Mutually Exclusive Logic) --------
    const colorConfig = COLOR_ROLES.find((c) => c.customId === customId);
    if (colorConfig) {
        const role = guild.roles.cache.get(colorConfig.roleId);
        if (!role) {
            return interaction.reply({ content: "⚠ The color role for this button is not configured. Please contact staff.", ephemeral: true, });
        }

        try {
            const colorRoleIds = COLOR_ROLES.map((c) => c.roleId);
            const toRemove = member.roles.cache.filter((r) => colorRoleIds.includes(r.id));

            if (member.roles.cache.has(role.id)) {
                // Remove it
                await member.roles.remove(role);
                return interaction.reply({ content: `Removed color role **${role.name}**.`, ephemeral: true, });
            }

            // Remove all other colors, then add the new one
            if (toRemove.size > 0) {
                await member.roles.remove(toRemove);
            }

            await member.roles.add(role);
            return interaction.reply({ content: `You now have the color role **${role.name}**.`, ephemeral: true, });
        } catch (err) {
            console.error("Color role error:", err);
            return interaction.reply({ content: "⚠ Failed to update your color role. Check permissions.", ephemeral: true, });
        }
    }
});


// =====================================================
// ACTION LOGS (Message Delete / Join / Leave / Voice / Role)
// =====================================================

// -------- Message Delete (Action Log) --------
client.on("messageDelete", async (message) => {
    if (!message.guild || message.author?.bot || !message.author) return;
    if (!message.content) return; 

    const deleteEmbed = new EmbedBuilder()
        .setColor("#FF8C00")
        .setTitle("🗑️ Message Deleted")
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(
            `**User:** **@${message.author.tag}**\n` +
            `**Channel:** ${message.channel}\n` +
            `**Content:** \`\`\`${message.content.substring(0, 1000)}\`\`\``
        )
        .setTimestamp();

    sendLog(message.guild, 'action', deleteEmbed);
});

// -------- Guild Member Join / Leave --------
client.on("guildMemberAdd", async (member) => {
    const user = member.user;
    const joinEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("🟢 Member Joined")
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setDescription(`**@${user.tag}** joined the server!`)
        .addFields({ name: "Account Age", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>` })
        .setTimestamp();
    sendLog(member.guild, 'action', joinEmbed);
});

client.on("guildMemberRemove", async (member) => {
    const user = member.user || member; 
    const leaveEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("🔴 Member Left")
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() }) 
        .setDescription(`**@${user.tag}** left the server.`)
        .setTimestamp();
    sendLog(member.guild, 'action', leaveEmbed);
});

// -------- Voice State Update (음성 채널 활동) --------
client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.member?.user.bot) return;
    const user = newState.member.user;
    const guild = newState.guild;
    const embed = new EmbedBuilder().setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() }).setTimestamp();
    let action = '';

    if (oldState.channelId === null && newState.channelId !== null) {
        embed.setColor("#00BFFF").setTitle("🎤 Voice Channel Joined");
        embed.setDescription(`**@${user.tag}** joined voice channel **${newState.channel.name}**.`);
        action = 'join';
    } 
    else if (oldState.channelId !== null && newState.channelId === null) {
        embed.setColor("#FF4500").setTitle("🎤 Voice Channel Left");
        embed.setDescription(`**@${user.tag}** left voice channel **${oldState.channel.name}**.`);
        action = 'leave';
    } 
    else if (oldState.channelId !== null && newState.channelId !== null && oldState.channelId !== newState.channelId) {
        embed.setColor("#FFA500").setTitle("🎤 Voice Channel Moved");
        embed.setDescription(`**@${user.tag}** moved from **${oldState.channel.name}** to **${newState.channel.name}**.`);
        action = 'move';
    }
    
    if (action) {
        sendLog(guild, 'action', embed);
    }
});

// -------- Guild Member Update (역할 변경) --------
client.on("guildMemberUpdate", (oldMember, newMember) => {
    // 역할 개수가 변경되지 않았다면 리턴
    if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    let description = '';
    let color = '';

    if (addedRoles.size > 0) {
        description += `✅ Added roles: ${addedRoles.map(r => r.name).join(', ')}\n`;
        color = "#20B2AA";
    }
    if (removedRoles.size > 0) {
        description += `❎ Removed roles: ${removedRoles.map(r => r.name).join(', ')}\n`;
        color = "#B22222";
    }
    
    if (description) {
        const roleEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle("👤 User Roles Updated")
            .setDescription(`**User:** **@${newMember.user.tag}**\n` + description)
            .setTimestamp();

        sendLog(newMember.guild, 'action', roleEmbed);
    }
});


// =====================================================
// MODERATION LOGS (External Ban)
// =====================================================

// -------- Guild Ban Add (봇 명령어가 아닌 외부에서 밴되었을 경우) --------
client.on("guildBanAdd", async (ban) => {
    const banEmbed = new EmbedBuilder()
        .setColor("#DC143C")
        .setTitle("🔨 External Ban Detected")
        .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
        .setDescription(`**User:** **@${ban.user.tag}** was banned from the server.`)
        .setTimestamp();
        
    sendLog(ban.guild, 'mod', banEmbed);
});


// --------------------
// Login
// --------------------
client.login(process.env.BOT_TOKEN);
