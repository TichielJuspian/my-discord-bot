const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  console.log('메시지 감지:', `"${message.content}"`, 'from', message.author.tag);

  // !ping 그대로 유지
  if (message.content.toLowerCase().startsWith("!ping")) {
    return message.reply("Pong!");
  }

  // 여기만 테스트: !setupjoin 이라는 글자만 들어있어도 반응
  if (message.content.toLowerCase().includes("setupjoin")) {
    console.log("setupjoin 명령 감지됨");
    return message.reply("✅ setupjoin detected (test).");
  }
});

client.login(process.env.BOT_TOKEN);
