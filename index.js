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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ✅ Agree To Rules 시 부여할 Gosu 역할 ID
const MEMBER_ROLE_ID = "496717793388134410";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 명령어 처리
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ping 테스트
  if (message.content.toLowerCase().startsWith("!ping")) {
    return message.reply("Pong!");
  }

  // 규칙 패널 생성
  if (message.content.toLowerCase().startsWith("!setupjoin")) {
    console.log("규칙 패널 생성 실행됨");

    // 명령어 메시지 삭제
    try {
      await message.delete();
    } catch (err) {
      console.error("명령어 삭제 실패:", err);
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle("Welcome to the Gosu Server")
        .setColor(0x5865f2)
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
        );

      // 버튼(Agree만)
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("agree_rules")
          .setLabel("✅ Agree To Rules")
          .setStyle(ButtonStyle.Success)
      );

      await message.channel.send({ embeds: [embed], components: [row] });

      // 확인 메시지 보내고 자동 삭제
      const confirmMsg = await message.channel.send(
        "✅ 규칙 패널을 이 채널에 생성했어요."
      );

      setTimeout(() => {
        confirmMsg.delete().catch(() => {});
      }, 5000);
    } catch (err) {
      console.error(err);
    }
  }
});

// 버튼 클릭 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "agree_rules") return;

  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    return interaction.reply({
      content: "⚠ Something went wrong.",
      ephemeral: true,
    });
  }

  try {
    const role = guild.roles.cache.get(MEMBER_ROLE_ID);

    if (!role) {
      return interaction.reply({
        content: "⚠ Role not found. Please contact staff.",
        ephemeral: true,
      });
    }

    // 이미 역할 있다면
    if (member.roles.cache.has(MEMBER_ROLE_ID)) {
      return interaction.reply({
        content: "You already have access!",
        ephemeral: true,
      });
    }

    // 역할 부여
    await member.roles.add(role);

    return interaction.reply({
      content: `You accepted the rules and received the **${role.name}** role!`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("역할 부여 오류:", err);
    return interaction.reply({
      content: "⚠ Failed to assign the role. Please contact a mod.",
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);
