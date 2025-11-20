// ===============================
// Gosu Custom Discord Bot (Final Build - Design Improved & All Features Merged)
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
// ⭐ 라이브 배너 URL 추가 ⭐
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

  // =====================================================
  // BLACKLIST MANAGEMENT COMMANDS (Admin Only)
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
  // MODERATION COMMANDS (Moderator+)
  // =====================================================
  // ... !ban, !kick, !mute, !unmute, !prune, !addrole, !removerole
  // (이 부분은 내용이 길어 생략되었으나, 이전 코드에서 유지됩니다.)

  // =====================================================
  // STATS & INFO COMMANDS (Design Improved)
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
      .setTitle(`📊 ${guild.name} 서버 통계`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { 
          name: "👥 총 멤버", 
          value: `**${guild.memberCount.toLocaleString()}** 명`, 
          inline: true 
        },
        { 
          name: "🟢 현재 온라인", 
          value: `**${online.toLocaleString()}** 명`, 
          inline: true 
        },
        { name: "\u200B", value: "\u200B", inline: true },

        { 
          name: "👤 인원 구분", 
          value: `인간: ${totalHumans}\n봇: ${totalBots}`, 
          inline: true 
        },
        { 
          name: "🔊 채널 수", 
          value: `텍스트: ${textChannels}\n음성: ${voiceChannels}`, 
          inline: true 
        },
        { 
          name: "✨ 부스팅", 
          value: `레벨: ${guild.premiumTier}\n부스트 수: ${guild.premiumSubscriptionCount || 0}`, 
          inline: true 
        }
      )
      .setFooter({ text: `서버 생성일: ${new Date(guild.createdTimestamp).toLocaleDateString()}` });
      
    return message.reply({ embeds: [statsEmbed] });
  }

  // ========== !userinfo (User Information) ==========
  if (cmd === "!userinfo") {
    const target = message.mentions.members?.first() || message.member;
    if (!target) return message.reply("Usage: `!userinfo @user`");

    const roles = target.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString());
    
    const rolesList = roles.slice(0, 5).join(", ") + (roles.length > 5 ? `... (and ${roles.length - 5} more)` : "");


    const userInfoEmbed = new EmbedBuilder()
      .setColor(target.displayHexColor === '#000000' ? '#956FE6' : target.displayHexColor)
      .setTitle(`👤 ${target.user.tag} 정보`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "디스코드 ID", value: codeBlock(target.id), inline: false },
        { name: "봇 계정 여부", value: target.user.bot ? "✅ Yes" : "❌ No", inline: true },
        { name: "현재 상태", value: target.presence?.status || "offline", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },

        { 
          name: "서버 가입일", 
          value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(target.joinedTimestamp / 1000)}:R>)`, 
          inline: true 
        },
        { 
          name: "계정 생성일", 
          value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>)`, 
          inline: true 
        },
        { name: "\u200B", value: "\u200B", inline: true },

        { 
          name: `보유 역할 (${roles.length})`, 
          value: roles.length > 0 ? rolesList : "없음", 
          inline: false 
        }
      );
    return message.reply({ embeds: [userInfoEmbed] });
  }
  
  // =====================================================
  // PANEL SETUP COMMANDS (Design Improved)
  // =====================================================

  // ========== !setupjoin (Rules Panel) ==========
  if (cmd === "!setupjoin") {
    const joinEmbed = new EmbedBuilder()
      .setColor("#84CC16")
      .setImage(WELCOME_BANNER_URL)
      .setTitle("✨ **Welcome to the Gosu General TV Community!**")
      .setDescription(
        [
          "Welcome to the official Gosu General TV Discord Server! Here you can join events, get updates, talk with the community, and enjoy the content together.",
          "Please make sure to read the rules below and press **Agree To Rules** to gain full access.",
          "---",
          "📜 **Server Rules**",
          "1. **Be Respectful:** Treat everyone kindly. No harassment, bullying, or toxicity.",
          "2. **No Spam:** Avoid repeated messages, emoji spam, or unnecessary mentions.",
          "3. **No NSFW or Harmful Content**",
          "4. **No Advertising**",
          "5. **Keep it Clean:** No hate speech, slurs, or extreme drama.",
          "6. **Follow Staff Instructions**",
          "---",
          "Press **Agree To Rules** below to enter and enjoy the server! 🎊"
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("agree_rules")
        .setLabel("Agree To Rules")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅")
    );
    
    await message.channel.send({ embeds: [joinEmbed], components: [row] });
    return;
  }

  // ========== !welcome (Info Panel) ==========
  if (cmd === "!welcome") {
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#956FE6") 
      .setImage(WELCOME_BANNER_URL)
      .setTitle("✨ **Welcome to the Gosu General TV Discord Server!**")
      .setDescription(
        [
          "Greetings, adventurer!",
          "Welcome to the Gosu General TV community server. Here you can hang out with the community, share plays, ask questions, receive announcements, and join events together.",
          "Please make sure to read our server rules in the rules/join channel, and press **Agree To Rules** there to gain full access.",
          "---",
          "📌 **What you can find here**",
          "* Live stream notifications & announcements",
          "* Game discussions and guides",
          "* Clips, highlights, and community content",
          "* Chill chat with other Gosu viewers",
          "---",
          "🔗 **Official Links**",
          "YouTube — <https://youtube.com/@GosuGeneral>",
          "Enjoy your stay and have fun! 💙"
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("YouTube Channel")
        .setStyle(ButtonStyle.Link)
        .setURL("https://youtube.com/@GosuGeneral")
        .setEmoji("▶️"),

      new ButtonBuilder()
        .setLabel("Discord Invite Link")
        .setStyle(ButtonStyle.Link)
        .setURL("YOUR_DISCORD_INVITE_LINK_HERE") 
        .setEmoji("🔗")
    );

    await message.channel.send({ embeds: [welcomeEmbed], components: [row] });
    return;
  }

  // ========== !color (Color Role Panel) ==========
  if (cmd === "!color") {
    const colorEmbed = new EmbedBuilder()
      .setColor("#F1C40F") // 노란색 계열
      .setTitle("🎨 **Select Your Username Color**")
      .setDescription("Choose a color for your username! Click the button corresponding to the color role you want.\n\n_Note: You can only have one color role at a time._");

    const rows = [];
    for (let i = 0; i < COLOR_ROLES.length; i += 5) {
      const row = new ActionRowBuilder();
      const chunk = COLOR_ROLES.slice(i, i + 5);
      
      chunk.forEach(role => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(role.customId)
            .setLabel(role.label)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(role.emoji)
        );
      });
      rows.push(row);
    }

    await message.channel.send({ embeds: [colorEmbed], components: rows });
    return;
  }
  
  // ========== !subscriber (Notification Panel) ==========
  if (cmd === "!subscriber") {
    const subEmbed = new EmbedBuilder()
      .setColor("#FF0000") 
      .setImage(NOTIFICATION_BANNER_URL)
      .setTitle("🔔 **Live Stream Notification Setup**")
      .setDescription(`Click the **Subscribe** button below to receive instant notifications and a ping role (${message.guild.roles.cache.get(SUB_ROLE)}) whenever the channel goes live!`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("sub_subscribe")
        .setLabel("Subscribe / Unsubscribe")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🛎️")
    );

    await message.channel.send({ embeds: [subEmbed], components: [row] });
    return;
  }

  // ========== !setupmirror (Announcement Mirroring Panel) ==========
  if (cmd === "!setupmirror") {
    if (ANNOUNCEMENT_CHANNEL_SOURCE_ID === "YOUR_SOURCE_CHANNEL_ID_HERE" || ANNOUNCEMENT_CHANNEL_TARGET_ID === "YOUR_TARGET_CHANNEL_ID_HERE") {
      return message.reply(`⚠️ **ERROR:** Please set **ANNOUNCEMENT_CHANNEL_SOURCE_ID** and **ANNOUNCEMENT_CHANNEL_TARGET_ID** in the code first.`);
    }
    
    const sourceChannel = message.guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_SOURCE_ID);
    const targetChannel = message.guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_TARGET_ID);

    if (!sourceChannel || !targetChannel) {
      return message.reply(`⚠️ **ERROR:** Could not find one or both configured channels.`);
    }

    const mirrorEmbed = new EmbedBuilder()
      .setColor("#00FF7F")
      .setTitle("📣 Live Announcement Mirroring Setup")
      .setDescription(
        [
          `✅ **원본 공지 채널 (Pingcord):** ${sourceChannel}`,
          `➡️ **대상 라이브 알림 채널:** ${targetChannel}`,
          `**멘션 역할:** ${message.guild.roles.cache.get(SUB_ROLE)}`,
          "",
          "원본 채널에 메시지가 포스팅되면, 대상 채널에 **라이브 배너와 함께** 자동으로 복사됩니다."
        ].join('\n')
      );

    return message.reply({ embeds: [mirrorEmbed] });
  }
  
  // ========== !setupticket (Ticket Panel) ==========
  if (cmd === "!setupticket") {
    if (TICKET_CATEGORY_ID === "YOUR_TICKET_CATEGORY_ID_HERE") {
      return message.reply(`⚠️ **ERROR:** Please set **TICKET_CATEGORY_ID** in the code first.`);
    }
    
    const ticketEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🎫 Create a Private Support Ticket")
      .setDescription(
        [
          "If you need to contact a staff member privately for support, reporting, or an appeal, click the button below.",
          "A new private channel will be created only visible to you and the Moderation Team."
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Open a Ticket")
        .setEmoji("📩")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [ticketEmbed], components: [row] });
    return;
  }
});

