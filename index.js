const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // 역할 주려면 필요
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ✅ 여기만 수정하면 됨: "Agree To Rules" 누르면 줄 역할 ID
const MEMBER_ROLE_ID = "496717793388134410"; // 예: "1192384729384729384"

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  console.log("메시지 감지:", `"${message.content}"`);

  // ping 테스트
  if (message.content.toLowerCase().startsWith("!ping")) {
    return message.reply("Pong!");
  }

  // 규칙 패널 생성 명령어
  if (message.content.toLowerCase().startsWith("!setupjoin")) {
    console.log("규칙 패널 생성 실행됨");

    try {
      const embed = new EmbedBuilder()
        .setTitle("Welcome to the Gosu Server")
        .setDescription(
          [
            "**Rule 1 — Respect Everyone**",
            "Treat all members with respect. No harassment, personal attacks, discrimination, or toxic behavior.",
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
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("agree_rules")
          .setLabel("✅ Agree To Rules")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("to_rules")
          .setLabel("📜 To Rules")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("help_mod")
          .setLabel("❓ HELP (Ping Mod)")
          .setStyle(ButtonStyle.Danger)
      );

      await message.channel.send({ embeds: [embed], components: [row] });

      await message.reply("✅ 규칙 패널을 이 채널에 생성했어요.");
    } catch (err) {
      console.error(err);
      await message.reply("⚠ 규칙 패널 생성 중 오류가 발생했습니다.");
    }
  }
});

// 버튼 인터랙션 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // 안전용: 길드/멤버 체크
  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    return interaction.reply({
      content: "⚠ Something went wrong. (No guild/member)",
      ephemeral: true,
    });
  }

  // ✅ Agree To Rules → 역할 부여
  if (interaction.customId === "agree_rules") {
    try {
      const role = guild.roles.cache.get(MEMBER_ROLE_ID);

      if (!role) {
        console.error("Role not found:", MEMBER_ROLE_ID);
        return interaction.reply({
          content:
            "⚠ Member role is not configured correctly. Please contact staff.",
          ephemeral: true,
        });
      }

      // 이미 역할 있는지 체크
      if (member.roles.cache.has(MEMBER_ROLE_ID)) {
        return interaction.reply({
          content: "You already have access. Enjoy the server!",
          ephemeral: true,
        });
      }

      await member.roles.add(role);
      console.log(`역할 부여: ${member.user.tag} -> ${role.name}`);

      return interaction.reply({
        content: `You accepted the rules and received **${role.name}** role. Welcome!`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("역할 부여 중 오류:", err);
      return interaction.reply({
        content:
          "⚠ Failed to assign the role. Please contact a moderator or admin.",
        ephemeral: true,
      });
    }
  }

  // 📜 To Rules
  if (interaction.customId === "to_rules") {
    return interaction.reply({
      content: "Please read the full rules carefully in the rules channel.",
      ephemeral: true,
    });
  }

  // ❓ HELP (Ping Mod)
  if (interaction.customId === "help_mod") {
    return interaction.reply({
      content: "A moderator will assist you soon. Please wait a moment.",
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);

