// ===============================
// Gosu Custom Discord Bot (Final Build - All Features Merged)
// Discord.js v14
// ===================================

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
const GOSU_ROLE = "496717793388134410";      // Main Gosu Role (Given after Agree To Rules)
const MOD_ROLE = "495727371140202506";       // Moderator Role
const ADMIN_ROLE = "495718851288236032";     // Admin / Developer Role
const SUB_ROLE = "497654614729031681";       // Live Notification Subscriber Role

// ----------------------------------------------------
// CHAT FILTER CONFIG
// ----------------------------------------------------
let BLACKLISTED_WORDS = []; // Global array for blocked words

const FILTER_EXEMPT_ROLES = [
  MOD_ROLE, 
  ADMIN_ROLE, 
];

// ----------------------------------------------------
// Helper: Function to save JSON file (Called automatically when array changes)
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
// Helper: Function to load JSON file (Called on bot start or reload command)
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
// WELCOME / RULES / NOTIFICATION BANNERS
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
// Client
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
// Bot Ready
// --------------------
client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// =====================================================
// PREFIX COMMANDS & CHAT FILTER
// =====================================================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // ---------------------------
  // 0. COMMAND PARSING (Moved to top)
  // ---------------------------
  const args = message.content.trim().split(/ +/g);
  const cmd = args[0]?.toLowerCase();
  const isCommand = cmd && cmd.startsWith("!"); // !로 시작하면 명령어
  
  // ---------------------------
  // 1. CHAT FILTER LOGIC
  // ---------------------------
  const content = message.content.toLowerCase();
  const member = message.member;

  // Check for filter exempt roles OR if the message is a command (FIX: Exempts commands from filter)
  const isExempt = FILTER_EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId)) || isCommand;

  if (!isExempt) {
    // Convert message content to lowercase and compare with the blacklisted words
    const foundWord = BLACKLISTED_WORDS.find(word => content.includes(word));

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
  // 2. COMMAND LOGIC (Runs after filter check)
  // ---------------------------
  // Command parsing is now done at the top (cmd, args variables are already set)

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
  const adminOnly = ["!setupjoin", "!color", "!welcome", "!reloadblacklist", "!addword", "!removeword", "!listwords", "!subscriber"]; 
  if (adminOnly.includes(cmd)) {
    if (!isAdmin(message