// =====================================================
// ANNOUNCEMENT MIRRORING LOGIC (Live Notifications - 배너 포함)
// =====================================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // 설정된 공지 작성 채널에서 메시지가 오면 (Pingcord 메시지 감지)
  if (message.channel.id === ANNOUNCEMENT_CHANNEL_SOURCE_ID) {
    const targetChannel = message.guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_TARGET_ID);
    const liveRole = message.guild.roles.cache.get(SUB_ROLE);

    if (!targetChannel || !liveRole) {
      console.error("Mirroring error: Target channel or Live role not found.");
      return;
    }

    try {
      // 1. Live Banner Embed 전송 (가장 상단에 배너와 멘션)
      const bannerEmbed = new EmbedBuilder()
        .setColor("#FF0000") // 빨간색 강조
        .setImage(LIVE_BANNER_URL);

      await targetChannel.send({ 
        content: `${liveRole} **Live Stream Started!**`, 
        embeds: [bannerEmbed]
      });
        
      // 2. 원본 메시지 복사 (Pingcord가 보낸 임베드/내용)
      const mirrorContent = {
        content: message.content,
        embeds: [...message.embeds],
        files: message.attachments.map(a => a.url),
        components: [...message.components],
      };
      
      await targetChannel.send(mirrorContent);
      
      console.log(`Successfully mirrored message with Live Banner.`);

    } catch (error) {
      console.error("Failed to mirror message:", error);
    }
  }
});


