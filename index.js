// ===============================
// Gosu Custom Discord Bot (Full Build)
// All features integrated
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
const GOSU_ROLE = "496717793388134410";
const MOD_ROLE = "495727371140202506";
const ADMIN_ROLE = "495718851288236032";

// Make client
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
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(ADMIN_ROLE) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

function isAdmin(member) {
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// --------------------
// Bot Ready
// --------------------
client.once("ready", () => {
  console.log(`Bot Logged in as ${client.user.tag}`);
});

// =====================================================
// PREFIX COMMANDS
// =====================================================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();

  // ---------------------------
  // Developer / Admin Only Commands
  // ---------------------------
  const adminOnly = ["!setupjoin", "!color"];
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message.member)) {
      return message.reply("⛔ Only **Admins/Developers** can use this command.");
    }
  }

  // ---------------------------
  // Moderator Only Commands
  // ---------------------------
  const modOnly = ["!ban", "!kick", "!mute", "!unmute", "!prune", "!addrole", "!removerole"];
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
  // JOIN PANEL SETUP
  // =====================================================
  if (cmd === "!setupjoin") {
    await message.delete().catch(() => {});

    const joinEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("Welcome to the Gosu Server")
      .setDescription(
        "**Rule 1 — Respect Everyone**\nTreat all members with respect.\n\n" +
          "**Rule 2 — No Spam or Excessive Mentions**\nDo not spam messages, images, or ping excessively.\n\n" +
          "**Rule 3 — No NSFW or Harmful Content**\nAbsolutely no gore or NSFW.\n\n" +
          "**Rule 4 — No Unauthorized Advertising**\nNo invite links or self promotion.\n\n" +
          "**Rule 5 — Keep Conversations Clean**\nAvoid drama & hate speech.\n\n" +
          "**Rule 6 — Follow Staff Directions**\nStaff decisions are final.\n\n" +
          "*Press Agree to receive server access.*"
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("agree_rules")
        .setLabel("Agree To Rules")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [joinEmbed], components: [buttons] });
    return message.channel.send("✅ Rules panel has been created in this channel.");
  }

  // =====================================================
  // MODERATION COMMANDS
  // =====================================================

  // ========== !ban ==========
  if (cmd === "!ban") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Usage: `!ban @user reason`");
    user.ban({ reason: args.slice(2).join(" ") || "No reason" });
    return message.reply(`🔨 Banned **${user.user.tag}**`);
  }

  // ========== !kick ==========
  if (cmd === "!kick") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Usage: `!kick @user reason`");
    user.kick(args.slice(2).join(" ") || "No reason");
    return message.reply(`👢 Kicked **${user.user.tag}**`);
  }

  // ========== !mute ==========
  if (cmd === "!mute") {
    const user = message.mentions.members.first();
    const minutes = parseInt(args[2]) || 10;
    if (!user) return message.reply("Usage: `!mute @user [minutes]`");

    await user.timeout(minutes * 60 * 1000);
    return message.reply(`🔇 Muted **${user.user.tag}** for ${minutes} minutes.`);
  }

  // ========== !unmute ==========
  if (cmd === "!unmute") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Usage: `!unmute @user`");

    await user.timeout(null);
    return message.reply(`🔊 Unmuted **${user.user.tag}**`);
  }

  // ========== !prune ==========
  if (cmd === "!prune") {
    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply("Usage: `!prune 1-100`");
    }
    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`🧹 Deleted **${amount}** messages.`).then((m) =>
      setTimeout(() => m.delete().catch(() => {}), 4000)
    );
  }

  // ========== !addrole ==========
  if (cmd === "!addrole") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("Usage: `!addrole @user RoleName`");

    const roleName = args.slice(2).join(" ");
    if (!roleName) return message.reply("Specify a role name.");

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) return message.reply("Cannot find that role.");

    await target.roles.add(role);
    return message.reply(`✅ Added **${role.name}** to **${target.user.tag}**.`);
  }

  // ========== !removerole ==========
  if (cmd === "!removerole") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("Usage: `!removerole @user RoleName`");

    const roleName = args.slice(2).join(" ");
    if (!roleName) return message.reply("Specify a role name.");

    const role = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (!role) return message.reply("Cannot find that role.");

    await target.roles.remove(role);
    return message.reply(`❎ Removed **${role.name}** from **${target.user.tag}**.`);
  }

  // ========== !invite ==========
  if (cmd === "!invite") {
    return message.reply("📨 **Server Invite:** https://discord.gg/gosugeneral");
  }

  // ========== !help or /? ==========
  if (cmd === "!help" || cmd === "/?") {
    const help = new EmbedBuilder()
      .setColor("#00FFFF")
      .setTitle("Gosu Bot — Moderator & Admin Commands")
      .setDescription(
        "**Moderation Commands**\n" +
          "`!ban @user`\n" +
          "`!kick @user`\n" +
          "`!mute @user [min]`\n" +
          "`!unmute @user`\n" +
          "`!prune [1-100]`\n" +
          "`!addrole @user RoleName`\n" +
          "`!removerole @user RoleName`\n\n" +
          "**Admin Commands**\n" +
          "`!setupjoin`\n" +
          "`!color`\n\n" +
          "**General**\n" +
          "`!ping`\n" +
          "`!invite`"
      );
    return message.reply({ embeds: [help] });
  }
});

// =====================================================
// BUTTON INTERACTION (AGREE TO RULES)
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "agree_rules") {
    await interaction.member.roles.add(GOSU_ROLE);
    return interaction.reply({
      content: "✅ You have been granted access!",
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
