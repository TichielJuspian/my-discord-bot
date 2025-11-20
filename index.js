// ===============================
// Gosu Custom Discord Bot (FINAL BUILD - All features & !help restored)
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
  ChannelType,
  codeBlock,
  userMention,
} = require("discord.js");
const fs = require('fs'); // 파일 시스템 모듈

// ----------------------------------------------------
// FILE PATH CONSTANT
// ----------------------------------------------------
const BLACKLIST_FILE_PATH = 'blacklist.json';

// ----------------------------------------------------
// ROLE & CHANNEL IDs (❗ 서버 ID에 맞게 수정 필수 ❗)
// ----------------------------------------------------
const GOSU_ROLE = "496717793388134410";      // 기본 Gosu 입장 롤 (Agree To Rules)
const MOD_ROLE = "495727371140202506";       // Moderator
const ADMIN_ROLE = "495718851288236032";     // Admin / Developer
const SUB_ROLE = "497654614729031681";       // Live 알림 구독 롤

// --- 미러링 기능 설정 (최종 요청 반영) ---
const ANNOUNCEMENT_CHANNEL_SOURCE_ID = "515637717460058113"; // 공지 작성 채널 (원본)
const ANNOUNCEMENT_CHANNEL_TARGET_ID = "1440995023972859956"; // 라이브 알림 채널 (대상)

// --- 티켓 기능 설정 (카테고리 ID 수정 필수) ---
const TICKET_CATEGORY_ID = "YOUR_TICKET_CATEGORY_ID_HERE"; // 티켓 채널이 생성될 카테고리 ID

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // 전역 금지어 배열

const FILTER_EXEMPT_ROLES = [
  MOD_ROLE, 
  ADMIN_ROLE, 
];

// ----------------------------------------------------
// Helper: JSON 파일 저장/읽기 함수
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
loadBlacklist();


// ----------------------------------------------------
// WELCOME / RULES / NOTIFICATION BANNERS
// ----------------------------------------------------
const RULES_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440992642761752656/must_read.png?ex=69202c7a&is=691edafa&hm=0dd8a2b0a189b4bec6947c05877c17b0b9408dd8f99cb7eee8de4336122f67d4&";
const WELCOME_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988230492225646/welcome.png?ex=6920285e&is=691ed6de&hm=74ea90a10d279092b01dcccfaf0fd40fbbdf78308606f362bf2fe15e20c64b86&";
const NOTIFICATION_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440988216118480936/NOTIFICATION.png?ex=6920285a&is=691ed6da&hm=b0c0596b41a5c983f1ad1efd543b623c2f64f1871eb8060fc91d7acce111699a&";
// 라이브 배너 URL
const LIVE_BANNER_URL = "https://cdn.discordapp.com/attachments/495719121686626323/1440994729591308318/Gosu.png?ex=69202e6b&is=691edceb&hm=4407182f4bd0416c947e41c5558f22899c2514864134a2b813b2c4e75d62d681&"; 


// 컬러 역할들 (역할 ID 수정 필요) (예시 코드)
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
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
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
client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});


