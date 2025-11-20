const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Role IDs
const MOD_ROLE_ID = "495727371140202506";    // Server Moderator role (can use mod commands)
const MEMBER_ROLE_ID = "496717793388134410"; // Gosu role (given on Agree)

// 🔗 Invite link (vanity URL)
const INVITE_LINK = "https://discord.gg/gosugeneral";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Helper: check if member is moderator+
function isModerator(member) {
  if (!member) return false;
  // Admins always allowed
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  // Has moderator role
  return member.roles.cache.has(MOD_ROLE_ID);
}

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();
  const args = content.split(/\s+/);

  // ---------- Public commands ----------

  // !ping
  if (lower.startsWith("!ping")) {
    return message.reply("Pong!");
  }

  // !invite -> anyone can use
  if (lower.startsWith("!invite")) {
    return message.reply(
      `Here is the server invite link:\n${INVITE_LINK}`
    );
  }

  // ---------- Moderator help: /? or !help ----------
  if (lower === "/?" || lower.startsWith("!help")) {
    if (!isModerator(message.member)) {
      return message.reply(
        "⛔ This help menu is only available to **Server Moderators or higher**."
      );
    }

    const helpEmbed = new EmbedBuilder()
      .setTitle("Gosu Bot — Moderator Commands")
      .setColor(0x00b0f4)
      .setDescription(
        [
          "**Prefix:** `!`",
          "",
          "**General**",
          "`!ping` — Check if the bot is online.",
          "`!invite` — Show the server invite link.",
          "",
          "**Moderation**",
          "`!setupjoin` — Create the rules panel with the Agree button.",
          "`!ban @user [reason]` — Ban a user from the server.",
          "`!kick @user [reason]` — Kick a user from the server.",
          "`!mute @user [minutes]` — Timeout a user (default 10 minutes).",
          "`!addrole @user @Role` — Add any role to a user (role must be below the bot).",
          "`!prune [1-100]` — Delete recent messages in this channel.",
          "",
          "**Notes**",
          "- All mod commands require **Server Moderator role or Administrator**.",
          "- Make sure the bot's role is above the roles it needs to manage.",
        ].join("\n")
      );

    return message.reply({ embeds: [helpEmbed] });
  }

  // ---------- Moderator-only commands below ----------
  if (
    lower.startsWith("!setupjoin") ||
    lower.startsWith("!ban") ||
    lower.startsWith("!kick") ||
    lower.startsWith("!mute") ||
    lower.startsWith("!addrole") ||
    lower.startsWith("!prune")
  ) {
    if (!isModerator(message.member)) {
      return message.reply(
        "⛔ This command can only be used by **Server Moderators or higher**."
      );
    }
  }

  // ========== !setupjoin (create rules panel) ==========
  if (lower.startsWith("!setupjoin")) {
    console.log("Executing rules panel creation...");

    // Delete original command message
    try {
      await message.delete();
    } catch (err) {
      console.error("Failed to delete command message:", err);
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle("Welcome to the Gosu Server")
        .setColor(0x5865f2)
        .setDescription(
          [
            "**Rule 1 — Respect Everyone**",
            "Treat all members with respect. no harassment, personal attacks, discrimination, or toxic behavior.",
            "",
            "**Rule 2 — No Spam or Excessive Mentions**",
            "Do not spam messages, images, emojis, links, or ping people excessively.",
            "",
            "**Rule 3 — No NSFW or Harmful Content**",
            "Absolutely no NSFW, gore, shock content, or anything unsafe for the community.",
            "",
            "**Rule 4 — No Unauthorized Advertising**",
            "No self-promo, invite links, or advertisements unless approved by staff.",
            "",
            "**Rule 5 — Keep Conversations Clean**",
            "No hate speech, slurs, extreme drama, or unnecessary arguing.",
            "",
            "**Rule 6 — Follow Staff Directions**",
            "Staff decisions are final. If there’s an issue, contact staff instead of escalating.",
            "",
            "P.S. Please read and follow the rules to keep the community clean.",
          ].join("\n")
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("agree_rules")
          .setLabel("✅ Agree To Rules")
          .setStyle(ButtonStyle.Success)
      );

      await message.channel.send({ embeds: [embed], components: [row] });

      const confirmMsg = await message.channel.send(
        "✅ Rules panel has been created in this channel."
      );

      setTimeout(() => {
        confirmMsg.delete().catch(() => {});
      }, 5000);
    } catch (err) {
      console.error("Error while creating rules panel:", err);
    }
    return;
  }

  // ========== !ban @user [reason] ==========
  if (lower.startsWith("!ban")) {
    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply("Usage: `!ban @user [reason]`");
    }
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("⚠ I do not have permission to **Ban Members**.");
    }
    if (!target.bannable) {
      return message.reply("⚠ I cannot ban this user (role may be higher than mine).");
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await target.ban({ reason });
      return message.reply(`🔨 Banned **${target.user.tag}**. Reason: ${reason}`);
    } catch (err) {
      console.error("Ban error:", err);
      return message.reply("⚠ Failed to ban the user.");
    }
  }

  // ========== !kick @user [reason] ==========
  if (lower.startsWith("!kick")) {
    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply("Usage: `!kick @user [reason]`");
    }
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply("⚠ I do not have permission to **Kick Members**.");
    }
    if (!target.kickable) {
      return message.reply("⚠ I cannot kick this user (role may be higher than mine).");
    }

    const reason = args.slice(2).join(" ") || "No reason provided";
    try {
      await target.kick(reason);
      return message.reply(`👢 Kicked **${target.user.tag}**. Reason: ${reason}`);
    } catch (err) {
      console.error("Kick error:", err);
      return message.reply("⚠ Failed to kick the user.");
    }
  }

  // ========== !mute @user [minutes] ==========
  // Uses Discord timeout
  if (lower.startsWith("!mute")) {
    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply("Usage: `!mute @user [minutes]` (default 10 minutes)");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("⚠ I do not have permission to **Timeout Members**.");
    }

    let minutes = parseInt(args[2], 10);
    if (isNaN(minutes) || minutes <= 0) minutes = 10; // default 10

    const durationMs = minutes * 60 * 1000;

    try {
      await target.timeout(
        durationMs,
        `Muted by ${message.author.tag} for ${minutes} minutes`
      );
      return message.reply(
        `🔇 Muted **${target.user.tag}** for **${minutes}** minute(s).`
      );
    } catch (err) {
      console.error("Mute error:", err);
      return message.reply("⚠ Failed to mute the user.");
    }
  }

  // ========== !addrole @user @Role ==========
  if (lower.startsWith("!addrole")) {
    const target = message.mentions.members?.first();
    const role = message.mentions.roles?.first();

    if (!target || !role) {
      return message.reply("Usage: `!addrole @user @Role`");
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("⚠ I do not have permission to **Manage Roles**.");
    }

    const botHighest = message.guild.members.me.roles.highest.position;
    if (role.position >= botHighest) {
      return message.reply("⚠ I cannot assign that role because it is higher or equal to my role.");
    }

    try {
      await target.roles.add(role);
      return message.reply(
        `✅ Added role **${role.name}** to **${target.user.tag}**.`
      );
    } catch (err) {
      console.error("Add role error:", err);
      return message.reply("⚠ Failed to add the role.");
    }
  }

  // ========== !prune [amount] ==========
  if (lower.startsWith("!prune")) {
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("⚠ I do not have permission to **Manage Messages**.");
    }

    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply("Usage: `!prune [1-100]`");
    }

    try {
      await message.channel.bulkDelete(amount + 1, true); // +1 to include the command
      const info = await message.channel.send(`🧹 Deleted **${amount}** messages.`);
      setTimeout(() => info.delete().catch(() => {}), 4000);
    } catch (err) {
      console.error("Prune error:", err);
      return message.reply(
        "⚠ Failed to prune messages. Messages older than 14 days cannot be deleted."
      );
    }
  }
});

// Button: Agree To Rules -> give Gosu role
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "agree_rules") return;

  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    return interaction.reply({
      content: "⚠ Something went wrong. Please contact a moderator.",
      ephemeral: true,
    });
  }

  try {
    const role = guild.roles.cache.get(MEMBER_ROLE_ID);

    if (!role) {
      console.error("Member role not found:", MEMBER_ROLE_ID);
      return interaction.reply({
        content: "⚠ Member role is not configured correctly. Please contact staff.",
        ephemeral: true,
      });
    }

    if (member.roles.cache.has(MEMBER_ROLE_ID)) {
      return interaction.reply({
        content: "You already have access. Enjoy the server!",
        ephemeral: true,
      });
    }

    await member.roles.add(role);
    console.log(`Assigned role ${role.name} to ${member.user.tag}`);

    return interaction.reply({
      content: `You accepted the rules and received the **${role.name}** role. Welcome!`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("Error while assigning role:", err);
    return interaction.reply({
      content: "⚠ Failed to assign the role. Please contact a moderator.",
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);
