const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log("메시지 감지됨:", message.content);

  try {
    await message.reply("🔍 message detected");
  } catch (err) {
    console.error("reply error:", err);
  }
});

client.login(process.env.BOT_TOKEN);