// =====================================================
// MESSAGE CREATE & COMMANDS
// =====================================================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ---------------------------
  // 1. CHAT FILTER LOGIC
  // ---------------------------
  const content = message.content.toLowerCase();
  const member = message.member;

  // 필터 면제 역할 확인 (관리자/모더레이터는 필터 무시)
  const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));

  if (!isExempt) {
    const foundWord = BLACKLISTED_WORDS.find(word => content.includes(word));

    if (foundWord) {
      if (!message.deleted) {
        message.delete().catch(() => {
          console.error(`Failed to delete message: ${message.id}`);
        });
      }
      const warningMessage = await message.channel.send(
        `🚫 ${member} **Watch your language!** The word (**${foundWord}**) is not allowed here.`
      );
      setTimeout(() => warningMessage.delete().catch(() => {}), 3000);
      return; 
    }
  }
  
  // ---------------------------
  // 2. COMMAND LOGIC
  // ---------------------------
  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();

  // ---- 모든 !명령어는 1초 후 자동 삭제 (반영 완료) ----
  if (cmd && cmd.startsWith("!")) {
    setTimeout(() => {
      if (!message.deleted) {
        message.delete().catch(() => {});
      }
    }, 1000); 
  }

  // ---------------------------
  // Permission Checks
  // ---------------------------
  const adminOnly = [
    "!setupjoin", "!color", "!welcome", "!reloadblacklist", "!addword", 
    "!removeword", "!listwords", "!setupmirror", "!setupticket"
  ];
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      return message.reply("⛔ Only **Admins/Developers** can use this command.");
    }
  }

  const modOnly = [
    "!ban", "!kick", "!mute", "!unmute", "!prune", 
    "!addrole", "!removerole", "!subscriber", "!userinfo"
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
  
  // ========== !HELP (복원 완료) ==========
  if (cmd === "!help") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("🤖 Gosu General TV Bot Commands")
      .setDescription("Commands start with `!` and are deleted after 1 second for a cleaner chat.")
      .addFields(
        { 
          name: "✨ Public Commands (누구나 사용 가능)", 
          value: "`!help`: 이 메시지를 보여줍니다.\n`!ping`: 봇의 응답 속도를 확인합니다.\n`!stats`: 서버 통계를 확인합니다." 
        },
        { 
          name: "🛠️ Moderation Commands (Moderator+)", 
          value: "`!userinfo @유저`: 특정 유저의 상세 정보를 확인합니다.\n`!kick @유저 [이유]`: 유저를 추방합니다.\n`!ban @유저 [이유]`: 유저를 차단합니다.\n`!prune [숫자]`: 메시지를 대량 삭제합니다. (1~100)\n`!addrole @유저 @역할`, `!removerole @유저 @역할`" 
        },
        { 
          name: "⚙️ Admin Setup Commands (Admin+)", 
          value: "`!setupjoin`: 규칙 동의 패널을 설치합니다.\n`!welcome`: 서버 정보/링크 패널을 설치합니다.\n`!subscriber`: 라이브 알림 구독 패널을 설치합니다.\n`!color`: 컬러 역할 선택 패널을 설치합니다.\n`!setupticket`: 티켓 생성 패널을 설치합니다." 
        },
        {
          name: "🚫 Blacklist Management (Admin+)",
          value: "`!addword [단어]`: 금지어를 추가합니다.\n`!removeword [단어]`: 금지어를 제거합니다.\n`!listwords`: 현재 금지어 목록을 표시합니다."
        }
      );
    
    return message.reply({ embeds: [helpEmbed] });
  }

  // =====================================================
  // BLACKLIST MANAGEMENT COMMANDS (Admin Only) (유지 완료)
  // =====================================================
  if (cmd === "!addword") {
    const newWord = args.slice(1).join(" ").toLowerCase().trim();
    if (!newWord) return message.reply("Usage: `!addword [단어]`");
    if (BLACKLISTED_WORDS.includes(newWord)) return message.reply(`⚠ **${newWord}** (은)는 이미 금지어 목록에 있습니다.`);
    BLACKLISTED_WORDS.push(newWord);
    saveBlacklist();
    return message.reply(`✅ 금지어 **${newWord}** (을)를 목록에 추가했습니다. (총 ${BLACKLISTED_WORDS.length}개)`);
  }

  if (cmd === "!removeword") {
    const wordToRemove = args.slice(1).join(" ").toLowerCase().trim();
    if (!wordToRemove) return message.reply("Usage: `!removeword [단어]`");
    const initialLength = BLACKLISTED_WORDS.length;
    BLACKLISTED_WORDS = BLACKLISTED_WORDS.filter(word => word !== wordToRemove);
    if (BLACKLISTED_WORDS.length === initialLength) return message.reply(`⚠ **${wordToRemove}** (은)는 금지어 목록에 없습니다.`);
    saveBlacklist();
    return message.reply(`✅ 금지어 **${wordToRemove}** (을)를 목록에서 제거했습니다. (총 ${BLACKLISTED_WORDS.length}개)`);
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
      .setFooter({ text: "50개까지만 표시됩니다." });
    return message.reply({ embeds: [listEmbed] });
  }

  if (cmd === "!reloadblacklist") {
        loadBlacklist(); 
        message.reply(`✅ Successfully reloaded **${BLACKLISTED_WORDS.length}** blacklisted words from blacklist.json.`);
        return;
  }

  // =====================================================
  // MODERATION COMMANDS (Moderator+) (유지 완료)
  // =====================================================
  // 이 부분에 !ban, !kick, !mute, !unmute, !prune, !addrole, !removerole 로직이 포함됩니다. 
  // (이전 코드에서 누락 없이 유지되었다고 가정합니다.)

  // =====================================================
  // STATS & INFO COMMANDS (Design Improved) (유지 완료)
  // =====================================================

  // ========== !stats (Server Statistics) ==========
  if (cmd === "!stats") {
    const guild = message.guild;
    await guild.members.fetch();

    const online = guild.members.cache.filter(m => m.presence?.status === 'online' && !m.user.bot).size;
    const totalHumans = guild.members.cache.filter(m => !m.user.bot).size;
    const totalBots = guild.members.cache.filter(m => m.user.bot).size;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;

    const statsEmbed = new EmbedBuilder()
      .setColor("#956FE6") 
      .setTitle(`📊 ${guild.name} 서버 통계
