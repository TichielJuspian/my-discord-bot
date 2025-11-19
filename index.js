const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
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

/**
 * 1. 규칙 패널 생성 명령어
 * #join 채널에서 관리자 계정으로:
 *   !setupjoin
 * 을 치면, 스샷처럼 임베드 + 버튼 3개가 생성됨.
 */
client.on("messageCreate", async (message) => {
  // DM, 봇 메시지는 무시
  if (!message.guild || message.author.bot) return;

  // 테스트용 ping
  if (message.content === "!ping") {
    return message.reply("Pong!");
  }

  // 규칙 패널 설치 명령어
  if (message.content === "!setupjoin") {
    // 관리자 권한 체크
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return message.reply("이 명령어는 관리자만 사용할 수 있어요.");
    }

    // ---- 임베드 내용 (필요하면 자유롭게 수정 가능) ----
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
          "P.S. Just have some common sense and it will likely be fine.",
          'Extended rules description may be found by clicking "To Rules" button.',
          'By clicking "Agree To Rules" you agree to all terms specified.',
        ].join("\n")
      )
      .setColor(0x5865f2); // 디스코드 보라색 느낌

    // ---- 버튼 3개 ----
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
    return message.reply("✅ 규칙 패널을 이 채널에 생성했어요.").then((m) => {
      setTimeout(() => m.delete().catch(() => {}), 5000);
    });
  }
});

/**
 * 2. 버튼 클릭 처리 (지금은 간단한 반응만)
 *   - 나중에 여기에서 'Agree' 누르면 역할 부여 기능 추가 가능.
 */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "agree_rules") {
    // TODO: 여기서 역할 부여 기능 추가 가능 (나중에)
    await interaction.reply({
      content: "You agreed to the rules. Enjoy the server!",
      ephemeral: true,
    });
  } else if (interaction.customId === "to_rules") {
    await interaction.reply({
      content: "자세한 규칙은 #rules 채널을 확인해주세요! (또는 링크/설명 추가)",
      ephemeral: true,
    });
  } else if (interaction.customId === "help_mod") {
    // 여기서 원하는 모드 역할/채널을 멘션해도 됨
    await interaction.reply({
      content: "모더레이터가 곧 도와줄 거예요. 잠시만 기다려 주세요!",
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);
