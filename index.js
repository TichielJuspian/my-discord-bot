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
// JOIN / RULES PANEL: !setupjoin (수정 부분)
// =====================================================
if (cmd === "!setupjoin") {
    // 1. 임베드에서 이미지 설정을 제거합니다.
    const joinEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("🌟 Welcome to the Gosu General TV Community!")
      // .setImage(RULES_BANNER_URL) // <--- 이 부분을 제거합니다.
      .setDescription(
        [
          // ... (규칙 내용 유지)
          "Press **Agree To Rules** below to enter and enjoy the server! 🎉",
        ].join("\n")
      );

    const buttons = new ActionRowBuilder().addComponents(
        // ... (버튼 내용 유지)
    );

    // 1단계: 이미지를 먼저 전송
    await message.channel.send({ 
        files: [{ attachment: RULES_BANNER_URL, name: 'rules_banner.png' }]
    });

    // 2단계: 이어서 임베드 메시지 전송
    await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
    return;
}
// =====================================================
// WELCOME PANEL: !welcome (Blue Protocol 스타일)
// =====================================================
if (cmd === "!welcome") {
    // 1. 이미지 설정을 제거한 임베드 메시지 생성
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#1e90ff")
      .setTitle("✨ Welcome to the Gosu General TV Discord Server!")
      //.setImage(WELCOME_BANNER_URL) // <--- 이 부분을 주석 처리하거나 제거합니다.
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
          "---",
          "### 📌 What you can find here",
          "• Live stream notifications & announcements",
          "• Game discussions and guides",
          "• Clips, highlights, and community content",
          "• Chill chat with other Gosu viewers",
          "",
          "---",
          "### 🔗 Official Links",
          "📺 **YouTube** – https://youtube.com/@GosuGeneral",
          "📨 **Invite Link** – https://discord.gg/gosugeneral",
          "",
          "Enjoy your stay and have fun! 💙",
        ].join("\n")
      );

    // 버튼 컴포넌트 추가
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("YouTube Channel")
        .setStyle(ButtonStyle.Link)
        .setURL("https://youtube.com/@GosuGeneral"),
      new ButtonBuilder()
        .setLabel("Invite Link")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/gosugeneral")
    );

    // ----------------------------------------------------
    // 1단계: 이미지를 먼저 일반 메시지로 전송합니다.
    // ----------------------------------------------------
    // WELCOME_BANNER_URL에 있는 이미지를 첨부 파일로 전송합니다.
    await message.channel.send({ 
        files: [{ attachment: WELCOME_BANNER_URL, name: 'welcome_banner.png' }]
    });

    // ----------------------------------------------------
    // 2단계: 이미지 다음에 임베드 메시지를 전송합니다.
    // ----------------------------------------------------
    await message.channel.send({ embeds: [welcomeEmbed], components: [buttons] });
    return;
}
  // =====================================================
  // COLOR PANEL: !color (Admin only)
  // =====================================================
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

  // =====================================================
  // SUBSCRIBE PANEL: !subscriber (Moderator+)
  // =====================================================
  if (cmd === "!subscriber") {
    const subEmbed = new EmbedBuilder()
      .setColor("#FFCC33")
      .setTitle("📺 Gosu General TV — Live Notifications")
      .setDescription(
        [
          "If you’d like to receive alerts when **Gosu General TV** goes live or posts important announcements,",
          "press `Subscribe` to get the **Live Notifications** role.",
          "",
          "If you no longer want to receive these alerts,",
          "type `!unsubscribe` to remove the role.",
          "",
          "Thank you for being part of the community! 💙",
        ].join("\n")
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("sub_subscribe")
        .setLabel("Subscribe")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [subEmbed], components: [row] });
    return;
  }

  // =====================================================
  // MODERATION COMMANDS
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

  // ========== !prune ==========
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
  // SUBSCRIBE / UNSUBSCRIBE (PUBLIC)
  // =====================================================

  // ========== !subscribe ==========
  if (cmd === "!subscribe") {
    const member = message.member;
    if (member.roles.cache.has(SUB_ROLE)) {
      return message.reply(
        "🔔 You are already subscribed to **Gosu General TV Live** notifications."
      );
    }

    const role = message.guild.roles.cache.get(SUB_ROLE);
    if (!role) {
      return message.reply(
        "⚠ Subscription role is not configured correctly. Please contact staff."
      );
    }

    try {
      await member.roles.add(role);
      return message.reply(
        "✅ You are now **subscribed** to Gosu General TV Live notifications."
      );
    } catch (err) {
      console.error("Subscribe error:", err);
      return message.reply("⚠ Failed to add the subscription role.");
    }
  }

  // ========== !unsubscribe ==========
  if (cmd === "!unsubscribe") {
    const member = message.member;
    const role = message.guild.roles.cache.get(SUB_ROLE);
    if (!role) {
      return message.reply(
        "⚠ Subscription role is not configured correctly. Please contact staff."
      );
    }

    if (!member.roles.cache.has(SUB_ROLE)) {
      return message.reply("🔕 You are **not currently subscribed**.");
    }

    try {
      await member.roles.remove(role);
      return message.reply(
        "🔕 You have **unsubscribed** from Gosu General TV Live notifications."
      );
    } catch (err) {
      console.error("Unsubscribe error:", err);
      return message.reply("⚠ Failed to remove the subscription role.");
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
          "`!subscribe` — Subscribe to live notifications.",
          "`!unsubscribe` — Unsubscribe from live notifications.",
          "",
          "**Moderation (Moderator+)**",
          "`!ban @user [reason]` — Ban a user.",
          "`!kick @user [reason]` — Kick a user.",
          "`!mute @user [minutes]` — Timeout a user.",
          "`!unmute @user` — Remove timeout.",
          "`!prune [1-100]` — Delete recent messages.",
          "`!addrole @user RoleName` — Add a role to a user.",
          "`!removerole @user RoleName` — Remove a role from a user.",
          "`!subscriber` — Create the live notification panel.",
          "",
          "**Admin / Developer**",
          "`!setupjoin` — Create the rules panel.",
          "`!welcome` — Create the main welcome panel.",
          "`!color` — Create the Color 3 role panel.",
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

  // -------- Subscribe button --------
  if (customId === "sub_subscribe") {
    const role = guild.roles.cache.get(SUB_ROLE);
    if (!role) {
      return interaction.reply({
        content: "⚠ Subscription role is not configured correctly. Please contact staff.",
        ephemeral: true,
      });
    }

    if (member.roles.cache.has(SUB_ROLE)) {
      return interaction.reply({
        content: "🔔 You are already subscribed to live notifications.",
        ephemeral: true,
      });
    }

    try {
      await member.roles.add(role);
      return interaction.reply({
        content: "✅ You are now **subscribed** to Gosu General TV Live notifications.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("Subscribe button error:", err);
      return interaction.reply({
        content: "⚠ Failed to add the subscription role. Please contact staff.",
        ephemeral: true,
      });
    }
  }

  // -------- Color buttons --------
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

      // 이미 이 색을 갖고 있으면 → 제거
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.reply({
          content: `Removed color role **${role.name}**.`,
          ephemeral: true,
        });
      }

      // 다른 색들 모두 제거 후 새 색 부여
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

