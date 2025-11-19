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

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 텍스트 명령 처리
client.on("messageCreate", async (message) => {
  // DM, 봇 메시지는 무시
  if (!message.guild || message.author.bot) return;

  // 테스트용 ping
  if (message.content === "!ping") {
    return message.reply("Pong!");
  }

  // 규칙 패널 설치 명령어
  if (message.content === "!setupjoin") {
    console.log("!setupjoin 명령어 감지됨, 채널:", message.channel.id);

    try {
      const embed = new EmbedBuilder()
        .setTitle("Welcome to Gosu(고수) Server")
        .setDescription(
          [
            "This server abides by the following ToS.",
            "[Discord's Community Guidelines](https://discord.com/guidelines)",
            "[Discord's Terms of Service](https://discord.com/terms)",
            "MLBB's Terms of Service",
            "",
            "Server Rules to Abide by:",
            "",
            "**Rule 1** - Respect the channels",
            "**Rule 2** - No personal attacks or harassment",
            "**Rule 3** - No spamming links, images, mentions, copypasta etc",
            "**Rule 4** - No NSFW/NSFL/Gore or any alluding content",
            "**Rule 5** - No Advertising/Unapproved Links",
            "**Rule 6** - No writing in caps",
            "**Rule 7** - Do not excessively ping any members",
            "**Rule 8** - Do not beg for roles/skins/diamonds/currency etc",
            "**Rule 9** - Server Guides/FAQ/Rules",
            "**Rule 10** - Alternate accounts are not allowed",
            "**Rule 11** - Exploitation",
            "**Rule 12** - Profiles, Banners, Avatars and About Me",
            "**Rule 13** - Drama and Arguments",
            "**Rule 14** - Cursed, ear rape and epilepsy content/posts are not allowed",
            "**Rule 15** - Third Party Terms of Service",
            "**Rule 16** - Problems with Staff",
            "**Rule 17** - Staff Discretion",
            "",
            'P.S. Just have some common sense and it will likely be fine.',
            'Extended rules description may be found by clicking "To Rules" button.',
            'By clicking "Agree To Rules" you agree to all terms specified.',
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

      // 명령어 친 사람에게 확인용 메시지
      await message.reply("✅ 규칙 패널을 이 채널에 생성했어요.");
    } catch (err) {
      console.error("!setupjoin 처리 중 에러:", err);
      await message.reply("⚠ 규칙 패널 생성 중 에러가 발생했어요. 콘솔 로그를 확인해 주세요.");
    }
  }
});

// 버튼 클릭 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "agree_rules") {
    await interaction.reply({
      content: "You agreed to the rules. Enjoy the server!",
      ephemeral: true,
    });
  } else if (interaction.customId === "to_rules") {
    await interaction.reply({
      content: "자세한 규칙은 #rules 채널을 확인해주세요! (원하면 여기 링크 넣기)",
      ephemeral: true,
    });
  } else if (interaction.customId === "help_mod") {
    await interaction.reply({
      content: "모더레이터가 곧 도와줄 거예요. 잠시만 기다려 주세요!",
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);
