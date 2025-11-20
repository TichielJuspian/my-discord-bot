const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
const MEMBER_ROLE = process.env.MEMBER_ROLE_ID;         // 멤버에게 부여할 기본 역할 ID (예: 12345...)
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID;           // 관리자 역할 ID
const GOSU_ROLE = process.env.GOSU_ROLE_ID;             // '고수' 역할 ID (Color Command용)
const MOD_ROLE = process.env.MOD_ROLE_ID;               // Moderation 명령어 사용 가능 역할 ID
const SUB_ROLE = "497654614729031681";                  // 알림 구독 역할 ID

// ----------------------------------------------------
// FILE PATH CONSTANTS
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';
const LOG_CONFIG_FILE_PATH = 'log_config.json';

// ---------------------------
// CHAT FILTER CONFIG
// ---------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

// 🔥 관리자만 필터 우회
const FILTER_EXEMPT_ROLES = [
    ADMIN_ROLE,
];

// ----------------------------------------------------
// GLOBAL LOG CONFIG
// ----------------------------------------------------
let LOG_CHANNELS = {
    action: null, // User actions (join, leave, voice, role changes)
    mod: null,    // Moderation actions (ban, kick, mute)
    filter: null  // Filter hits (blacklisted words)
};

// ----------------------------------------------------
// Helper: Function to save BLACKLIST JSON file
// ----------------------------------------------------
function saveBlacklist() {
    try {
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words.`);
    } catch (err) {
        console.error("Error saving blacklist.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load BLACKLIST JSON file
// ----------------------------------------------------
function loadBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, 'utf8');
        BLACKLISTED_WORDS = JSON.parse(data);
        console.log(`Loaded ${BLACKLISTED_WORDS.length} blacklisted words.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = [];
            saveBlacklist(); // Create an empty file
        } else {
            console.error("Error loading blacklist.json:", err.message);
        }
    }
}