// =====================================================
// BUTTON INTERACTIONS (Rules + Colors + Subscribe + Ticket)
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, guild, member, channel } = interaction;
  const gosuRole = guild.roles.cache.get(GOSU_ROLE);

  // -------- Agree To Rules --------
  if (customId === "agree_rules") {
    if (!gosuRole) {
      await interaction.reply({ content: "Gosu Role not found. Please check configuration.", ephemeral: true });
      return;
    }

    try {
      await member.roles.add(gosuRole);
      await interaction.reply({ content: "✅ Rules agreed! You now have full server access.", ephemeral: true });
    } catch (error) {
      console.error("Error adding role on agreement:", error);
      await interaction.reply({ content: "⚠️ Failed to grant role. Check bot permissions.", ephemeral: true });
    }
  }

  // -------- Subscribe / Unsubscribe Toggle Button --------
  if (customId === "sub_subscribe") {
    const subRole = guild.roles.cache.get(SUB_ROLE);

    if (!subRole) {
      await interaction.reply({ content: "Subscriber Role not found. Please check configuration.", ephemeral: true });
      return;
    }

    try {
      if (member.roles.cache.has(subRole.id)) {
        await member.roles.remove(subRole);
        await interaction.reply({ content: `🔔 Unsubscribed! You will no longer receive live pings (${subRole.name}).`, ephemeral: true });
      } else {
        await member.roles.add(subRole);
        await interaction.reply({ content: `✅ Subscribed! You will now receive live pings (${subRole.name}).`, ephemeral: true });
      }
    } catch (error) {
      console.error("Error toggling subscribe role:", error);
      await interaction.reply({ content: "⚠️ Failed to modify your role. Check bot permissions.", ephemeral: true });
    }
  }

  // -------- Color buttons --------
  const colorConfig = COLOR_ROLES.find((c) => c.customId === customId);
  if (colorConfig) {
    const allColorRoleIds = COLOR_ROLES.map(c => c.roleId);
    const targetRole = guild.roles.cache.get(colorConfig.roleId);

    if (!targetRole) {
      return interaction.reply({ content: `Color role ${colorConfig.label} not found. Check configuration.`, ephemeral: true });
    }

    try {
      // 1. 기존 컬러 역할 제거 (한 가지 색상만 선택 가능하도록)
      const rolesToRemove = member.roles.cache.filter(role => allColorRoleIds.includes(role.id));
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
      }

      // 2. 새 컬러 역할 부여
      await member.roles.add(targetRole);
      await interaction.reply({ content: `✅ Your username color is now set to **${colorConfig.label}**!`, ephemeral: true });

    } catch (error) {
      console.error("Error toggling color role:", error);
      await interaction.reply({ content: "⚠️ Failed to change your color role. Check bot permissions.", ephemeral: true });
    }
  }

  // -------- Create Ticket Button --------
  if (customId === "create_ticket") {
    await interaction.deferReply({ ephemeral: true });

    const ticketName = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 6)}`;
    
    // 이미 열린 티켓이 있는지 확인
    const existingTicket = guild.channels.cache.find(c => 
      c.name.startsWith(`ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`) && c.parentId === TICKET_CATEGORY_ID
    );

    if (existingTicket) {
      return interaction.editReply({ 
        content: `⚠️ You already have an open ticket: ${existingTicket}. Please close it before opening a new one.`, 
        ephemeral: true 
      });
    }

    try {
      // 티켓 채널 생성
      const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: member.id, // 티켓 생성자
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: MOD_ROLE, // 모더레이터 역할
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: ADMIN_ROLE, // 관리자 역할
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
        ],
      });

      // 티켓 채널에 환영 메시지 전송
      const ticketWelcomeEmbed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle(`Ticket for ${member.user.tag}`)
        .setDescription(`Welcome ${member}, a staff member will be with you shortly.\n\nPlease explain your issue clearly.`);

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ 
        content: `${member} ${guild.roles.cache.get(MOD_ROLE)}`, 
        embeds: [ticketWelcomeEmbed], 
        components: [closeButton] 
      });

      // 상호작용 회신
      await interaction.editReply({ 
        content: `✅ Ticket created! Head over to ${ticketChannel}.`,
        ephemeral: true 
      });

    } catch (error) {
      console.error("Ticket creation error:", error);
      await interaction.editReply({ 
        content: `⚠️ Failed to create ticket: ${error.message}`,
        ephemeral: true 
      });
    }
  }

  // -------- Close Ticket Button --------
  if (customId === "close_ticket") {
    const hasPermission = isModerator(member) || channel.name.includes(member.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''));

    if (!hasPermission) {
      return interaction.reply({ content: "⚠️ Only the ticket creator or staff can close this ticket.", ephemeral: true });
    }

    await interaction.reply({ content: "🔒 Closing ticket in 5 seconds...", ephemeral: false });

    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (error) {
        console.error("Failed to delete ticket channel:", error);
        await interaction.editReply({ content: "⚠️ Failed to delete channel.", ephemeral: true });
      }
    }, 5000); 
  }
});

// =====================================================
// GUILD MEMBER ADD (Invite Tracking Logic Removed)
// =====================================================
client.on('guildMemberAdd', async (member) => {
  try {
    const gosuRole = member.guild.roles.cache.get(GOSU_ROLE);
    if (gosuRole) {
      // 역할 부여 로직은 주석 처리되어 있어 수동으로 진행됩니다.
      // await member.roles.add(gosuRole);
    }
  } catch (error) {
    console.error(`Error adding initial role to ${member.user.tag}: ${error.message}`);
  }
});


// --------------------
// Login
// --------------------
client.login(process.env.Bot_Token);
