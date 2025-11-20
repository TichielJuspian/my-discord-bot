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

// ---------------------------
// CHAT FILTER CONFIG
// ---------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

// 🔥 관리자/모더레이터만 필터 우회
const FILTER_EXEMPT_ROLES = [
    ADMIN_ROLE,
    MOD_ROLE,
];

// =====================================================
// HELPER FUNCTIONS (파일 관리 및 권한)
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
        // 로드 시 금지어는 미리 특수문자를 제거한 형태를 저장하여 검색 속도를 높입니다.
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase().replace(/[^가-힣a-z0-9]/g, ''));
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
        GatewayIntentBits.MessageContent, // ❗ 명령어 및 필터 작동에 필수
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
    // 1. CHAT FILTER LOGIC (수정된 로직)
    // ---------------------------
    if (!isExempt) {
        const normalizedContent = message.content.normalize('NFC').toLowerCase();
        // 메시지 내용을 띄어쓰기 단위로 분리하고, 각 단어에서 특수 문자 제거
        const contentWords = normalizedContent
            .split(/\s+/) // 띄어쓰기로 분리
            .filter(w => w.length > 0) // 빈 문자열 제거
            .map(word => word.replace(/[^가-힣a-z0-9]/g, '')); // 특수 문자 제거

        let foundWord = null;

        for (const contentWord of contentWords) {
            // contentWord가 BLACKLISTED_WORDS (이미 특수 문자 제거된) 에 포함되는지 확인
            if (BLACKLISTED_WORDS.includes(contentWord)) {
                foundWord = contentWord; // 금지어 발견
                break;
            }
        }

        if (foundWord) {
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
    const adminOnly = ["!setupjoin", "!color", "!welcome", "!subscriber"];
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
        "!setupjoin", "!color", "!welcome", "!subscriber"
    ];

    if (commandsToDeleteOriginal.includes(cmd)) {
        setTimeout(() => {
            if (!message.deleted) {
                message.delete().catch(() => {});
            }
        }, 1000); 
    }
    
    // ---------------------------
    // MODERATION COMMANDS (Moderator+)
    // ---------------------------
    
    // ========== !addword ==========
    if (cmd === "!addword") {
        const newWord = args.slice(1).join(" ").toLowerCase().trim();
        const simplifiedNewWord = newWord.replace(/[^가-힣a-z0-9]/g, ''); // 추가할 때 특수 문자 제거

        if (!simplifiedNewWord) {
            const reply = await message.reply("Usage: `!addword [word]` (단어에 유효한 문자열이 포함되어야 합니다)");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        if (BLACKLISTED_WORDS.includes(simplifiedNewWord)) {
            const reply = await message.reply(`⚠ **${newWord}** (Simplified: **${simplifiedNewWord}**) is already in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        BLACKLISTED_WORDS.push(simplifiedNewWord);
        saveBlacklist(); 
        const reply = await message.reply(`✅ Added **${newWord}** (Simplified: **${simplifiedNewWord}**) to the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }

    // ========== !removeword ==========
    if (cmd === "!removeword") {
        const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
        const simplifiedWordToRemove = wordToRemove.replace(/[^가-힣a-z0-9]/g, ''); // 제거할 때 특수 문자 제거

        if (!simplifiedWordToRemove) {
            const reply = await message.reply("Usage: `!removeword [word]`");
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        const initialLength = BLACKLISTED_WORDS.length;
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== simplifiedWordToRemove);
        
        if (BLACKLISTED_WORDS.length === initialLength) {
            const reply = await message.reply(`⚠ **${wordToRemove}** (Simplified: **${simplifiedWordToRemove}**) was not found in the blacklist.`);
            return setTimeout(() => reply.delete().catch(() => {}), 1000);
        }

        saveBlacklist(); 
        const reply = await message.reply(`✅ Removed **${wordToRemove}** (Simplified: **${simplifiedWordToRemove}**) from the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        return setTimeout(() => reply.delete().catch(() => {}), 1000);
    }
    
    // ========== !listwords ==========
    if (cmd === "!listwords") {
        const words = BLACKLISTED_WORDS.length > 0 ? BLACKLISTED_WORDS.join(', ') : "The blacklist is empty.";
        const listEmbed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle(`🚫 Current Blacklisted Words (${BLACKLISTED_WORDS.length} total)`)
            .setDescription("Words are stored in their simplified (special characters removed) form:\n" + words.substring(0, 4096));
        await message.reply({ embeds: [listEmbed] });
        return;
    }
    
    // ========== !reloadblacklist ==========
    if (cmd === "!reloadblacklist") {
        loadBlacklist(); 
        const reply = await message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** simplified blacklisted words from blacklist.json.`);
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
    
    const RULES_BANNER_URL = "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0c9408dd8f99cb7eee8de4336122f67d4&";
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
                    "**Admin / Panel Setup (Admin+)**",
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


// --------------------
// Login
// --------------------
client.login(process.env.BOT_TOKEN);