// ----------------------------------------------------
// Helper: Function to save LOG JSON file
// ----------------------------------------------------
function saveLogConfig() {
    try {
        const jsonString = JSON.stringify(LOG_CHANNELS, null, 2);
        fs.writeFileSync(LOG_CONFIG_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved log config to ${LOG_CONFIG_FILE_PATH}.`);
    } catch (err) {
        console.error("Error saving log_config.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load LOG JSON file
// ----------------------------------------------------
function loadLogConfig() {
    try {
        const data = fs.readFileSync(LOG_CONFIG_FILE_PATH, 'utf8');
        const loadedConfig = JSON.parse(data);
        LOG_CHANNELS = { ...LOG_CHANNELS, ...loadedConfig };
        console.log(`Loaded log config from ${LOG_CONFIG_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${LOG_CONFIG_FILE_PATH} file not found. Creating a new one.`);
            saveLogConfig(); // Create an empty file
        } else {
            console.error("Error loading log_config.json:", err.message);
        }
    }
}

// ----------------------------------------------------
// Helper: Function to send Log Embeds
// ----------------------------------------------------
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


// ----------------------------------------------------
// Client Initialization (Intent error corrected)
// ----------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.GuildBans, 
        GatewayIntentBits.MessageReactions,
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER'],
});

// --------------------
// Bot Ready Event
// --------------------
client.once("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    loadBlacklist();
    loadLogConfig(); 
});

// --------------------
// Helper: Role Checking
// --------------------
function hasAdminPermission(member) {
    return member.roles.cache.has(ADMIN_ROLE);
}

function hasModPermission(member) {
    return member.roles.cache.has(ADMIN_ROLE) || member.roles.cache.has(MOD_ROLE);
}

// =====================================================
// COMMANDS (MESSAGE CREATE)
// =====================================================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const member = message.member;

    // ---------------------------
    // Permission Checks
    // ---------------------------
    const isAdmin = hasAdminPermission(member);
    const isMod = hasModPermission(member);
    const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

    // Admin Only Commands
    const adminOnly = ["!setupjoin", "!color", "!welcome", "!subscriber", "!addblacklist", "!removeblacklist", "!listwords", "!reloadblacklist",
                       "!addlog", "!deletelog", "!addactionlog", "!removeactionlog", "!addmodlog", "!removemodlog", "!addfilterlog", "!removefilterlog"];

    if (adminOnly.includes(cmd) && !isAdmin) {
        const reply = await message.reply("⛔ Permission Denied. This command is restricted to **Admin**.");
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // Mod Only Commands
    const modOnly = ["!ban", "!kick", "!mute", "!unmute"];
    if (modOnly.includes(cmd) && !isMod) {
        const reply = await message.reply("⛔ Permission Denied. This command is restricted to **Moderators**.");
        setTimeout(() => reply.delete().delete().catch(() => {}), 1000);
        return;
    }

    // ---------------------------
    // ADMIN COMMANDS
    // ---------------------------

    // ========== LOG MANAGEMENT COMMANDS (Admin Only) ==========
    
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


    // ========== BLACKLIST MANAGEMENT COMMANDS (생략) ==========
    if (cmd === "!addblacklist") {
        const word = args.slice(1).join(' ').trim().toLowerCase();
        if (!word) {
            const reply = await message.reply("Usage: `!addblacklist <word>`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        if (BLACKLISTED_WORDS.includes(word)) {
            const reply = await message.reply(`'${word}' is already in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        BLACKLISTED_WORDS.push(word);
        saveBlacklist();
        const reply = await message.reply(`✅ Added **${word}** to the blacklist.`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }

    if (cmd === "!removeblacklist") {
        const word = args.slice(1).join(' ').trim().toLowerCase();
        if (!word) {
            const reply = await message.reply("Usage: `!removeblacklist <word>`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        const index = BLACKLISTED_WORDS.indexOf(word);
        if (index === -1) {
            const reply = await message.reply(`'${word}' is not in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        BLACKLISTED_WORDS.splice(index, 1);
        saveBlacklist();
        const reply = await message.reply(`✅ Removed **${word}** from the blacklist.`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }

    if (cmd === "!listwords") {
        const words = BLACKLISTED_WORDS.length > 0 ? BLACKLISTED_WORDS.join(', ') : "The blacklist is empty.";
        const listEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("🚫 Current Blacklisted Words")
            .setDescription(words.substring(0, 4096));
        await message.reply({ embeds: [listEmbed] });
        return;
    }
    
    if (cmd === "!reloadblacklist") {
        loadBlacklist();
        const reply = await message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }


    // ---------------------------
    // MODERATION COMMANDS (Mod Only)
    // ---------------------------

    // !ban
    if (cmd === "!ban") {
        const target = message.mentions.members.first();
        const reason = args.slice(2).join(" ") || "No reason provided.";
        
        if (!target) {
            const reply = await message.reply("Usage: `!ban @user [reason]`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        const user = target.user;

        try {
            await target.ban({ reason });
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#DC143C")
              .setTitle("🔨 User Banned (Command)")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.tag}**\n**Reason:** ${reason}`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            const reply = await message.reply(`🔨 Banned **@${user.tag}**. Reason: ${reason}`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        } catch (err) {
            console.error(err);
            const reply = await message.reply("Failed to ban the user. Check the bot's permissions and role hierarchy.");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
    }
    
    // !kick
    if (cmd === "!kick") {
        const target = message.mentions.members.first();
        const reason = args.slice(2).join(" ") || "No reason provided.";

        if (!target) {
            const reply = await message.reply("Usage: `!kick @user [reason]`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        const user = target.user;

        try {
            await target.kick(reason);
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#FFD700")
              .setTitle("👢 User Kicked")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.tag}**\n**Reason:** ${reason}`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            const reply = await message.reply(`👢 Kicked **@${user.tag}**. Reason: ${reason}`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        } catch (err) {
            const reply = await message.reply("Failed to kick the user. Check the bot's permissions and role hierarchy.");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
    }

    // !mute (Timeout)
    if (cmd === "!mute") {
        const target = message.mentions.members.first();
        const minutes = parseInt(args[2]);

        if (!target || isNaN(minutes) || minutes <= 0) {
            const reply = await message.reply("Usage: `!mute @user <minutes>` (e.g., `!mute @user 5`)");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        
        const user = target.user;

        try {
            await target.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#4682B4")
              .setTitle("🔇 User Timed Out/Muted")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.tag}**\n**Duration:** ${minutes} minutes`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            const reply = await message.reply(`🔇 Muted **@${user.tag}** for ${minutes} minutes.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        } catch (err) {
            const reply = await message.reply("Failed to mute the user. Check the bot's permissions.");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
    }

    // !unmute (Remove Timeout)
    if (cmd === "!unmute") {
        const target = message.mentions.members.first();

        if (!target) {
            const reply = await message.reply("Usage: `!unmute @user`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
        
        const user = target.user;

        try {
            await target.timeout(null, `Unmuted by ${message.author.tag}`);
            // MOD LOG 전송
            const modLogEmbed = new EmbedBuilder()
              .setColor("#7FFF00")
              .setTitle("🔊 User Untimed Out/Unmuted")
              .setDescription(`**Moderator:** ${message.author}\n**User:** **@${user.tag}**`)
              .setTimestamp();
            sendLog(message.guild, 'mod', modLogEmbed);

            const reply = await message.reply(`🔊 Unmuted **@${user.tag}**.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        } catch (err) {
            const reply = await message.reply("Failed to unmute the user. Check the bot's permissions.");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }
    }

    // ---------------------------
    // CHAT FILTER LOGIC (⭐ 안정화 버전: 단어 단위 필터링)
    // ---------------------------
    if (!isExempt) {
        // 1. 정규화(NFC)로 초성/중성 분리 우회 방지 및 소문자 변환
        const normalizedContent = message.content.normalize('NFC').toLowerCase();

        // 2. 메시지를 띄어쓰기(공백) 기준으로 단어 배열로 분리
        const contentWords = normalizedContent.split(/\s+/).filter(w => w.length > 0);

        let foundWord = null;

        // 🌟 3. 단어 배열 순회하며 필터링
        for (const word of BLACKLISTED_WORDS) {
            // 금지어에서 특수문자를 제거하여 '순수한 금지어'를 준비합니다.
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, '');

            if (!simplifiedWord) continue;

            for (const contentWord of contentWords) {
                // 사용자의 단어에서도 특수문자를 제거하여 '순수한 사용자 단어'를 준비합니다.
                const simplifiedContentWord = contentWord.replace(/[^가-힣a-z0-9]/g, '');

                // 순수한 사용자 단어가 순수한 금지어를 포함하는지 확인 (오탐 줄임)
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
            
            // 삭제
            if (!message.deleted) {
                message.delete().catch(() => {
                    console.error(`Failed to delete message: ${message.id}`);
                });
            }

            // 🌟 필터 경고 메시지 (Embed)
            const warningEmbed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("🚫 Watch Your Language!")
                .setDescription(`**${member}**, your message contained a blacklisted word and has been removed.`);

            await message.channel.send({ embeds: [warningEmbed] });

            return;
        }
    }

    // ---------------------------
    // General Commands
    // ---------------------------

    // !help
    if (cmd === "!help") {
        const helpEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("🤖 Bot Command List")
            .setDescription(
                [
                    "**General**",
                    "`!help` — Display this help message.",
                    "",
                    "**Moderation (Moderator Only)**",
                    "`!ban @user [reason]` — Ban a user.",
                    "`!kick @user [reason]` — Kick a user.",
                    "`!mute @user <minutes>` — Timeout (Mute) a user.",
                    "`!unmute @user` — Remove timeout (Unmute) a user.",
                    "",
                    "**Admin / Developer (Log Configuration)**",
                    "`!addlog` / `!deletelog` — 모든 로그를 이 채널에 설정/해제합니다.",
                    "`!addactionlog` / `!removeactionlog` — 활동 로그 (가입/퇴장, 음성, 역할)를 설정/해제합니다.",
                    "`!addmodlog` / `!removemodlog` — 관리자 활동 로그 (킥/밴/뮤트)를 설정/해제합니다.",
                    "`!addfilterlog` / `!removefilterlog` — 금지어 사용 로그를 설정/해제합니다.",
                    "",
                    "**Admin / Developer (Filter Management)**",
                    "`!addblacklist <word>` — Add a word to the blacklist.",
                    "`!removeblacklist <word>` — Remove a word from the blacklist.",
                    "`!listwords` — List all blacklisted words.",
                    "`!reloadblacklist` — Reload blacklist from file.",
                ].join("\n")
            );
        await message.reply({ embeds: [helpEmbed] });
        return;
    }
    
    // ... (여기에 !setupjoin, !color, !welcome 등 다른 명령어가 있다면 추가) ...
});


// =====================================================
// BUTTON INTERACTIONS (SUBSCRIBE TOGGLE)
// =====================================================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, member } = interaction;
    
    // -------- Subscribe / Unsubscribe Toggle Button (단일 역할 토글 로직) --------
    if (customId === "sub_subscribe") {
        const subRole = guild.roles.cache.get(SUB_ROLE);

        if (!subRole) {
            return interaction.reply({
                content: "⚠ Live Notification 역할 ID가 올바르게 설정되지 않았습니다. 관리자에게 문의하세요.",
                ephemeral: true,
            });
        }

        try {
            // 1. 현재 멤버가 구독 역할을 가지고 있는지 확인
            if (member.roles.cache.has(SUB_ROLE)) {
                // 2. 역할 제거 (Unsubscribe)
                await member.roles.remove(subRole);
                return interaction.reply({
                    content: `🔕 실시간 알림 역할 (**${subRole.name}**)이 **제거**되었습니다.`,
                    ephemeral: true,
                });
            } else {
                // 3. 역할 부여 (Subscribe)
                await member.roles.add(subRole);

                return interaction.reply({
                    content: `✅ 실시간 알림 역할 (**${subRole.name}**)이 **부여**되었습니다.`,
                    ephemeral: true,
                });
            }
        } catch (err) {
            console.error("Subscribe toggle error:", err);
            return interaction.reply({
                content: "⚠ 역할을 업데이트하지 못했습니다. 봇의 권한을 확인하세요.",
                ephemeral: true,
            });
        }
    }
    // ... (다른 버튼 로직이 있다면 여기에 추가) ...
});


// =====================================================
// ACTION LOGS (Message Delete / Join / Leave / Voice / Role)
// =====================================================

// -------- Message Delete (일반적인 Action Log로 처리) --------
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
