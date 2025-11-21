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

// ----------------------------------------------------
// ROLE IDs (❗ MUST BE MODIFIED for your Server IDs ❗)
// ----------------------------------------------------
const GOSU_ROLE = process.env.GOSU_ROLE_ID || "PUT_GOSU_ROLE_ID_HERE";
const MOD_ROLE  = process.env.MOD_ROLE_ID  || "PUT_MOD_ROLE_ID_HERE";
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID || "PUT_ADMIN_ROLE_ID_HERE";
const SUB_ROLE  = process.env.SUB_ROLE_ID    || "PUT_SUB_ROLE_ID_HERE";

// ----------------------------------------------------
// VOICE CHANNEL CREATOR CONFIG (✅ MODIFIED)
// ----------------------------------------------------
// 두 채널 ID를 배열로 설정합니다. 이 중 하나에 입장 시 채널이 생성됩니다.
const CREATE_CHANNEL_IDS = [
    "720658789832851487",
    "1441159364298936340"
];
// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
    ADMIN_ROLE,
];

// ----------------------------------------------------
// Helper: Function to save JSON file
// ----------------------------------------------------
function saveBlacklist() {
    try {
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
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = [];
            saveBlacklist();
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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.VoiceStates,
    ],
    partials: [Partials.Channel],
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
// VOICE CHANNEL CREATOR (VO 채널 생성/삭제 로직)
// =====================================================
client.on("voiceStateUpdate", async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    // -------------------------------------
    // 1. 임시 채널 생성 로직 (Join)
    // -------------------------------------
    // 사용자가 CREATE_CHANNEL_IDS 중 하나에 입장했을 때
    if (newState.channelId && CREATE_CHANNEL_IDS.includes(newState.channelId)) {
        const member = newState.member;
        const createChannel = newState.channel;
        const category = createChannel.parent;

        if (!member || !category) return;

        // 봇이 채널 생성 및 이동 권한이 있는지 확인
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
            console.error("Bot lacks 'Manage Channels' or 'Move Members' permission for VO Creator.");
            return;
        }

        try {
            const newChannelName = `🎧 ${member.user.username}'s VO`;

            // 새 임시 음성 채널 생성
            const newChannel = await guild.channels.create({
                name: newChannelName,
                type: ChannelType.GuildVoice,
                parent: category,
                userLimit: 5,

                // ✅ ADDED: 생성자에게 권한을 부여합니다.
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone
                        allow: [PermissionsBitField.Flags.Connect], // 기본적으로 연결 허용
                        deny: [PermissionsBitField.Flags.ManageChannels], // 채널 수정은 금지
                    },
                    {
                        id: member.id, // 채널 생성자
                        allow: [
                            PermissionsBitField.Flags.ManageChannels, // 채널 이름, 인원 제한 등 수정 권한
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers,
                        ],
                    },
                ],
            });
            
            // 생성된 채널로 사용자 이동
            await member.voice.setChannel(newChannel);
            console.log(`Created and moved ${member.user.tag} to temporary VO channel: ${newChannel.name}`);
        } catch (error) {
            console.error("Failed to create or move user to temporary VO channel:", error);
        }
    }

    // -------------------------------------
    // 2. 임시 채널 삭제 로직 (Leave)
    // -------------------------------------
    // 사용자가 채널을 떠났을 때
    if (oldState.channelId && !CREATE_CHANNEL_IDS.includes(oldState.channelId)) {
        const oldChannel = oldState.channel;
        if (!oldChannel) return;

        // oldChannel이 임시 채널로 간주되는지 확인 (이름 패턴 또는 멤버 수 0 확인)
        const isTemporaryChannel = oldChannel.name.includes("'s VO") || oldChannel.name.toLowerCase().endsWith('vo');

        if (isTemporaryChannel && oldChannel.members.size === 0) {
            // 채널이 비어 있고, 임시 채널 패턴을 따를 경우 삭제
            try {
                await oldChannel.delete();
                console.log(`Successfully deleted empty temporary VO channel: ${oldChannel.name}`);
            } catch (error) {
                console.error("Failed to delete empty temporary VO channel:", error);
            }
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

    // ---------------------------
    // 1. CHAT FILTER LOGIC
    // ---------------------------
    const member = message.member;

    const isExempt =
        FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId)) || isCommand;

    if (!isExempt) {
        // 1. 한글 정규화 + 소문자
        const normalizedContent = message.content.normalize('NFC').toLowerCase();

        // 2. 한글/영어/숫자/공백만 남김 (띄어쓰기 유지)
        const simplifiedContent = normalizedContent.replace(/[^가-힣a-z0-9\s]/g, '');

        let foundWord = null;

        for (const word of BLACKLISTED_WORDS) {
            const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, '');

            // 이모지/특수문자만 있는 금지어는 ""가 되므로 스킵
            if (!simplifiedWord) continue;

            const contentWithoutSpaces = simplifiedContent.replace(/\s/g, '');

            if (contentWithoutSpaces.includes(simplifiedWord)) {
                foundWord = word;
                break;
            }
        }

        if (foundWord) {
            if (message.guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                if (!message.deleted) {
                    message.delete().catch(err => {
                        console.error(`Failed to delete message: ${message.id}`, err);
                    });
                }
            } else {
                console.error("Bot lacks 'Manage Messages' permission to delete filtered messages.");
            }

            const warningMessage = await message.channel.send(
                `**${member}** Watch your language! Your message contained a blacklisted word and has been removed.`
            );
            setTimeout(() => warningMessage.delete().catch(() => {}), 7000);
            return;
        }
    }

    // ---------------------------
    // 2. COMMAND LOGIC
    // ---------------------------
    if (!isCommand) return; // 명령어 아니면 여기서 끝

    // 원본 명령 메시지는 1초 뒤 삭제
    setTimeout(() => {
        if (!message.deleted) {
            message.delete().catch(() => {});
        }
    }, 1000);

    // ---------------------------
    // Permission Checks
    // ---------------------------
    const adminOnly = ["!setupjoin", "!color", "!welcome", "!subscriber"];
    if (adminOnly.includes(cmd)) {
        if (!isAdmin(message.member)) {
            const reply = await message.reply("⛔ Only **Admins/Developers** can use this command.");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }
    }

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
        const reply = await message.reply("Pong!");
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // =====================================================
    // BLACKLIST MANAGEMENT COMMANDS (Moderator+)
    // =====================================================
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
        saveBlacklist();
        const reply = await message.reply(`✅ Added **${newWord}** to the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    if (cmd === "!removeword") {
        const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
        if (!wordToRemove) {
            const reply = await message.reply("Usage: `!removeword [word]`");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        const initialLength = BLACKLISTED_WORDS.length;
        BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== wordToRemove);

        if (BLACKLISTED_WORDS.length === initialLength) {
            const reply = await message.reply(`⚠ **${wordToRemove}** was not found in the blacklist.`);
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }

        saveBlacklist();
        const reply = await message.reply(`✅ Removed **${wordToRemove}** from the blacklist. (${BLACKLISTED_WORDS.length} total)`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

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

    if (cmd === "!reloadblacklist") {
        loadBlacklist();
        const reply = await message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

    // =====================================================
    // PANEL SETUP COMMANDS (Admin Only)
    // =====================================================
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
            files: [{ attachment: RULES_BANNER_URL, name: 'must_read.png' }]
        });

        await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
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

        await message.channel.send({
            files: [{ attachment: WELCOME_BANNER_URL, name: 'welcome.png' }]
        });

        await message.channel.send({ embeds: [welcomeEmbed], components: [buttons] });
        return;
    }

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

        await message.channel.send({
            files: [{ attachment: NOTIFICATION_BANNER_URL, name: 'notification_banner.png' }]
        });

        await message.channel.send({ embeds: [subEmbed], components: [row] });
        return;
    }

    // =====================================================
    // MODERATION COMMANDS (Moderator+)
    // =====================================================
    if (cmd === "!ban") {
        const user = message.mentions.members?.first();
        if (!user) {
            const reply = await message.reply("Usage: `!ban @user [reason]`");
            return;
        }

        const reason = args.slice(2).join(" ") || "No reason provided";
        try {
            await user.ban({ reason });
            await message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
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
            const reply = await message.reply("Usage: `!kick @user [reason]`");
            return;
        }

        const reason = args.slice(2).join(" ") || "No reason provided";
        try {
            await user.kick(reason);
            await message.reply(`👢 Kicked **${user.user.tag}**. Reason: ${reason}`);
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
            const reply = await message.reply("Usage: `!mute @user [minutes]`");
            return;
        }

        try {
            await user.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
            await message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
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
            const m = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
            setTimeout(() => m.delete().catch(() => {}), 1000);
        } catch (err) {
            console.error("Prune error:", err);
            const reply = await message.reply("⚠ Could not delete messages (maybe older than 14 days).");
            setTimeout(() => reply.delete().catch(() => {}), 1000);
            return;
        }
    }

    if (cmd === "!addrole") {
        const target = message.mentions.members?.first();
        if (!target) {
            await message.reply("Usage: `!addrole @user RoleName`");
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            await message.reply("Please provide a role name.");
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            await message.reply(`⚠ Could not find a role named **${roleName}**.`);
            return;
        }

        try {
            await target.roles.add(role);
            await message.reply(`✅ Added role **${role.name}** to **${target.user.tag}**.`);
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
            await message.reply("Usage: `!removerole @user RoleName`");
            return;
        }

        const roleName = args.slice(2).join(" ");
        if (!roleName) {
            await message.reply("Please provide a role name.");
            return;
        }

        const role = message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            await message.reply(`⚠ Could not find a role named **${roleName}**.`);
            return;
        }

        if (!target.roles.cache.has(role.id)) {
            await message.reply(
                `⚠ **${target.user.tag}** does not currently have the **${role.name}** role.`
            );
            return;
        }

        try {
            await target.roles.remove(role);
            await message.reply(`❎ Removed role **${role.name}** from **${target.user.tag}**.`);
            return;
        } catch (err) {
            console.error("Remove role error:", err);
            await message.reply("⚠ Failed to remove that role.");
            return;
        }
    }

    // =====================================================
    // INVITE + HELP
    // =====================================================
    if (cmd === "!invite") {
        const reply = await message.reply("📨 **Server Invite:** https://discord.gg/gosugeneral");
        setTimeout(() => reply.delete().catch(() => {}), 1000);
        return;
    }

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

    if (customId === "sub_subscribe") {
        const subRole = guild.roles.cache.get(SUB_ROLE);
        const gosuRole = guild.roles.cache.get(GOSU_ROLE);

        if (!subRole || !gosuRole) {
            return interaction.reply({
                content: "⚠ Subscription or Gosu role is not configured correctly. Please contact staff.",
                ephemeral: true,
            });
        }

        try {
            if (member.roles.cache.has(SUB_ROLE)) {
                await member.roles.remove(subRole);
                await member.roles.add(gosuRole);
                return interaction.reply({
                    content: `🔕 Live notifications **unsubscribed**. Your role has been reset to **${gosuRole.name}**.`,
                    ephemeral: true,
                });
            } else {
                if (member.roles.cache.has(GOSU_ROLE)) {
                    await member.roles.remove(gosuRole);
                }
                await member.roles.add(subRole);

                return interaction.reply({
                    content: `✅ You are now **subscribed** to Live Notifications. Your **${gosuRole.name}** role has been replaced.`,
                    ephemeral: true,
                });
            }
        } catch (err) {
            console.error("Subscribe toggle error:", err);
            return interaction.reply({
                content: "⚠ Failed to update your roles. Please contact staff.",
                ephemeral: true,
            });
        }
    }

    const colorConfig = COLOR_ROLES.find((c) => c.customId === customId);
    if (colorConfig) {
        const role = guild.roles.cache.get(colorConfig.roleId);
        if (!role) {
            return interaction.reply({
                content: "⚠ The color role for this button is not configured. Please contact staff.",
                ephemeral: true,
            });
        }

        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                content: "⚠ I do not have permission to **Manage Roles**.",
                ephemeral: true,
            });
        }

        try {
            const colorRoleIds = COLOR_ROLES.map((c) => c.roleId);
            const toRemove = member.roles.cache.filter((r) => colorRoleIds.includes(r.id));

            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                return interaction.reply({
                    content: `Removed color role **${role.name}**.`,
                    ephemeral: true,
                });
            }

            if (toRemove.size > 0) {
                await member.roles.remove(toRemove);
            }

            await member.roles.add(role);
            return interaction.reply({
                content: `You now have the color role **${role.name}**.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error("Color role error:", err);
            return interaction.reply({
                content: "⚠ Failed to update your color role. Please contact staff.",
                ephemeral: true,
            });
        }
    }
});

// --------------------
// Log in
// --------------------
client.login(process.env.Bot_Token);

