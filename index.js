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
} = require("discord.js");
const fs = require('fs'); // File system module

// ----------------------------------------------------
// FILE PATH CONSTANT
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
const GOSU_ROLE = process.env.GOSU_ROLE_ID || "PUT_GOSU_ROLE_ID_HERE";       // Main Gosu Role (규칙 동의 후 부여되는 기본 역할 ID)
const MOD_ROLE = process.env.MOD_ROLE_ID || "PUT_MOD_ROLE_ID_HERE";         // Moderator Role (관리 및 필터 면제 역할 ID)
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID || "PUT_ADMIN_ROLE_ID_HERE";   // Admin / Developer Role (최고 관리자 및 필터 면제 역할 ID)
const SUB_ROLE = process.env.SUB_ROLE_ID || "PUT_SUB_ROLE_ID_HERE";         // Live Notification Subscriber Role (알림 역할 ID)

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
    MOD_ROLE,
    ADMIN_ROLE,
];

// ----------------------------------------------------
// Helper: Function to save JSON file
// ----------------------------------------------------
function saveBlacklist() {
    try {
        // Convert array to JSON string and overwrite the file.
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words to ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        console.error("Error saving blacklist.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: Function to load JSON file
// ----------------------------------------------------
function loadBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, 'utf8');
        // Convert read data to lowercase and store in the global array.
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = []; // Start with an empty array if file is missing
            saveBlacklist(); // Create an empty file to prevent errors
        } else {
            console.error("Error loading blacklist.json:", err.message);
            BLACKLISTED_WORDS = [];
        }
    }
}

// Load blacklisted words when the bot starts
loadBlacklist();


// ----------------------------------------------------
// WELCOME / RULES / NOTIFICATION BANNERS (Image URLs)
// ----------------------------------------------------
const RULES_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
const WELCOME_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
const NOTIFICATION_BANNER_URL =
    "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c985f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";


// Color Roles (Role IDs must be modified)
const COLOR_ROLES = [
    {
        customId: "color_icey",
        emoji: "❄️",
        label: "~ icey azure ~",
        roleId: process.env.ICEY_AZURE_ROLE_ID || "PUT_ICEY_AZURE_ROLE_ID_HERE",
    },
    {
        customId: "color_candy",
        emoji: "🍭",
        label: "~ candy ~",
        roleId: process.env.CANDY_ROLE_ID || "PUT_CANDY_ROLE_ID_HERE",
    },
    {
        customId: "color_lilac",
        emoji: "🌸",
        label: "~ lilac ~",
        roleId: process.env.LILAC_ROLE_ID || "PUT_LILAC_ROLE_ID_HERE",
    },
    {
        customId: "color_blush",
        emoji: "❤️",
        label: "~ blush ~",
        roleId: process.env.BLUSH_ROLE_ID || "PUT_BLUSH_ROLE_ID_HERE",
    },
    {
        customId: "color_bubblegum",
        emoji: "🍥",
        label: "~ bubblegum ~",
        roleId: process.env.BUBBLEGUM_ROLE_ID || "PUT_BUBBLEGUM_ROLE_ID_HERE",
    },
    {
        customId: "color_chocolate",
        emoji: "🍫",
        label: "~ chocolate ~",
        roleId: process.env.CHOCOLATE_ROLE_ID || "PUT_CHOCOLATE_ROLE_ID_HERE",
    },
];

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
    console.log(`Bot logged in as ${client.user.tag}`);
});

// =====================================================
// PREFIX COMMANDS & CHAT FILTER (중복 선언 제거 및 로직 통합)
// =====================================================

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

// ---------------------------
// 0. COMMAND PARSING (단일 선언)
// ---------------------------
    const args = message.content.trim().split(/ +/g);
    const cmd = args[0]?.toLowerCase();
    const isCommand = cmd && cmd.startsWith("!"); // !로 시작하면 명령어
    const member = message.member; // member 변수도 여기서 선언

    
