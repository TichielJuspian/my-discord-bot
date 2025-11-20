// ===============================
// Gosu Custom Discord Bot (Full Build)
// ===============================

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

// --------------------
// ROLE IDs
// --------------------
const GOSU_ROLE = "496717793388134410";      // 기본 Gosu 입장 롤 (Agree To Rules)
const MOD_ROLE = "495727371140202506";       // Moderator
const ADMIN_ROLE = "495718851288236032";     // Admin / Developer
const SUB_ROLE = "497654614729031681";       // Live 알림 구독 롤

// --------------------
// WELCOME / RULES BANNERS
// --------------------
const RULES_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440889423473541312/welcome.png";

const WELCOME_BANNER_URL =
  "https://cdn.discordapp.com/attachments/495719121686626323/1440889423473541312/welcome.png";

// 컬러 역할들 (역할 ID를 실제 서버 값으로 바꿔 넣으면 됨)
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
// PREFIX COMMANDS
// =====================================================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();

  // ---- 모든 !명령어는 2초 후 자동 삭제 ----
  if (cmd && cmd.startsWith("!")) {
    setTimeout(() => {
      if (!message.deleted) {
        message.delete().catch(() => {});
      }
    }, 2000);
  }

  // ---------------------------
  // Developer / Admin Only Commands
  // ---------------------------
  const adminOnly = ["!setupjoin", "!color", "!welcome"];
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      return message.reply("⛔ Only **Admins/Developers** can use this command.");
    }
  }

  // ---------------------------
  // Moderator Only Commands
  // ---------------------------
  const modOnly = [
    "!ban",
    "!kick",
    "!mute",
    "!unmute",
    "!prune",
    "!addrole",
    "!removerole",
    "!subscriber", // 구독 패널 생성
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
  // JOIN / RULES PANEL: !setupjoin
  // =====================================================
  if (cmd === "!setupjoin") {
    const joinEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("🌟 Welcome to the Gosu General TV Community!")
      .setImage(RULES_BANNER_URL)
      .setDescription(
        [
          "👋 **Welcome to the official Gosu General TV Discord Server!**",
          "",
          "Here you can join events, get updates, talk with the community, and enjoy the content together.",
          "Please make sure to read the rules below and press **Agree To Rules** to gain full access.",
          "",
          "----------------------------------------------",
          "### 📜 **Server Rules**",
          "",
          "✨ **1 — Be Respectful**\nTreat everyone kindly. No harassment, bullying, or toxicity.",
          "",
          "✨ **2 — No Spam**\nAvoid repeated messages, emoji spam, or unnecessary mentions.",
          "",
          "✨ **3 — No NSFW or Harmful Content**\nNo adult content, gore, or anything unsafe.",
          "",
          "✨ **4 — No Advertising**\nNo links, promos, or self-promotion without staff approval.",
          "",
          "✨ **5 — Keep it Clean**\nNo hate speech, slurs, or extreme drama.",
          "",
          "✨ **6 — Follow Staff Instructions**\nIf staff gives instructions, please follow them.",
          "",
          "----------------------------------------------",
          "Press **Agree To Rules** below to enter and enjoy the server! 🎉",
        ].join("\n")
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("agree_rules")
        .setLabel("Agree To Rules")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
    return;
  }

  // =====================================================
  // WELCOME PANEL: !welcome (Blue Protocol 스타일)
  // =====================================================
  if (cmd === "!welcome") {
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#1e90ff")
      .setTitle("✨ Welcome to the Gosu General TV Discord Server!")
      .setImage(WELCOME_BANNER_URL)
      .setDescription(
        [
          "Greetings, adventurer! 👋",
          "",
          "Welcome to the **Gosu General TV** community server.",
          "Here you can hang out with the community, share plays, ask questions,",
          "receive announcements, and join events together.",
          "",
          "Please make sure to read our server rules in the rules/join channel,",
          "and press **Agree To Rules** there to gain full access.",
          "",
          "---
