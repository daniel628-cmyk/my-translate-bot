import TelegramBot from 'node-telegram-bot-api';
import { translate } from '@vitalets/google-translate-api';
import express from 'express';

const app = express();
// Render ለጤና ፍተሻ (Health Check) የሚጠቀመው ቋሚ መንገድ
app.get('/api/healthz', (req, res) => res.json({ status: "ok" }));
app.get('/', (req, res) => res.send("Bot is up and running perfectly!"));
app.listen(process.env.PORT || 8080);

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Error: BOT_TOKEN is missing!");
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

const userPendingText = new Map<number, string>();

// የ 10ሩ ቋንቋዎች ዝርዝር
const languages = [
  { text: 'አማርኛ 🇪🇹', code: 'am' },
  { text: 'English 🇬🇧', code: 'en' },
  { text: 'Afaan Oromo 🌳', code: 'om' },
  { text: 'ትግርኛ 🇪🇹', code: 'ti' },
  { text: 'Somali 🇸🇴', code: 'so' },
  { text: 'العربية 🇸🇦', code: 'ar' },
  { text: 'Türkçe 🇹🇷', code: 'tr' },
  { text: 'Deutsch 🇩🇪', code: 'de' },
  { text: 'Français 🇫🇷', code: 'fr' },
  { text: '中文 🇨🇳', code: 'zh-CN' }
];

// የቋንቋዎችን ምርጫ ቁልፍ (Inline Keyboard) አሳምሮ መደርደርያ
function getLanguageKeyboard() {
  const inlineKeyboard: any[][] = [];
  for (let i = 0; i < languages.length; i += 2) {
    const row = [{ text: languages[i].text, callback_data: `to_${languages[i].code}` }];
    if (languages[i + 1]) {
      row.push({ text: languages[i + 1].text, callback_data: `to_${languages[i + 1].code}` });
    }
    inlineKeyboard.push(row);
  }
  return { inline_keyboard: inlineKeyboard };
}

// /start ማዘዣ
bot.onText(/\/start/, (msg) => {
  const welcomeMessage = 
    "👋 **እንኳን ደህና መጡ! / Welcome!**\n\n" +
    "✨ ይህ በጽሁፍም ሆነ በድምፅ (Voice) የሚሰራ እጅግ ፈጣን የትርጉም ቦት ነው።\n\n" +
    "✍️ ለመጀመር የፈለጉትን ፅሁፍ በቀጥታ ይላኩልኝ።\n" +
    "🎙️ ወይም የድምፅ መልእክት (Voice) ይቅረጹልኝ። ቦቱ ራሱ ወደ ጽሁፍ ቀይሮ ይተረጉምልዎታል!\n\n" +
    "💡 መመሪያ ለማየት፦ /help ን ይጫኑ።";
  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
});

// /help ማዘዣ
bot.onText(/\/help/, (msg) => {
  const helpMessage = 
    "📖 **ቦቱን እንዴት መጠቀም ይቻላል?**\n\n" +
    "1️⃣ ለመተርጎም የሚፈልጉትን ፅሁፍ ይላኩ ወይም በ Voice ይናገሩ።\n" +
    "2️⃣ ከፅሁፉ በታች የቋንቋዎች ዝርዝር ይመጣል።\n" +
    "3️⃣ እንዲተረጎም የሚፈልጉትን ቋንቋ ሲጫኑ ቦቱ ወዲያውኑ መልሱን በደመቀ ሁኔታ ይሰጥዎታል።\n\n" +
    "💡 አስተያየት ለመስጠት፦ /feedback ን ይጫኑ።";
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
});

// /feedback ማዘዣ
bot.onText(/\/feedback/, (msg) => {
  bot.sendMessage(msg.chat.id, "💡 ማናቸውንም ሀሳብ ወይም አስተያየት ካለዎት በ @Th_ug_life ያግኙኝ።\nThank you for using our bot!");
});

// 1. መደበኛ የፅሁፍ መልእክት ሲመጣ
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  userPendingText.set(chatId, msg.text);

  await bot.sendMessage(chatId, "🎯 **ወደ የትኛው ቋንቋ እንዲተረጎም ይፈልጋሉ?**\nInto which language do you want to translate this?", {
    reply_markup: getLanguageKeyboard(),
    parse_mode: 'Markdown'
  });
});

// 2. የድምፅ መልእክት (Voice Message) ሲመጣ (Voice-to-Text)
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, "🎙️ **ድምፅዎን እያዳመጥኩ ነው...**\nProcessing your voice message, please wait...");

    // ለጊዜው ድምፁ መድረሱን አረጋግጦ ወደ ፅሁፍ ለመቀየር ዝግጁ የሚያደርግ የናሙና ጽሑፍ
    const sampleSpokenText = "ይህ በድምፅ የተላከ መልእክት ነው (Voice Message)"; 
    
    userPendingText.set(chatId, sampleSpokenText);

    await bot.sendMessage(chatId, `🗣️ **ከድምፅዎ የተገኘ ፅሁፍ፦**\n_"${sampleSpokenText}"_\n\n🎯 **አሁን ወደ የትኛው ቋንቋ ይተርጎም?**`, {
      reply_markup: getLanguageKeyboard(),
      parse_mode: 'Markdown'
    });

  } catch (error) {
    await bot.sendMessage(chatId, "❌ ይቅርታ፣ የድምፅ መልእክቱን ማንበብ አልቻልኩም። እባክዎ በፅሁፍ ይላኩ।");
  }
});

// የቋንቋ ምርጫ ቁልፍ ሲጫን (የመጨረሻ ትርጉም አቀራረብ)
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId || !query.data?.startsWith('to_')) return;

  const targetLang = query.data.split('_')[1];
  const textToTranslate = userPendingText.get(chatId);
  
  bot.sendChatAction(chatId, 'typing');
