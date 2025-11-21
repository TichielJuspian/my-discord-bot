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
const CONFIG_FILE_PATH = 'config.json'; // ⬅️ 로그 채널 설정 파일
let BOT_CONFIG = {}; // ⬅️ 로그 채널 ID를 저장할 변수

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
// Admin 역할 ID를 495718851288236032로 설정합니다.
const GOSU_ROLE = process.env.GOSU_ROLE_ID || "PUT_GOSU_ROLE_ID_HERE";       // Main Gosu Role (규칙 동의 후 부여되는 기본 역할 ID)
const MOD_ROLE = process.env.MOD_ROLE_ID || "PUT_MOD_ROLE_ID_HERE";         // Moderator Role (관리 및 필터 면제 역할 ID)
const ADMIN_ROLE = "495718851288236032";   // ⬅️ Admin 역할 ID 반영 완료
const SUB_ROLE = process.env.SUB_ROLE_ID || "PUT_SUB_ROLE_ID_HERE";         // Live Notification Subscriber Role (알림 역할 ID)

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
    MOD_ROLE,
    ADMIN_ROLE, // ⬅️ Admin 역할 면제 목록에 추가 완료
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
    // 1. Log Channel Config 로드
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
    
    // 로그 채널 ID 필드 초기화 (없으면 null)
    if (!BOT_CONFIG.actionLogChannelId) BOT_CONFIG.actionLogChannelId = null;
    if (!BOT_CONFIG.msgLogChannelId) BOT_CONFIG.msgLogChannelId = null;
    if (!BOT_CONFIG.modLogChannelId) BOT_CONFIG.modLogChannelId = null;
    saveConfig(); // 변경사항 저장 및 파일 생성 보장
    
    // 2. Blacklist 로드 (기존 loadBlacklist() 함수 호출)
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
        GatewayIntentBits.MessageContent, // 메시지 내용을 읽기 위해 필수
        GatewayIntentBits.GuildPresences, // (선택적) 봇이 멤버 캐싱을 더 잘하도록 도움
        GatewayIntentBits.GuildMessageReactions, // ⬅️ 추가 (메시지 삭제/수정 로그를 위해)
        GatewayIntentBits.GuildVoiceStates, // ⬅️ 추가 (음성 채널 상태 변경 로그를 위해)
    ],
    // Intents 에러 방지 및 멤버 관리를 위해 Partials 추가
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
    loadConfigAndBlacklist(); // ⬅️ 봇 시작 시 설정 및 금지어 로드
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
    const isCommand = cmd && cmd.startsWith("!"); // !로 시작하면 명령어
    const member = message.member; // member 변수도 여기서 선언

    
