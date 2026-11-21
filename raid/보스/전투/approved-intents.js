const runtimePaths = require("../../runtime-paths.cjs");
const {GatewayIntentBits}=require('discord.js');
function approvedIntents(application) {
  const flags=BigInt(application.flags_new||application.flags||0),small=Number.isInteger(application.approximate_guild_count)&&application.approximate_guild_count<100;
  const approved=(full,limited)=>!!(flags&(1n<<BigInt(full)))||(small&&!!(flags&(1n<<BigInt(limited))));
  return [GatewayIntentBits.Guilds,...(approved(14,15)?[GatewayIntentBits.GuildMembers]:[]),...(approved(18,19)?[GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]:[])];
}
module.exports={approvedIntents};
