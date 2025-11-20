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
const GOSU_ROLE = "496717793388134410";      // Main Gosu Role (규칙 동의 후 부여되는 기본 역할 ID)
const MOD_ROLE = "495727371140202506";       // Moderator Role (관리 및 필터 면제 역할 ID)
const ADMIN_ROLE = "495718851288236032";     // Admin / Developer Role (최고 관리자 및 필터 면제 역할 ID)
const SUB_ROLE = "497654614729031681";       // Live Notification Subscriber Role (알림 역할 ID)

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
// Client Initialization
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
// Bot Ready Event
// --------------------
client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// =====================================================
// PREFIX COMMANDS & CHAT FILTER (FINAL LOGIC)
// =====================================================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ---------------------------
  // 0. COMMAND PARSING
  // ---------------------------
  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();
  const isCommand = cmd && cmd.startsWith("!"); // !로 시작하면 명령어
  
  // ---------------------------
  // 1. CHAT FILTER LOGIC (초성/특수문자 우회 방지 로직 적용)
  // ---------------------------
  const member = message.member;

  // 명령어인 경우 필터링을 면제합니다.
  const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId)) || isCommand;

  if (!isExempt) {
    // 1. 정규화(NFC)를 사용하여 분리된 초성/중성을 완성된 글자로 합칩니다.
    const normalizedContent = message.content.normalize('NFC').toLowerCase();
    
    // 2. 한글, 영어, 숫자 외의 모든 문자를 제거하여 띄어쓰기, 특수문자 우회를 방지합니다.
    const simplifiedContent = normalizedContent.replace(/[^가-힣a-z0-9]/g, '');

    // 블랙리스트 단어도 띄어쓰기/특수문자 제거 후 비교합니다.
    const foundWord = BLACKLISTED_WORDS.find(word => {
        // 블랙리스트 단어 자체에서 특수문자를 제거합니다.
        const simplifiedWord = word.replace(/[^가-힣a-z0-9]/g, '');
        // 메시지 내용에 블랙리스트 단어가 포함되어 있는지 확인합니다.
        return simplifiedContent.includes(simplifiedWord);
    });

    if (foundWord) {
      // Delete message
      if (!message.deleted) {
        message.delete().catch(() => {
          console.error(`Failed to delete message: ${message.id}`);
        });
      }

      // Send warning message (삭제되지 않음)
      await message.channel.send(
        `🚫 ${member} **Watch your language!**` 
      );
      
      // Stop processing other commands after a blacklisted word is found
      return; 
    }
  }
  
  // ---------------------------
  // 2. COMMAND LOGIC
  // ---------------------------

  // ---- All !commands are auto-deleted after 1 second ----
  if (isCommand) {
    setTimeout(() => {
      if (!message.deleted) {
        message.delete().catch(() => {});
      }
    }, 1000); 
  }

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

  // Moderator (or Admin) Commands (블랙리스트 관리 명령어 포함)
  const modOnly = [
    "!ban", "!kick", "!mute", "!unmute", "!prune", 
    "!addrole", "!removerole",
    "!addword", "!removeword", "!listwords", "!reloadblacklist" // 👈 Moderator 권한 허용
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
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.ban({ reason });
      const reply = await message.reply(`🔨 Banned **${user.user.tag}**. Reason: ${reason}`);
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    } catch (err) {
      console.error("Ban error:", err);
      const reply = await message.reply("⚠ Failed to ban that user.");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }
  }

  // ========== !kick ==========
  if (cmd === "!kick") {
    const user = message.mentions.members?.first();
    if (!user) {
      const reply = await message.reply("Usage: `!kick @user [reason]`");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await user.kick(reason);
      const reply = await message.reply(`👢 Kicked **${user.user.tag}**. Reason: ${reason}`);
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    } catch (err) {
      console.error("Kick error:", err);
      const reply = await message.reply("⚠ Failed to kick that user.");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }
  }

  // ========== !mute ==========
  if (cmd === "!mute") {
    const user = message.mentions.members?.first();
    const minutes = parseInt(args[2]) || 10;
    if (!user) {
      const reply = await message.reply("Usage: `!mute @user [minutes]`");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }

    try {
      await user.timeout(minutes * 60 * 1000, `Muted by ${message.author.tag}`);
      const reply = await message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    } catch (err) {
      console.error("Mute error:", err);
      const reply = await message.reply("⚠ Failed to mute that user.");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }
  }

  // ========== !unmute ==========
  if (cmd === "!unmute") {
    const user = message.mentions.members?.first();
    if (!user) {
      const reply = await message.reply("Usage: `!unmute @user`");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    }

    try {
      await user.timeout(null, `Unmuted by ${message.author.tag}`);
      const reply = await message.reply(`🔊 Unmuted **${user.user.tag}**.`);
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
    } catch (err) {
      console.error("Unmute error:", err);
      const reply = await message.reply("⚠ Failed to unmute that user.");
      // setTimeout(() => reply.delete().catch(() => {}), 1000); // 👈 삭제 안 함
      return;
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
      setTimeout(() => m.delete().catch(() => {}), 1000);
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
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    const roleName = args.slice(2).join(" ");
    if (!roleName) {
      const reply = await message.reply("Please provide a role name.");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) {
      const reply = await message.reply(`⚠ Could not find a role named **${roleName}**.`);
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    try {
      await target.roles.add(role);
      const reply = await message.reply(`✅ Added role **${role.name}** to **${target.user.tag}**.`);
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    } catch (err) {
      console.error("Add role error:", err);
      const reply = await message.reply("⚠ Failed to add that role.");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }
  }

  // ========== !removerole ==========
  if (cmd === "!removerole") {
    const target = message.mentions.members?.first();
    if (!target) {
      const reply = await message.reply("Usage: `!removerole @user RoleName`");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    const roleName = args.slice(2).join(" ");
    if (!roleName) {
      const reply = await message.reply("Please provide a role name.");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) {
      const reply = await message.reply(`⚠ Could not find a role named **${roleName}**.`);
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    if (!target.roles.cache.has(role.id)) {
      const reply = await message.reply(
        `⚠ **${target.user.tag}** does not currently have the **${role.name}** role.`
      );
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    }

    try {
      await target.roles.remove(role);
      const reply = await message.reply(`❎ Removed role **${role.name}** from **${target.user.tag}**.`);
      setTimeout(() => reply.delete().catch(() => {}), 1000);
      return;
    } catch (err) {
      console.error("Remove role error:", err);
      const reply = await message.reply("⚠ Failed to remove that role.");
      setTimeout(() => reply.delete().catch(() => {}), 1000);
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
          "`!ping` — Check if the bot is online.",
          "`!invite` — Show the server invite link.",
          "",
          "**Moderation / Filter Management (Moderator+)**",
          "`!ban @user [reason]` — Ban a user. (Reply stays)",
          "`!kick @user [reason]` — Kick a user. (Reply stays)",
          "`!mute @user [minutes]` — Timeout a user. (Reply stays)",
          "`!unmute @user` — Remove timeout. (Reply stays)",
          "`!prune [1-100]` — Delete recent messages. (Reply deletes after 1s)",
          "`!addrole @user RoleName` — Add a role to a user. (Reply deletes after 1s)",
          "`!removerole @user RoleName` — Remove a role from a user. (Reply deletes after 1s)",
            "`!addword [word]` — Add a word to the filter list. (Reply deletes after 1s)",
          "`!removeword [word]` — Remove a word from the filter list. (Reply deletes after 1s)",
          "`!listwords` — Show the current blacklisted words.",
          "`!reloadblacklist` — Reload the filter words from the JSON file. (Reply deletes after 1s)",
          "",
          "**Admin / Developer**",
          "`!setupjoin` — Create the rules panel.",
          "`!welcome` — Create the main welcome panel.",
          "`!subscriber` — Create the live notification panel.",
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

  // -------- Subscribe / Unsubscribe Toggle Button (Mutually Exclusive Logic) --------
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
      // 1. Check if member currently has the subscription role (-> Unsubscribe)
      if (member.roles.cache.has(SUB_ROLE)) {
        // 2. Unsubscribe (Remove SUB_ROLE and Add GOSU_ROLE back)
        await member.roles.remove(subRole);
        await member.roles.add(gosuRole);
        return interaction.reply({
          content: `🔕 Live notifications **unsubscribed**. Your role has been reset to **${gosuRole.name}**.`,
          ephemeral: true,
        });
      } else {
        // 3. Subscribe (Add SUB_ROLE and Remove GOSU_ROLE)
        // Remove Gosu Role if they have it (mutually exclusive)
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

  // -------- Color buttons (Mutually Exclusive Logic) --------
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
      // Find all color roles the current member has.
      const toRemove = member.roles.cache.filter((r) => colorRoleIds.includes(r.id));

      // If they already have this color -> Remove it
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.reply({
          content: `Removed color role **${role.name}**.`,
          ephemeral: true,
        });
      }

      // Remove all other colors, then add the new one (ensures only one color is held)
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