// ---------------------------
// 1. CHAT FILTER LOGIC
// ---------------------------
    // 명령어 사용자와 필터 면제 역할을 가진 멤버는 필터링을 건너뜺습니다.
    const isExempt = isCommand || FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

    if (!isExempt) {
        let foundLinkFilterMatch = null;
        const normalizedMessage = message.content.toLowerCase();

        // ------------------------------------------------------------------
        // NEW: Enhanced Link and Pattern Filter (사기/스팸 링크 필터링)
        // ------------------------------------------------------------------

        // #1 Discord Invite Filter (차단할 인바이트가 아닌지 확인)
        // 공식 초대 링크를 여기에 넣어주세요. (사용자 지정)
        const allowedInvites = ['discord.gg/gosugeneral', 'discord.gg/xgxD5hB'];
        const containsDiscordInvite = normalizedMessage.match(/(discord\.gg)\/(\w+)/g)?.length > 0;
        const isAllowedInvite = allowedInvites.some(invite => normalizedMessage.includes(invite));

        if (containsDiscordInvite && !isAllowedInvite) {
            foundLinkFilterMatch = "Unpermitted Discord Invite";
        }
        
        // #2 OnlyFans Filter (특정 성인 콘텐츠 키워드 필터)
        else if (normalizedMessage.includes("only fans") || normalizedMessage.includes("onlyfans")) {
            foundLinkFilterMatch = "Explicit Content Keyword (OnlyFans)";
        }
        
        // #3 General Link/URL Filter
        // NOTE: 이 필터는 광범위하여 일반적인 링크(http 포함)까지 차단합니다. 
        // 오탐을 줄이기 위해 자주 사용하는 안전한 도메인은 예외 처리했습니다. (추가 필요 시 수정)
        const generalUrlMatch = normalizedMessage.match(/(https?:\/\/)?(www\.)?(\w+)\.(\w+)\/(\w)+/g)?.length > 0;
        if (!foundLinkFilterMatch && (normalizedMessage.includes("http") || generalUrlMatch)) {
            const safeDomains = ['youtube.com', 'youtu.be', 'twitch.tv', 'google.com', 'naver.com']; // <-- 여기에 안전한 도메인을 추가하세요.
            
            // 안전 도메인에 포함되지 않는 링크가 감지되었을 경우
            if (!safeDomains.some(domain => normalizedMessage.includes(domain))) {
                 foundLinkFilterMatch = "Unpermitted General URL";
            }
        }

        // ------------------------------------------------------------------
        // Enhanced Link Filter에 걸렸을 경우 메시지 삭제 및 로그 기록
        // ------------------------------------------------------------------
        if (foundLinkFilterMatch) {
            // MSG LOG 기록
            if (BOT_CONFIG.msgLogChannelId) {
                const logChannel = message.guild.channels.cache.get(BOT_CONFIG.msgLogChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor("#FF00FF") 
                        .setTitle("🚨 Enhanced Filter Detected (Deleted)")
                        .addFields(
                            { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
                            { name: "Reason", value: foundLinkFilterMatch, inline: true }, // 필터링 사유 추가
                            { name: "Content", value: message.content.substring(0, 1024), inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Message Filtered` });

                    logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("[ERROR] Error sending enhanced filter log:", err));
                }
            }
            
            // 메시지 삭제
            if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                if (!message.deleted) {
                    message.delete().catch(err => {
                        console.error(`Failed to delete message: ${message.id}`, err);
                    });
                }
            } else {
                console.error("Bot lacks 'Manage Messages' permission to delete filtered messages.");
            }

            // 경고 메시지 전송
            const warningMessage = await message.channel.send(`**${member}** Your message was removed due to containing an unpermitted link or pattern: **${foundLinkFilterMatch}**.`);
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
            return; // 추가 처리를 중단하고 종료
        }
        
        // ------------------------------------------------------------------
        // 기존 BLACKLISTED_WORDS 필터 로직 (링크 필터에 걸리지 않았을 경우 실행)
        // ------------------------------------------------------------------
        // 1. 정규화(NFC)를 사용하여 분리된 초성/중성을 완성된 글자로 합칩니다.
        // NOTE: Link Filter에서 이미 normalizedMessage를 사용했으나, 기존 로직 유지를 위해 다시 정의
        const normalizedContentExisting = message.content.normalize('NFC').toLowerCase(); 

        // 2. (개선) 모든 특수문자를 제거합니다. 띄어쓰기는 유지합니다.
        // [가-힣a-z0-9]를 제외한 문자는 모두 제거합니다. (띄어쓰기는 정규식에 포함하지 않으므로 유지됨)
        const simplifiedContent = normalizedContentExisting.replace(/[^가-힣a-z0-9\s]/g, '');

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
            // 3. 금지어 자체에서 공백을 포함한 모든 특수문자를 제거합니다.
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, ''); // 금지어에서는 띄어쓰기까지 제거

            if (simplifiedWord.length < 2) continue; // 단일 문자는 필터링하지 않음 (오탐 방지)

            // 4. 메시지 내용에서 *임시로* 띄어쓰기를 제거한 버전을 만들어서 금지어 (띄어쓰기 제거됨) 와 비교합니다.
            // 이렇게 하면 '바 보' (메시지)를 '바보' (금지어)로 찾을 수 있습니다.
            const contentWithoutSpaces = simplifiedContent.replace(/\s/g, ''); 
            
            // 5. '띄어쓰기 제거 버전'으로 검사 (오탐 방지를 위해 이 검사를 덜 엄격하게 사용)
            if (contentWithoutSpaces.includes(simplifiedWord)) {
                foundWord = word;
                break;
            }

            // 6. (추가) 메시지 내용(띄어쓰기 유지, 특수문자 제거)을 공백 기준으로 나눕니다.
            const contentWords = simplifiedContent.split(/\s+/).filter(w => w.length > 0);

            // 7. 금지어 (특수문자 제거)가 메시지 내용의 각 단어에 포함되어 있는지 확인 (오탐이 덜함)
            // '바보'가 금지어일 때, 메시지 '나는 바보가 아니다' -> '바보'가 포함됨 -> 필터링
            if (contentWords.some(w => w.includes(simplifiedWord))) {
                foundWord = word;
                break;
            }

        }

        if (foundWord) {
            // MSG LOG 기록
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
            // ... (메시지 삭제 및 경고 로직은 기존과 동일)
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
// 2. MODERATION COMMANDS (관리 명령어)
// ---------------------------

    if (!isCommand || !isModerator(member)) return; // 명령어가 아니거나 관리자가 아니면 여기서 종료

    switch (cmd) {
        case "!addword":
            {
                const wordToAdd = args.slice(1).join(" ").toLowerCase();
                if (!wordToAdd) {
                    return message.reply("❌ 사용법: `!addword [추가할 단어/문구]`");
                }

                if (BLACKLISTED_WORDS.includes(wordToAdd)) {
                    return message.reply(`⚠ **${wordToAdd}**는 이미 금지어 목록에 있습니다.`);
                }

                BLACKLISTED_WORDS.push(wordToAdd);
                saveBlacklist(); // 파일에 저장

                message.reply(`✅ 금지어 **${wordToAdd}**를 성공적으로 추가했습니다. 현재 총 ${BLACKLISTED_WORDS.length}개의 금지어가 있습니다.`);
                break;
            }

        case "!removeword":
            {
                const wordToRemove = args.slice(1).join(" ").toLowerCase();
                if (!wordToRemove) {
                    return message.reply("❌ 사용법: `!removeword [제거할 단어/문구]`");
                }

                const initialLength = BLACKLISTED_WORDS.length;
                BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(w => w !== wordToRemove);

                if (BLACKLISTED_WORDS.length < initialLength) {
                    saveBlacklist(); // 파일에 저장
                    message.reply(`✅ 금지어 **${wordToRemove}**를 목록에서 제거했습니다. 현재 총 ${BLACKLISTED_WORDS.length}개의 금지어가 있습니다.`);
                } else {
                    message.reply(`⚠ **${wordToRemove}**는 금지어 목록에 없습니다.`);
                }
                break;
            }

        case "!listwords":
            {
                if (BLACKLISTED_WORDS.length === 0) {
                    return message.reply("✅ 현재 금지어 목록이 비어 있습니다.");
                }

                const list = BLACKLISTED_WORDS.map((w, i) => `${i + 1}. ${w}`).join('\n');
                const embed = new EmbedBuilder()
                    .setColor("#87CEEB")
                    .setTitle(`🚫 현재 금지어 목록 (${BLACKLISTED_WORDS.length}개)`)
                    .setDescription(`\`\`\`\n${list.substring(0, 4000)}\n\`\`\``) // Discord embed limit 4096
                    .setFooter({ text: "단어는 대소문자를 구분하지 않으며, 특수문자나 띄어쓰기를 우회할 수 있습니다." });

                message.reply({ embeds: [embed] });
                break;
            }

        case "!setlogchannel":
            {
                const channelId = args[1];
                const type = args[2]?.toLowerCase();
                
                if (!channelId || !type) {
                    return message.reply("❌ 사용법: `!setlogchannel [채널ID] [action/msg/mod]`");
                }
                
                if (type === 'action') {
                    BOT_CONFIG.actionLogChannelId = channelId;
                    message.reply(`✅ **Action Log Channel**이 <#${channelId}>으로 설정되었습니다.`);
                } else if (type === 'msg') {
                    BOT_CONFIG.msgLogChannelId = channelId;
                    message.reply(`✅ **Message Filter Log Channel**이 <#${channelId}>으로 설정되었습니다.`);
                } else if (type === 'mod') {
                    BOT_CONFIG.modLogChannelId = channelId;
                    message.reply(`✅ **Moderation Log Channel**이 <#${channelId}>으로 설정되었습니다.`);
                } else {
                    return message.reply("❌ 유효하지 않은 로그 타입입니다. [action/msg/mod] 중 하나를 사용하세요.");
                }
                
                saveConfig();
                break;
            }

        case "!logs":
            {
                const embed = new EmbedBuilder()
                    .setColor("#00FFFF")
                    .setTitle("📜 현재 로그 채널 설정")
                    .addFields(
                        { name: "Action Log (규칙/알림)", value: BOT_CONFIG.actionLogChannelId ? `<#${BOT_CONFIG.actionLogChannelId}>` : "미설정", inline: false },
                        { name: "Message Filter Log (메시지 필터링)", value: BOT_CONFIG.msgLogChannelId ? `<#${BOT_CONFIG.msgLogChannelId}>` : "미설정", inline: false },
                        { name: "Moderation Log (킥/밴)", value: BOT_CONFIG.modLogChannelId ? `<#${BOT_CONFIG.modLogChannelId}>` : "미설정", inline: false }
                    )
                    .setFooter({ text: "설정: !setlogchannel [ID] [action/msg/mod]" });
                
                message.reply({ embeds: [embed] });
                break;
            }

        case "!kick":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ 사용법: `!kick [@유저멘션] [사유]`");
                }
                
                if (isModerator(targetUser)) {
                    return message.reply("❌ 관리자/운영진은 킥할 수 없습니다.");
                }
                
                try {
                    await targetUser.kick(reason);
                    message.reply(`✅ ${targetUser.user.tag} 님을 킥했습니다. 사유: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'KICK', message.author, reason);
                } catch (error) {
                    console.error("Kick error:", error);
                    message.reply(`❌ 킥에 실패했습니다: ${error.message}`);
                }
                break;
            }
            
        case "!ban":
            {
                const targetUser = message.mentions.members.first();
                const reason = args.slice(2).join(" ") || "No reason specified";

                if (!targetUser) {
                    return message.reply("❌ 사용법: `!ban [@유저멘션] [사유]`");
                }

                if (isModerator(targetUser)) {
                    return message.reply("❌ 관리자/운영진은 밴할 수 없습니다.");
                }

                try {
                    await targetUser.ban({ reason: reason });
                    message.reply(`✅ ${targetUser.user.tag} 님을 밴했습니다. 사유: ${reason}`);
                    sendModLog(message.guild, targetUser.user, 'BAN', message.author, reason);
                } catch (error) {
                    console.error("Ban error:", error);
                    message.reply(`❌ 밴에 실패했습니다: ${error.message}`);
                }
                break;
            }
            
        case "!purge":
        case "!clear":
            {
                if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return message.reply("❌ 저는 메시지 관리 권한(Manage Messages)이 필요합니다.");
                }
                
                const amount = parseInt(args[1]);

                if (isNaN(amount) || amount <= 0 || amount > 100) {
                    return message.reply("❌ 사용법: `!clear [1-100 사이의 숫자]`");
                }

                try {
                    // +1을 하여 명령어 메시지 자체도 삭제합니다.
                    const deleted = await message.channel.bulkDelete(amount, true);
                    const reply = await message.channel.send(`✅ ${deleted.size}개의 메시지를 삭제했습니다.`);
                    setTimeout(() => reply.delete().catch(() => {}), 5000); // 5초 후 자동 삭제
                } catch (error) {
                    console.error("Purge error:", error);
                    message.reply("❌ 메시지 삭제에 실패했습니다. (14일 이상 된 메시지는 삭제할 수 없습니다.)");
                }
                break;
            }
            
        case "!embed":
            {
                if (!isAdmin(member)) { // 최고 관리자만 허용
                    return message.reply("❌ 이 명령어는 Admin 역할만 사용할 수 있습니다.");
                }

                const channelId = args[1];
                const type = args[2]?.toLowerCase();
                const targetChannel = message.guild.channels.cache.get(channelId);

                if (!targetChannel || !type) {
                    return message.reply("❌ 사용법: `!embed [채널ID] [rules/welcome/notification]`");
                }

                let embed;
                let components = [];

                if (type === 'rules') {
                    embed = new EmbedBuilder()
                        .setColor("#0000FF")
                        .setTitle("✅ 📜 RULES & REGULATION 📜")
                        .setDescription(
                            "**GO-SU GANG** 커뮤니티 규칙을 읽고 아래 버튼을 눌러야만 채널에 참여할 수 있습니다."
                        )
                        .setImage(RULES_BANNER_URL)
                        .setFooter({ text: "규칙을 준수하여 모두가 즐거운 GO-SU GANG이 됩시다!" });

                    components = [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("agree_rules")
                                .setLabel("✅ 규칙에 동의합니다.")
                                .setStyle(ButtonStyle.Success)
                                .setEmoji("✅")
                        ),
                    ];
                } else if (type === 'welcome') {
                    embed = new EmbedBuilder()
                        .setColor("#00FF00")
                        .setTitle("🎉 Welcome to GO-SU GANG!")
                        .setDescription("새로운 멤버가 되신 것을 환영합니다! #rules 채널에서 규칙에 동의하고 입장해 주세요.")
                        .setImage(WELCOME_BANNER_URL)
                        .setFooter({ text: "GO-SU GANG에서 즐거운 시간 보내세요!" });
                    
                    components = []; // Welcome 메시지는 보통 버튼이 없음
                } else if (type === 'notification') {
                    embed = new EmbedBuilder()
                        .setColor("#FFD700")
                        .setTitle("🔔 실시간 알림 받기")
                        .setDescription(
                            "고수님 라이브 알림을 받으려면 아래 버튼을 눌러 **Live Subscriber** 역할을 받아주세요. 알림 역할을 해제하려면 다시 버튼을 누르세요."
                        )
                        .setImage(NOTIFICATION_BANNER_URL)
                        .setFooter({ text: "알림 역할은 언제든지 추가/제거 가능합니다." });

                    components = [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("toggle_subscriber_role")
                                .setLabel("라이브 알림 역할 받기/해제")
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji("🔔")
                        ),
                    ];
                } else {
                    return message.reply("❌ 유효하지 않은 임베드 타입입니다. [rules/welcome/notification] 중 하나를 사용하세요.");
                }

                await targetChannel.send({ embeds: [embed], components: components });
                message.reply(`✅ **${type}** 임베드를 <#${channelId}> 채널에 전송했습니다.`);
                break;
            }
            
        default:
            // 알 수 없는 명령어 처리
            message.reply("❓ 알 수 없는 명령어입니다. 관리자 명령어를 확인해 주세요.");
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
                console.error("GOSU_ROLE ID가 잘못되었거나 역할이 서버에 없습니다.");
                return interaction.reply({
                    content: "⚠ 서버 설정 오류: 기본 역할을 찾을 수 없습니다.",
                    ephemeral: true,
                });
            }

            // 이미 역할을 가지고 있는지 확인
            if (member.roles.cache.has(GOSU_ROLE)) {
                return interaction.reply({
                    content: "✅ 이미 규칙에 동의하여 입장 역할이 있습니다.",
                    ephemeral: true,
                });
            }

            // 역할 부여
            await member.roles.add(gosuRole);

            interaction.reply({
                content: "🎉 규칙에 동의하셨습니다. 서버에 입장되었습니다!",
                ephemeral: true,
            });
        } else if (interaction.customId === "toggle_subscriber_role") {
            const subRole = interaction.guild.roles.cache.get(SUB_ROLE);

            if (!subRole) {
                console.error("SUB_ROLE ID가 잘못되었거나 역할이 서버에 없습니다.");
                return interaction.reply({
                    content: "⚠ 서버 설정 오류: 알림 역할을 찾을 수 없습니다.",
                    ephemeral: true,
                });
            }

            // 역할 추가/제거 토글
            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(subRole);
                return interaction.reply({
                    content: "❌ 라이브 알림 역할이 제거되었습니다. 이제 알림을 받지 않습니다.",
                    ephemeral: true,
                });
            } else {
                await member.roles.add(subRole);
                return interaction.reply({
                    content: "🔔 라이브 알림 역할이 부여되었습니다. 이제 알림을 받습니다.",
                    ephemeral: true,
                });
            }
        }
    } catch (err) {
        console.error("Button interaction error:", err);
        return interaction.reply({
            content: "⚠ 버튼 처리 중 오류가 발생했습니다. 봇의 권한을 확인해 주세요.",
            ephemeral: true,
        });
    }
});

// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);