// ---------------------------
// 1. CHAT FILTER LOGIC (수정된 로직)
// ---------------------------
    // const member = message.member; // <-- 중복 제거됨

    // const args = message.content.trim().split(/ +/g); // <-- 중복 제거됨
    // const cmd = args[0]?.toLowerCase(); // <-- 중복 제거됨
    // const isCommand = cmd && cmd.startsWith("!"); // <-- 중복 제거됨
    const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId)) || isCommand;

    if (!isExempt) {
        // 1. 정규화(NFC)를 사용하여 분리된 초성/중성을 완성된 글자로 합칩니다.
        const normalizedContent = message.content.normalize('NFC').toLowerCase();

        // 2. [수정] 한글, 영어, 숫자, 그리고 '공백 문자(\s)'만 남기고 나머지는 제거합니다.
        const simplifiedContent = normalizedContent.replace(/[^가-힣a-z0-9\s]/g, '');

        let foundWord = null;

        // 블랙리스트 단어도 띄어쓰기/특수문자 제거 후 비교합니다.
        for (const word of BLACKLISTED_WORDS) {
            // 블랙리스트 단어 자체에서 공백을 포함한 특수문자를 제거합니다.
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, '');

            // 비교를 위해 메시지 내용에서 임시로 띄어쓰기를 제거한 버전을 만들어서 비교합니다.
            const contentWithoutSpaces = simplifiedContent.replace(/\s/g, '');

            // 공백이 제거된 메시지 내용과 공백이 제거된 금지어를 비교합니다.
            if (contentWithoutSpaces.includes(simplifiedWord)) {
                foundWord = word;
                break;
            }
        }

        if (foundWord) {
            // ... (메시지 삭제 및 경고 로직은 동일) ...
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
    // 2. COMMAND LOGIC
    // ---------------------------
    // (이하 명령어 로직은 이전 코드와 동일)

    if (!isCommand) return; // 명령어가 아니면 이후 로직 실행 중단

    // ---- 명령어 메시지 자체 삭제 로직 ----
    const commandsToKeepReply = ["!ban", "!kick", "!mute", "!unmute", "!addrole", "!removerole", "!listwords"];

    // Reply가 삭제되지 않는 명령어 목록에 포함되지 않은 모든 명령어의 원본 메시지는 1초 뒤에 삭제합니다.
    if (!commandsToKeepReply.includes(cmd)) {
        setTimeout(() => {
            if (!message.deleted) {
                message.delete().catch(() => {});
            }
        }, 1000);
    } else {
        // !addrole, !removerole, !ban, !kick, !mute, !unmute, !listwords 명령어는 원본 메시지를 1초 뒤에 삭제합니다.
        setTimeout(() => {
            if (!message.deleted) {
                message.delete().catch(() => {});
            }
        }, 1000);
    }
    // Reply 메시지의 삭제 여부는 각 명령어 블록에서 결정됩니다.

    // ---------------------------
    // Permission Checks
    // ---------------------------
    // Admin Only Commands
    const adminOnly = ["!setupjoin", "!color", "!welcome", "!subscriber"];
    if (adminOnly.includes(cmd)) {
        if (!isAdmin(message.member)) {
            const reply = await message.reply("⛔ Only **Admins/Developers** can use this command.");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }
    }

    // Moderator (or Admin) Commands
    const modOnly = [
        "!ban", "!kick", "!mute", "!unmute", "!prune",
        "!addrole", "!removerole",
        "!addword", "!removeword", "!listwords", "!reloadblacklist"
    ];
    if (modOnly.includes(cmd)) {
        if (!isModerator(message.member)) {
            const reply = await message.reply("⛔ Only **Moderators** can use this command.");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }
    }

    // ========== !PING ==========
    if (cmd === "!ping") {
        return message.reply("Pong!");
    }

    // =====================================================
    // BLACKLIST MANAGEMENT COMMANDS (Moderator+)
    // =====================================================

    // ========== !addword ==========
    if (cmd === "!addword") {
        const newWord = args.slice(1).join(" ").toLowerCase().trim();
        if (!newWord) {
            const reply = await message.reply("Usage: `!addword [word]`");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        if (BLACKLISTED_WORDS.includes(newWord)) {
            const reply = await message.reply(`⚠ **${newWord}** is already in the blacklist.`);
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        BLACKLISTED_WORDS.push(newWord);
        saveBlacklist(); // Save to file
        const reply = await message.reply(`✅ Added **${newWord}** to the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // ========== !removeword ==========
    if (cmd === "!removeword") {
        const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
        if (!wordToRemove) {
            const reply = await message.reply("Usage: `!removeword [word]`");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        const initialLength = BLACKLISTED_WORDS.length;
        // Create a new array excluding the word
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== wordToRemove);

        if (BLACKLISTED_WORDS.length === initialLength) {
            const reply = await message.reply(`⚠ **${wordToRemove}** was not found in the blacklist.`);
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        saveBlacklist(); // Save to file
        const reply = await message.reply(`✅ Removed **${wordToRemove}** from the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // ========== !listwords ==========
    if (cmd === "!listwords") {
        const listEmbed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle(`🚫 Current Blacklisted Words (${BLACKLISTED_WORDS.length} total)`)
            .setDescription(
                BLACKLISTED_WORDS.length > 0
                    ? BLACKLISTED_WORDS.slice(0, 50).join(", ") + (BLACKLISTED_WORDS.length > 50 ? "..." : "")
                    : "No words currently blacklisted."
            )
            .setFooter({ text: "Showing the first 50 words." });

        return message.reply({ embeds: [listEmbed] });
    }

    // ========== !reloadblacklist (Reload from file) ==========
    if (cmd === "!reloadblacklist") {
        loadBlacklist();
        const reply = await message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }


    // =====================================================
    // PANEL SETUP COMMANDS (Admin Only)
    // =====================================================

    // ========== !setupjoin (Rules Panel) ==========
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

        // Create the 'Agree To Rules' button
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("agree_rules") // Button interaction ID
                .setLabel("Agree To Rules")
                .setStyle(ButtonStyle.Success)
        );

        // Step 1: Send the MUST READ image banner as an attachment first
        await message.channel.send({
            files: [{ attachment: RULES_BANNER_URL, name: 'must_read.png' }]
        });

        // Step 2: Send the embed and button.
        await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
        return;
    }
    // ========== !setupjoin (Rules Panel) End ==========

    // ========== !welcome (Welcome Panel) ==========
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
                    value: "📺 [YouTube](https://youtube.com/@Teamgosu)\n🟣 [Twitch](https://www.twitch.tv/gosugeneraltv)",
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

        // Step 1: Send the WELCOME banner image as an attachment first
        await message.channel.send({
            files: [{ attachment: WELCOME_BANNER_URL, name: 'welcome.png' }]
        });

        // Step 2: Send the embed and buttons after the image.
        await message.channel.send({ embeds: [welcomeEmbed], components: [buttons] });
        return;
    }

    // ========== !color (Color Role Panel) ==========
    if (cmd === "!color") {
        const colorEmbed = new EmbedBuilder()
            .setColor("#FFAACD")
            .setTitle("Color 3 Roles")
            .setDescription(
                [
                    "Choose one of the **Color 3** roles below.",
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
    // Permission: Admin/Developer Only
    if (cmd === "!subscriber") {
        const subEmbed = new EmbedBuilder()
            .setColor("#FFCC33")
            .setTitle("📺 Gosu General TV — Live Notifications")
            .setDescription(
                [
                    "If you’d like to receive alerts when **Gosu General TV** goes live or posts important announcements,",
                    "press `Subscribe / Unsubscribe` to get or remove the **Live Notifications** role.",
                    "",
                    "Note: Subscribing will temporarily replace your **Gosu** role. Press the button again to return to the Gosu role.",
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

        // Step 1: Send the DON'T MISS banner image as an attachment first
        await message.channel.send({
            files: [{ attachment: NOTIFICATION_BANNER_URL, name: 'notification_banner.png' }]
        });

        // Step 2: Send the embed message and button.
        await message.channel.send({ embeds: [subEmbed], components: [row] });
        return;
    }

    // =====================================================
    // MODERATION COMMANDS (Moderator+)
    // =====================================================

    // ========== !ban ==========
    if (cmd === "!ban") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply("Usage: `!ban @user [reason]`");
            return; // Reply stays
        }

        const reason = args.slice(2).join(" ") || "No reason provided";
        try {
            await user.ban({ reason });
            const reply = await message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
            return; // Reply stays
        } catch (err) {
            console.error("Ban error:", err);
            const reply = await message.reply("⚠ Failed to ban that user.");
            return; // Reply stays
        }
    }

    // ========== !kick ==========
    if (cmd === "!kick") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply("Usage: `!kick @user [reason]`");
            return; // Reply stays
        }

        const reason = args.slice(2).join(" ") || "No reason provided";
        try {
            await user.kick(reason);
            const reply = await message.reply(`👢 Kicked **${user.user.tag}**. Reason: ${reason}`);
            return; // Reply stays
        } catch (err) {
            console.error("Kick error:", err);
            const reply = await message.reply("⚠ Failed to kick that user.");
            return; // Reply stays
        }
    }

    // ========== !mute ==========
    if (cmd === "!mute") {
        const user = message.mentions.members?.first();
        const minutes = parseInt(args[2]) || 10;
        if (!user) {
            const reply = await message.reply("Usage: `!mute @user [minutes]`");
            return; // Reply stays
        }

        try {
            await user.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
            const reply = await message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
            return; // Reply stays
        } catch (err) {
            console.error("Mute error:", err);
            const reply = await message.reply("⚠ Failed to mute that user.");
            return; // Reply stays
        }
    }

    // ========== !unmute ==========
    if (cmd === "!unmute") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply("Usage: `!unmute @user`");
            return; // Reply stays
        }

        try {
            await user.timeout(null, `Unmuted by ${message.author.tag}`);
            const reply = await message.reply(`🔊 Unmuted **${user.user.tag}**.`);
            return; // Reply stays
        } catch (err) {
            console.error("Unmute error:", err);
            const reply = await message.reply("⚠ Failed to unmute that user.");
            return; // Reply stays
        }
    }

    // ========== !prune (Clear Messages) ==========
    if (cmd === "!prune") {
        const amount = parseInt(args[1]);
        if (!amount || amount < 1 || amount > 100) {
            const reply = await message.reply("Usage: `!prune 1-100`");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        try {
            await message.channel.bulkDelete(amount, true);
            const m = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
            setTimeout(() => m.delete().catch(() => {}), 1000); // Only the notification is deleted
        } catch (err) {
            console.error("Prune error:", err);
            const reply = await message.reply("⚠ Could not delete messages (maybe older than 14 days).");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }
    }

    // ========== !addrole ==========
    if (cmd === "!addrole") {
        const target = message.mentions.members?.first();
        if (!target) {
            const reply = await message.reply("Usage: `!addrole @user RoleName`");
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            const reply = await message.reply("Please provide a role name.");
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            const reply = await message.reply(`⚠ Could not find a role named **${roleName}**.`);
            return;
        }

        try {
            await target.roles.add(role);
            const reply = await message.reply(`✅ Added role **${role.name}** to **${target.user.tag}**.`);
            return;
        } catch (err) {
            console.error("Add role error:", err);
            const reply = await message.reply("⚠ Failed to add that role.");
            return;
        }
    }

    // ========== !removerole ==========
    if (cmd === "!removerole") {
        const target = message.mentions.members?.first();
        if (!target) {
            const reply = await message.reply("Usage: `!removerole @user RoleName`");
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            const reply = await message.reply("Please provide a role name.");
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            const reply = await message.reply(`⚠ Could not find a role named **${roleName}**.`);
            return;
        }

        if (!target.roles.cache.has(role.id)) {
            const reply = await message.reply(
                `⚠ **${target.user.tag}** does not currently have the **${role.name}** role.`
            );
            return;
        }

        try {
            await target.roles.remove(role);
            const reply = await message.reply(`❎ Removed role **${role.name}** from **${target.user.tag}**.`);
            return;
        } catch (err) {
            console.error("Remove role error:", err);
            const reply = await message.reply("⚠ Failed to remove that role.");
            return;
        }
    }

    // =====================================================
    // INVITE + HELP
    // =====================================================

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
                    "`!ping` — Check if the bot is online. (Reply deletes after 1s)",
                    "`!invite` — Show the server invite link. (Reply deletes after 1s)",
                    "",
                    "**Moderation / Filter Management (Moderator+)**",
                    "`!ban @user [reason]` — Ban a user. (Reply stays)",
                    "`!kick @user [reason]` — Kick a user. (Reply stays)",
                    "`!mute @user [minutes]` — Timeout a user. (Reply stays)",
                    "`!unmute @user` — Remove timeout. (Reply stays)",
                    "`!addrole @user RoleName` — Add a role. (Reply stays)",
                    "`!removerole @user RoleName` — Remove a role. (Reply stays)",
                    "`!prune [1-100]` — Delete recent messages. (Reply deletes after 1s)",
                    "`!addword [word]` — Add a word to the filter list. (Reply deletes after 1s)",
                    "`!removeword [word]` — Remove a word from the filter list. (Reply deletes after 1s)",
                    "`!listwords` — Show the current blacklisted words. (Reply stays)",
                    "`!reloadblacklist` — Reload the filter words from the JSON file. (Reply deletes after 1s)",
                    "",
                    "**Admin / Developer**",
                    "`!setupjoin` — Create the rules panel. (Reply deletes after 1s)",
                    "`!welcome` — Create the main welcome panel. (Reply deletes after 1s)",
                    "`!subscriber` — Create the live notification panel. (Reply deletes after 1s)",
                    "`!color` — Create the Color 3 role panel. (Reply deletes after 1s)",

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

    // -------- Agree To Rules --------
    if (customId === "agree_rules") {
        const role = guild.roles.cache.get(GOSU_ROLE);
        if (!role) {
            return interaction.reply({
                content: "⚠ Member role is not configured correctly. Please contact staff.",
                ephemeral: true,
            });
        }

        if (member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: "You already have access. Enjoy the server!",
                ephemeral: true,
            });
        }

        try {
            await member.roles.add(role);
            return interaction.reply({
                content: `✅ You accepted the rules and received the **${role.name}** role. Welcome!`,
                ephemeral: true,
            });
        } catch (err) {
            console.error("Agree rules error:", err);
            return interaction.reply({
                content: "⚠ Failed to assign the role. Please contact staff.",
                ephemeral: true,
            });
        }
    }

    // -------- Subscribe / Unsubscribe Toggle Button (Mutually Exclusive Logic) --------
    if (customId === "sub_subscribe") {
        const gosuRole = guild.roles.cache.get(GOSU_ROLE);
        const subRole = guild.roles.cache.get(SUB_ROLE);

        if (!gosuRole || !subRole) {
            return interaction.reply({
                content: "⚠ Subscriber or Member role is not configured correctly. Please contact staff.",
                ephemeral: true,
            });
        }
        
        try {
            if (member.roles.cache.has(subRole.id)) {
                // 현재 SUB_ROLE을 가지고 있으면 -> 제거하고 GOSU_ROLE을 부여 (구독 취소)
                await member.roles.remove(subRole);
                await member.roles.add(gosuRole); // 기본 역할 복구

                return interaction.reply({
                    content: `🔔 You have **Unsubscribed** from live notifications. Your role is now **${gosuRole.name}**.`,
                    ephemeral: true,
                });
            } else {
                // SUB_ROLE이 없으면 -> 부여하고 GOSU_ROLE을 제거 (구독)
                if (member.roles.cache.has(gosuRole.id)) {
                    await member.roles.remove(gosuRole); // 기본 역할 제거
                }
                await member.roles.add(subRole); // 알림 역할 부여

                return interaction.reply({
                    content: `✅ You have **Subscribed** to live notifications. Your role is now **${subRole.name}**.`,
                    ephemeral: true,
                });
            }
        } catch (err) {
            console.error("Subscription toggle error:", err);
            return interaction.reply({
                content: "⚠ Failed to update your role. Please ensure bot has necessary permissions.",
                ephemeral: true,
            });
        }
    }

    // -------- Color Role Buttons (Mutually Exclusive Logic) --------
    const colorRoleData = COLOR_ROLES.find(c => c.customId === customId);
    if (colorRoleData) {
        const targetRoleId = colorRoleData.roleId;
        const targetRole = guild.roles.cache.get(targetRoleId);
        
        if (!targetRole) {
            return interaction.reply({
                content: "⚠ Color role is not configured correctly. Please contact staff.",
                ephemeral: true,
            });
        }

        try {
            // 현재 가지고 있는 모든 Color Roles을 찾습니다.
            const allColorRoleIds = COLOR_ROLES.map(c => c.roleId);
            const currentRoleIds = member.roles.cache.filter(role => allColorRoleIds.includes(role.id)).map(role => role.id);
            
            if (member.roles.cache.has(targetRoleId)) {
                // 이미 가지고 있으면 -> 제거
                await member.roles.remove(targetRole);
                return interaction.reply({
                    content: `❌ Removed the **${targetRole.name}** color role.`,
                    ephemeral: true,
                });
            } else {
                // 가지고 있지 않으면 -> 기존 색상 역할들 제거 후 새 역할 부여
                if (currentRoleIds.length > 0) {
                    await member.roles.remove(currentRoleIds);
                }
                await member.roles.add(targetRole);
                return interaction.reply({
                    content: `🎨 Assigned the **${targetRole.name}** color role!`,
                    ephemeral: true,
                });
            }
        } catch (err) {
            console.error("Color role error:", err);
            return interaction.reply({
                content: "⚠ Failed to update your color role. Please ensure bot has necessary permissions.",
                ephemeral: true,
            });
        }
    }
});
// =====================================================
// BOT LOGIN
// =====================================================
client.login(process.env.Bot_Token);


