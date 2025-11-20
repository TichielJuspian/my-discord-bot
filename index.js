// ===============================
// Gosu Custom Discord Bot (Final Build - All Features Merged)
// Discord.js v14
// ===================================

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
const fs = require('fs'); // 파일 시스템 모듈

// ----------------------------------------------------
// FILE PATH CONSTANT
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';

// ----------------------------------------------------
// ROLE IDs (❗ 서버 ID에 맞게 수정 필수 ❗)
// ----------------------------------------------------
const GOSU_ROLE = "496717793388134410";      // 기본 Gosu 입장 롤 (Agree To Rules)
const MOD_ROLE = "495727371140202506";       // Moderator
const ADMIN_ROLE = "495718851288236032";     // Admin / Developer
const SUB_ROLE = "497654614729031681";       // Live 알림 구독 롤

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // 전역 금지어 배열

const FILTER_EXEMPT_ROLES = [
  MOD_ROLE, 
  ADMIN_ROLE, 
];

// ----------------------------------------------------
// Helper: JSON 파일 저장 함수 (배열 변경 시 자동 호출)
// ----------------------------------------------------
function saveBlacklist() {
    try {
        // 배열을 JSON 문자열로 변환하고 파일에 덮어씁니다.
        const jsonString = JSON.stringify(BLACKLISTED_WORDS, null, 2);
        fs.writeFileSync(BLACKLIST_FILE_PATH, jsonString, 'utf8');
        console.log(`Successfully saved ${BLACKLISTED_WORDS.length} blacklisted words to ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        console.error("Error saving blacklist.json:", err.message);
    }
}

// ----------------------------------------------------
// Helper: JSON 파일 읽기 함수 (봇 시작, 리로드 명령 시 호출)
// ----------------------------------------------------
function loadBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE_PATH, 'utf8');
        // 읽어온 데이터를 소문자로 변환하여 전역 배열에 저장합니다.
        BLACKLISTED_WORDS = JSON.parse(data).map(word => String(word).toLowerCase());
        console.log(`Loaded ${BLACKLISTED_WORDS.length} blacklisted words from ${BLACKLIST_FILE_PATH}.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: ${BLACKLIST_FILE_PATH} file not found. Creating a new one.`);
            BLACKLISTED_WORDS = []; // 파일이 없으면 빈 배열로 시작
            saveBlacklist(); // 빈 파일을 생성하여 에러 방지
        } else {
            console.error("Error loading blacklist.json:", err.message);
            BLACKLISTED_WORDS = [];
        }
    }
}

// 봇 시작 시 금지어 로드
loadBlacklist();


// ----------------------------------------------------
// WELCOME / RULES / NOTIFICATION BANNERS
// ----------------------------------------------------
const RULES_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
const WELCOME_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
const NOTIFICATION_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c985f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";


// 컬러 역할들 (역할 ID 수정 필요)
const COLOR_ROLES = [
  {
    customId: "color_icey",
    emoji: "❄️",
    label: "~ icey azure ~",
    roleId: "PUT_ICEY_AZURE_ROLE_ID_HERE",
  },
  {
    customId: "color_candy",
    emoji: "🍭",
    label: "~ candy ~",
    roleId: "PUT_CANDY_ROLE_ID_HERE",
  },
  {
    customId: "color_lilac",
    emoji: "🌸",
    label: "~ lilac ~",
    roleId: "PUT_LILAC_ROLE_ID_HERE",
  },
  {
    customId: "color_blush",
    emoji: "❤️",
    label: "~ blush ~",
    roleId: "PUT_BLUSH_ROLE_ID_HERE",
  },
  {
    customId: "color_bubblegum",
    emoji: "🍥",
    label: "~ bubblegum ~",
    roleId: "PUT_BUBBLEGUM_ROLE_ID_HERE",
  },
  {
    customId: "color_chocolate",
    emoji: "🍫",
    label: "~ chocolate ~",
    roleId: "PUT_CHOCOLATE_ROLE_ID_HERE",
  },
];

// --------------------
// Client
// --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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
// Bot Ready
// --------------------
client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// =====================================================
// PREFIX COMMANDS & CHAT FILTER
// =====================================================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ---------------------------
  // 1. CHAT FILTER LOGIC (가장 먼저 실행)
  // ---------------------------
  const content = message.content.toLowerCase();
  const member = message.member;

  // 필터 면제 역할 확인 (관리자/모더레이터는 필터 무시)
  const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

  if (!isExempt) {
    // 메시지 내용을 소문자로 변환하여 금지어 리스트와 비교
    const foundWord = BLACKLISTED_WORDS.find(word => content.includes(word));

    if (foundWord) {
      // 메시지 삭제
      if (!message.deleted) {
        message.delete().catch(() => {
          console.error(`Failed to delete message: ${message.id}`);
        });
      }

      // 사용자에게 경고 메시지 전송 (3초 후 삭제)
      const warningMessage = await message.channel.send(
        `🚫 ${member} **Watch your language!** The word (**${foundWord}**) is not allowed here.`
      );
      setTimeout(() => warningMessage.delete().catch(() => {}), 3000);

      // 금지어 발견 시 이후의 다른 명령어 처리를 중단하고 리턴
      return; 
    }
  }
  
  // ---------------------------
  // 2. COMMAND LOGIC (필터 통과 후 실행)
  // ---------------------------
  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();

  // ---- 모든 !명령어는 1초 후 자동 삭제 ----
  if (cmd && cmd.startsWith("!")) {
    setTimeout(() => {
      if (!message.deleted) {
        message.delete().catch(() => {});
      }
    }, 1000);
  }

  // ---------------------------
  // Permission Checks (권한 수정 완료)
  // ---------------------------
  // !subscriber가 Admin Only로 이동했습니다.
  const adminOnly = ["!setupjoin", "!color", "!welcome", "!reloadblacklist", "!addword", "!removeword", "!listwords", "!subscriber"]; 
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      return message.reply("⛔ Only **Admins/Developers** can use this command.");
    }
  }

  const modOnly = [
    "!ban", "!kick", "!mute", "!unmute", "!prune", 
    "!addrole", "!removerole", 
  ];
  if (modOnly.includes(cmd)) {
    if (!isModerator(message.member)) {
      return message.reply("⛔ Only **Moderators** can use this command.");
    }
  }

  // ========== !PING ==========
  if (cmd === "!ping") {
    return message.reply("Pong!");
  }
  
  // =====================================================
  // BLACKLIST MANAGEMENT COMMANDS (Admin Only)
  // =====================================================

  // ========== !addword ==========
  if (cmd === "!addword") {
    const newWord = args.slice(1).join(" ").toLowerCase().trim();
    if (!newWord) return message.reply("Usage: `!addword [단어]`");

    if (BLACKLISTED_WORDS.includes(newWord)) {
      return message.reply(`⚠ **${newWord}** (은)는 이미 금지어 목록에 있습니다.`);
    }

    BLACKLISTED_WORDS.push(newWord);
    saveBlacklist(); // 파일에 저장
    return message.reply(`✅ 금지어 **${newWord}** (을)를 목록에 추가했습니다. (총 ${BLACKLISTED_WORDS.length}개)`);
  }

  // ========== !removeword ==========
  if (cmd === "!removeword") {
    const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
    if (!wordToRemove) return message.reply("Usage: `!removeword [단어]`");

    const initialLength = BLACKLISTED_WORDS.length;
    // 해당 단어를 제외한 새 배열을 만듭니다.
    BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== wordToRemove);
    
    if (BLACKLISTED_WORDS.length === initialLength) {
      return message.reply(`⚠ **${wordToRemove}** (은)는 금지어 목록에 없습니다.`);
    }

    saveBlacklist(); // 파일에 저장
    return message.reply(`✅ 금지어 **${wordToRemove}** (을)를 목록에서 제거했습니다. (총 ${BLACKLISTED_WORDS.length}개)`);
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
      .setFooter({ text: "50개까지만 표시됩니다." });

    return message.reply({ embeds: [listEmbed] });
  }

  // ========== !reloadblacklist (파일에서 다시 읽기) ==========
  if (cmd === "!reloadblacklist") {
        loadBlacklist(); 
        message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        return;
  }


  // =====================================================
  // PANEL SETUP COMMANDS (Admin Only)
  // =====================================================

 // ========== !setupjoin (Join Panel): 규칙 패널 - ⭐레이아웃 복원 완료⭐ ==========
  if (cmd === "!setupjoin") {
    
    const joinEmbed = new EmbedBuilder()
      .setColor("#1e90ff")
      .setTitle("✨ Welcome to the Gosu General TV Community!")
      .setDescription(
        [
          // 텍스트 중복 제거됨          
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

    // 'Agree To Rules' 버튼을 만듭니다.
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("agree_rules") // 버튼 상호작용(interaction) ID
        .setLabel("Agree To Rules")
        .setStyle(ButtonStyle.Success)
    );

    // 1단계: MUST READ 이미지를 첨부 파일로 먼저 전송 (배너 이미지)
    await message.channel.send({ 
        files: [{ attachment: RULES_BANNER_URL, name: 'must_read.png' }]
    }); 

    // 2단계: 임베드와 버튼을 전송합니다.
    await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
    return;
  }
  // ========== !setupjoin (Join Panel) 명령어 끝 ==========

  // ========== !welcome (Welcome Panel) - ⭐레이아웃 복원 완료⭐ ==========
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

    // 1단계: WELCOME 배너 이미지를 '첨부 파일'로 먼저 전송 (배너 이미지)
    await message.channel.send({ 
        files: [{ attachment: WELCOME_BANNER_URL, name: 'welcome.png' }]
    }); 

    // 2단계: 이미지 다음에 임베드와 버튼을 전송합니다.
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

  // ========== !subscriber (Live Notification Panel - Admin+) - ⭐레이아웃 복원 및 권한 수정 완료⭐ ==========
  // 권한: Admin/Developer Only
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

    // 1단계: DON'T MISS 배너 이미지를 '첨부 파일'로 먼저 전송
    await message.channel.send({ 
        files: [{ attachment: NOTIFICATION_BANNER_URL, name: 'notification_banner.png' }]
    }); 

    // 2단계: 임베드 멘트와 버튼만 전송합니다.
    await message.channel.send({ embeds: [subEmbed], components: [row] });
    return;
  }
  
  // =====================================================
  // MODERATION COMMANDS (Moderator+)
  // =====================================================

  // ========== !ban ==========
  if (cmd === "!ban") {
    const user = message.mentions.members?.first();
    if (!user) return message.reply("Usage: `!ban @user [reason]`");

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.ban({ reason });
      return message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
    } catch (err) {
      console.error("Ban error:", err);
      return message.reply("⚠ Failed to ban that user.");
    }
  }

  // ========== !kick ==========
  if (cmd === "!kick") {
    const user = message.mentions.members?.first();
    if (!user) return message.reply("Usage: `!kick @user [reason]`");

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.kick(reason);
      return message.reply(`👢 Kicked **${user.user.tag}**. Reason: ${reason}`);
    } catch (err) {
      console.error("Kick error:", err);
      return message.reply("⚠ Failed to kick that user.");
    }
  }

  // ========== !mute ==========
  if (cmd === "!mute") {
    const user = message.mentions.members?.first();
    const minutes = parseInt(args[2]) || 10;
    if (!user) return message.reply("Usage: `!mute @user [minutes]`");

    try {
      await user.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
      return message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
    } catch (err) {
      console.error("Mute error:", err);
      return message.reply("⚠ Failed to mute that user.");
    }
  }

  // ========== !unmute ==========
  if (cmd === "!unmute") {
    const user = message.mentions.members?.first();
    if (!user) return message.reply("Usage: `!unmute @user`");

    try {
      await user.timeout(null, `Unmuted by ${message.author.tag}`);
      return message.reply(`🔊 Unmuted **${user.user.tag}**.`);
    } catch (err) {
      console.error("Unmute error:", err);
      return message.reply("⚠ Failed to unmute that user.");
    }
  }

  // ========== !prune (Clear Messages) ==========
  if (cmd === "!prune") {
    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply("Usage: `!prune 1-100`");
    }

    try {
      await message.channel.bulkDelete(amount, true);
      const m = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
      setTimeout(() => m.delete().catch(() => {}), 4000);
    } catch (err) {
      console.error("Prune error:", err);
      return message.reply("⚠ Could not delete messages (maybe older than 14 days).");
    }
  }

  // ========== !addrole ==========
  if (cmd === "!addrole") {
    const target = message.mentions.members?.first();
    if (!target) return message.reply("Usage: `!addrole @user RoleName`");

    const roleName = args.slice(2).join(" ");
    if (!roleName) return message.reply("Please provide a role name.");

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) return message.reply(`⚠ Could not find a role named **${roleName}**.`);

    try {
      await target.roles.add(role);
      return message.reply(`✅ Added role **${role.name}** to **${target.user.tag}**.`);
    } catch (err) {
      console.error("Add role error:", err);
      return message.reply("⚠ Failed to add that role.");
    }
  }

  // ========== !removerole ==========
  if (cmd === "!removerole") {
    const target = message.mentions.members?.first();
    if (!target) return message.reply("Usage: `!removerole @user RoleName`");

    const roleName = args.slice(2).join(" ");
    if (!roleName) return message.reply("Please provide a role name.");

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) return message.reply(`⚠ Could not find a role named **${roleName}**.`);

    if (!target.roles.cache.has(role.id)) {
      return message.reply(
        `⚠ **${target.user.tag}** does not currently have the **${role.name}** role.`
      );
    }

    try {
      await target.roles.remove(role);
      return message.reply(`❎ Removed role **${role.name}** from **${target.user.tag}**.`);
    } catch (err) {
      console.error("Remove role error:", err);
      return message.reply("⚠ Failed to remove that role.");
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
          "`!ping` — Check if the bot is online.",
          "`!invite` — Show the server invite link.",
          "",
          "**Moderation (Moderator+)**",
          "`!ban @user [reason]` — Ban a user.",
          "`!kick @user [reason]` — Kick a user.",
          "`!mute @user [minutes]` — Timeout a user.",
          "`!unmute @user` — Remove timeout.",
          "`!prune [1-100]` — Delete recent messages.",
          "`!addrole @user RoleName` — Add a role to a user.",
          "`!removerole @user RoleName` — Remove a role from a user.",
          "",
          "**Admin / Developer**",
          "`!setupjoin` — Create the rules panel.",
          "`!welcome` — Create the main welcome panel.",
          "`!subscriber` — Create the live notification panel.", // Admin Only
          "`!color` — Create the Color 3 role panel.",
          "`!addword [단어]` — Add a word to the filter list.",
          "`!removeword [단어]` — Remove a word from the filter list.",
          "`!listwords` — Show the current blacklisted words.",
          "`!reloadblacklist` — Reload the filter words from the JSON file.",
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

  // -------- Subscribe / Unsubscribe Toggle Button (상호 배타적 로직) --------
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
      // 1. 현재 구독 역할(SUB_ROLE)을 가지고 있는지 확인 (-> 구독 해제)
      if (member.roles.cache.has(SUB_ROLE)) {
        // 2. 구독 해제 (SUB_ROLE 제거 및 GOSU_ROLE 부여)
        await member.roles.remove(subRole);
        await member.roles.add(gosuRole);
        return interaction.reply({
          content: `🔕 Live notifications **unsubscribed**. Your role has been reset to **${gosuRole.name}**.`,
          ephemeral: true,
        });
      } else {
        // 3. 구독 (SUB_ROLE 부여 및 GOSU_ROLE 제거)
        // Gosu Role을 가지고 있다면 제거합니다. (상호 배타적)
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

  // -------- Color buttons (상호 배타적 로직) --------
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
      // 현재 멤버가 가지고 있는 컬러 역할들을 찾습니다.
      const toRemove = member.roles.cache.filter((r) => colorRoleIds.includes(r.id));

      // 이미 이 색을 갖고 있으면 → 제거
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.reply({
          content: `Removed color role **${role.name}**.`,
          ephemeral: true,
        });
      }

      // 다른 색들 모두 제거 후 새 색 부여 (하나만 가질 수 있도록)
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
// Login
// --------------------
client.login(process.env.Bot_Token);

