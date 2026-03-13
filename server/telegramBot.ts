import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import OpenAI from "openai";
import { storage } from "./storage";
import { getDriveKnowledge } from "./driveKnowledge";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_KNOWLEDGE_CHARS = 12000;
const userSessions: Map<number, { messages: { role: string; content: string }[] }> = new Map();

async function buildSystemPrompt(): Promise<string> {
  const [aiSettings, knowledgeFiles, driveKnowledge] = await Promise.all([
    storage.getAiSettings(),
    storage.getKnowledgeFiles(),
    getDriveKnowledge().catch(() => ""),
  ]);

  let knowledgeContext = "";
  let totalChars = 0;
  for (const file of knowledgeFiles) {
    if (totalChars >= MAX_KNOWLEDGE_CHARS) break;
    const snippet = file.content.slice(0, MAX_KNOWLEDGE_CHARS - totalChars);
    knowledgeContext += `\n--- ${file.originalName} ---\n${snippet}\n`;
    totalChars += snippet.length;
  }

  if (driveKnowledge && totalChars < MAX_KNOWLEDGE_CHARS) {
    const snippet = driveKnowledge.slice(0, MAX_KNOWLEDGE_CHARS - totalChars);
    knowledgeContext += `\n--- Google Drive Knowledge ---\n${snippet}\n`;
  }

  const customInstructions = aiSettings?.instructions || "";

  return `Bạn là trợ lý AI của BMT Decor - công ty thiết kế kiến trúc & nội thất hàng đầu tại TP.HCM.
Công ty: CÔNG TY TNHH TMDV BMT DECOR
Địa chỉ: 7/92 Thành Thái, P.14, Q.10, TP.HCM
Giám đốc: Võ Quốc Bảo
Website: thicongtramsac.vn

Bạn đang hỗ trợ qua Telegram bot. Hãy trả lời ngắn gọn, rõ ràng, phù hợp với chat.
Chuyên môn: thiết kế kiến trúc, nội thất, xây dựng, vật liệu, phong thủy, phối cảnh.

${customInstructions ? `\n=== Hướng dẫn riêng BMT Decor ===\n${customInstructions}\n` : ""}
${knowledgeContext ? `\n=== Kho tri thức BMT Decor ===\n${knowledgeContext}\n` : ""}

Quy tắc:
- Trả lời bằng tiếng Việt
- Câu trả lời ngắn gọn (tối đa 500 từ cho Telegram)
- Nếu câu hỏi ngoài chuyên môn, nhắc người dùng liên hệ trực tiếp
- Luôn chuyên nghiệp và nhiệt tình`;
}

async function askAI(userId: number, userMessage: string): Promise<string> {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { messages: [] });
  }

  const session = userSessions.get(userId)!;

  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-16);
  }

  session.messages.push({ role: "user", content: userMessage });

  try {
    const systemPrompt = await buildSystemPrompt();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...session.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || "Xin lỗi, tôi không thể trả lời lúc này.";
    session.messages.push({ role: "assistant", content: reply });

    return reply;
  } catch (error: any) {
    console.error("[TelegramBot] AI error:", error.message);
    return "⚠️ Có lỗi xảy ra khi kết nối AI. Vui lòng thử lại sau.";
  }
}

export function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.log("[TelegramBot] No TELEGRAM_BOT_TOKEN, skipping bot start");
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    const name = ctx.from?.first_name || "bạn";
    await ctx.reply(
      `👋 Xin chào *${name}*! Tôi là trợ lý AI của *BMT Decor*.\n\n` +
      `🏠 Tôi có thể giúp bạn:\n` +
      `• Tư vấn thiết kế kiến trúc & nội thất\n` +
      `• Giải đáp về vật liệu, màu sắc, phong thủy\n` +
      `• Tư vấn chi phí & quy trình xây dựng\n` +
      `• Giải thích các tiêu chuẩn thiết kế\n\n` +
      `💬 Hãy nhắn tin trực tiếp để bắt đầu!\n\n` +
      `📞 Liên hệ: 7/92 Thành Thái, P.14, Q.10, TP.HCM\n` +
      `🌐 Website: thicongtramsac.vn`,
      { parse_mode: "Markdown" }
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      `📚 *Hướng dẫn sử dụng BMT Decor Bot*\n\n` +
      `*Lệnh:*\n` +
      `/start - Khởi động bot\n` +
      `/help - Xem hướng dẫn\n` +
      `/new - Bắt đầu cuộc trò chuyện mới\n` +
      `/lienhe - Thông tin liên hệ BMT Decor\n\n` +
      `*Cách dùng:*\n` +
      `Nhắn tin bất kỳ câu hỏi về thiết kế kiến trúc, nội thất, vật liệu, chi phí...\n\n` +
      `*Ví dụ:*\n` +
      `• "Nhà 5x15m thiết kế 3 tầng nên bố cục thế nào?"\n` +
      `• "Phong cách Wabi Sabi phù hợp với nhà nào?"\n` +
      `• "Chi phí xây nhà 80m² khoảng bao nhiêu?"`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("new", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      userSessions.delete(userId);
    }
    await ctx.reply("🔄 Đã bắt đầu cuộc trò chuyện mới! Bạn muốn hỏi gì?");
  });

  bot.command("lienhe", async (ctx) => {
    await ctx.reply(
      `📞 *Thông tin liên hệ BMT Decor*\n\n` +
      `🏢 Công ty: CÔNG TY TNHH TMDV BMT DECOR\n` +
      `📍 Địa chỉ: 7/92 Thành Thái, P.14, Q.10, TP.HCM\n` +
      `👤 Giám đốc: Võ Quốc Bảo\n` +
      `🌐 Website: thicongtramsac.vn`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on(message("text"), async (ctx) => {
    const userId = ctx.from?.id;
    const userText = ctx.message.text;

    if (!userId) return;

    await ctx.sendChatAction("typing");

    try {
      const reply = await askAI(userId, userText);

      if (reply.length > 4096) {
        const chunks = reply.match(/.{1,4096}/gs) || [reply];
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(reply);
      }
    } catch (error: any) {
      console.error("[TelegramBot] Reply error:", error.message);
      await ctx.reply("⚠️ Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.");
    }
  });

  bot.catch((err: any, ctx: Context) => {
    console.error("[TelegramBot] Error:", err.message);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  bot.launch({
    allowedUpdates: ["message", "callback_query"],
  }).catch((err: any) => {
    console.error("[TelegramBot] ❌ Failed:", err.message);
  });

  console.log("[TelegramBot] ✅ BMT Decor Telegram Bot is LIVE!");
}
