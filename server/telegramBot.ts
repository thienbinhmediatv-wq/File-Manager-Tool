import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import OpenAI from "openai";
import { storage } from "./storage";
import { getDriveKnowledge } from "./driveKnowledge";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_PASSWORD = process.env.TELEGRAM_ADMIN_PASSWORD || "BMTDecor2025";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY_DIRECT || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY_DIRECT ? "https://api.openai.com/v1" : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_KNOWLEDGE_CHARS = 12000;
const ALLOWED_EXTENSIONS = [".md", ".txt", ".json", ".csv"];
const UNLOCK_TIMEOUT = 60 * 60 * 1000; // 1 hour

const userSessions: Map<number, { messages: { role: string; content: string }[] }> = new Map();
const adminUnlocked: Map<number, { unlockedAt: number; unlockExpire: NodeJS.Timeout }> = new Map();

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

  return `Bạn là trợ lý AI của BMT Decor - công ty thiết kế kiến trúc & nội thất tại TP.HCM.
Công ty: CÔNG TY TNHH TMDV BMT DECOR
Địa chỉ: 7/92 Thành Thái, P.14, Q.10, TP.HCM
Giám đốc: Võ Quốc Bảo | Website: thicongtramsac.vn

${customInstructions ? `=== Hướng dẫn AI BMT Decor ===\n${customInstructions}\n` : ""}
${knowledgeContext ? `=== Kho tri thức BMT Decor ===\n${knowledgeContext}\n` : ""}

Quy tắc khi trả lời qua Telegram:
- Ngôn ngữ: Tiếng Việt
- Ngắn gọn, súc tích (tối đa 400 từ)
- Dùng emoji phù hợp để dễ đọc
- Chuyên môn: kiến trúc, nội thất, vật liệu, phong thủy, xây dựng
- Nếu ngoài chuyên môn → nhắc liên hệ trực tiếp BMT Decor`;
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
    return "⚠️ Có lỗi kết nối AI. Vui lòng thử lại sau.";
  }
}

async function downloadTelegramFile(fileId: string): Promise<string | null> {
  try {
    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const fileInfo = await fileInfoRes.json() as any;
    if (!fileInfo.ok || !fileInfo.result?.file_path) return null;

    const filePath = fileInfo.result.file_path;
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
    );
    if (!fileRes.ok) return null;

    return await fileRes.text();
  } catch (err: any) {
    console.error("[TelegramBot] Download error:", err.message);
    return null;
  }
}

function isAdminUnlocked(userId: number): boolean {
  if (!adminUnlocked.has(userId)) return false;
  const session = adminUnlocked.get(userId)!;
  const elapsed = Date.now() - session.unlockedAt;
  if (elapsed > UNLOCK_TIMEOUT) {
    clearTimeout(session.unlockExpire);
    adminUnlocked.delete(userId);
    return false;
  }
  return true;
}

function unlockAdmin(userId: number) {
  if (adminUnlocked.has(userId)) {
    const old = adminUnlocked.get(userId)!;
    clearTimeout(old.unlockExpire);
  }

  const timeout = setTimeout(() => {
    adminUnlocked.delete(userId);
  }, UNLOCK_TIMEOUT);

  adminUnlocked.set(userId, { unlockedAt: Date.now(), unlockExpire: timeout });
}

export function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.log("[TelegramBot] No TELEGRAM_BOT_TOKEN, skipping");
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    const name = ctx.from?.first_name || "bạn";
    await ctx.reply(
      `👋 Xin chào *${name}*! Tôi là trợ lý AI của *BMT Decor*.\n\n` +
      `🏠 Tôi có thể giúp:\n` +
      `• Tư vấn thiết kế kiến trúc & nội thất\n` +
      `• Vật liệu, màu sắc, phong thủy\n` +
      `• Chi phí & quy trình xây dựng\n` +
      `• Tiêu chuẩn thiết kế BMT Decor\n\n` +
      `💬 Nhắn tin hoặc dùng lệnh /help để biết thêm!`,
      { parse_mode: "Markdown" }
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      `📚 *Hướng dẫn BMT Decor Bot*\n\n` +
      `*Lệnh công khai:*\n` +
      `/start — Chào mừng & giới thiệu\n` +
      `/help — Xem hướng dẫn\n` +
      `/new — Cuộc trò chuyện mới\n` +
      `/lienhe — Thông tin liên hệ\n` +
      `/instructions — Xem AI Instructions hiện tại\n` +
      `/knowledge — Danh sách tri thức đã lưu\n\n` +
      `*Tư vấn AI:*\n` +
      `Nhắn tin bất kỳ câu hỏi về kiến trúc, nội thất...\n\n` +
      `*Ví dụ hỏi:*\n` +
      `• "Nhà 5x15m thiết kế 3 tầng bố cục thế nào?"\n` +
      `• "Phong cách Wabi Sabi dùng vật liệu gì?"\n` +
      `• "Chi phí xây nhà 80m² khoảng bao nhiêu?"`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("new", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) userSessions.delete(userId);
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

  bot.command("instructions", async (ctx) => {
    try {
      const aiSettings = await storage.getAiSettings();
      const instructions = aiSettings?.instructions || "";
      if (!instructions) {
        await ctx.reply("ℹ️ Chưa có AI Instructions nào được cài đặt.\nVào *Cài đặt > AI Instructions* trên web tool để thêm.", { parse_mode: "Markdown" });
        return;
      }
      const preview = instructions.length > 1000
        ? instructions.slice(0, 1000) + `\n\n...(còn ${instructions.length - 1000} ký tự nữa)`
        : instructions;
      await ctx.reply(`📋 *AI Instructions hiện tại:*\n\n${preview}`, { parse_mode: "Markdown" });
    } catch (err) {
      await ctx.reply("⚠️ Không thể đọc Instructions lúc này.");
    }
  });

  bot.command("knowledge", async (ctx) => {
    try {
      const files = await storage.getKnowledgeFiles();
      if (files.length === 0) {
        await ctx.reply("📭 Kho tri thức đang trống.\nGõ /unlock để unlock upload tri thức!");
        return;
      }
      const fileList = files.map((f, i) =>
        `${i + 1}. 📄 *${f.originalName}* (${Math.round(f.fileSize / 1024)}KB)`
      ).join("\n");

      await ctx.reply(
        `📚 *Kho Tri Thức BMT Decor* (${files.length} file)\n\n${fileList}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      await ctx.reply("⚠️ Không thể đọc danh sách tri thức lúc này.");
    }
  });

  bot.command("unlock", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message.text.split(" ").slice(1).join("");
    
    if (!args) {
      await ctx.reply(
        `🔐 *Admin Mode - Unlock tính năng upload*\n\n` +
        `Cú pháp: \`/unlock <password>\`\n\n` +
        `Ví dụ: \`/unlock mật_khẩu_của_bạn\`\n\n` +
        `⏱️ Sau unlock, bạn có 1 giờ để upload file tri thức.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (args !== ADMIN_PASSWORD) {
      await ctx.reply("❌ *Mật khẩu sai!* ❌");
      return;
    }

    unlockAdmin(userId);
    await ctx.reply(
      `✅ *Đã unlock Admin Mode!*\n\n` +
      `⏱️ Bạn có 1 giờ để upload file tri thức (.md, .txt, .json, .csv)\n` +
      `📎 Gửi file bình thường (attach file) để lưu vào kho tri thức.\n\n` +
      `_Sau 1 giờ sẽ tự động lock lại._`,
      { parse_mode: "Markdown" }
    );
    console.log(`[TelegramBot] Admin unlocked: userId=${userId}`);
  });

  bot.on(message("document"), async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const doc = ctx.message.document;
    const fileName = doc.file_name || "unknown";
    const isAdminMode = isAdminUnlocked(userId);

    if (!isAdminMode) {
      await ctx.reply(
        `🔐 *File sẽ không được lưu vào kho tri thức*\n\n` +
        `Bạn chưa unlock admin mode. Chỉ có thể trò chuyện được.\n\n` +
        `Gõ \`/unlock <password>\` để có quyền cập nhật tri thức.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const fileExt = "." + fileName.split(".").pop()?.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      await ctx.reply(
        `⚠️ *File không hỗ trợ!*\n\n` +
        `Chỉ hỗ trợ: ${ALLOWED_EXTENSIONS.join(", ")}\n` +
        `Bạn gửi: \`${fileName}\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (doc.file_size && doc.file_size > 5 * 1024 * 1024) {
      await ctx.reply("⚠️ File quá lớn! Tối đa 5MB.");
      return;
    }

    await ctx.reply(`⏳ Đang xử lý file *${fileName}*...`, { parse_mode: "Markdown" });

    try {
      const content = await downloadTelegramFile(doc.file_id);
      if (!content) {
        await ctx.reply("❌ Không thể tải file. Vui lòng thử lại.");
        return;
      }

      const trimmedContent = content.slice(0, 200000);

      await storage.createKnowledgeFile({
        name: `telegram_${Date.now()}_${fileName}`,
        originalName: fileName,
        content: trimmedContent,
        fileType: fileExt.replace(".", ""),
        fileSize: Buffer.byteLength(trimmedContent, "utf8"),
      });

      const charCount = trimmedContent.length;
      const wordCount = trimmedContent.split(/\s+/).filter(Boolean).length;

      await ctx.reply(
        `✅ *Đã lưu vào kho tri thức!*\n\n` +
        `📄 File: *${fileName}*\n` +
        `📊 Dung lượng: ${Math.round(doc.file_size! / 1024)}KB\n` +
        `✏️ Ký tự: ${charCount.toLocaleString()}\n` +
        `📝 Từ: ${wordCount.toLocaleString()}\n\n` +
        `🧠 AI của BMT Decor sẽ sử dụng tri thức này ngay lập tức!`,
        { parse_mode: "Markdown" }
      );
      console.log(`[TelegramBot] Admin uploaded: userId=${userId}, file=${fileName}`);
    } catch (err: any) {
      console.error("[TelegramBot] File save error:", err.message);
      await ctx.reply("❌ Lỗi khi lưu file. Vui lòng thử lại sau.");
    }
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

  bot.catch((err: any) => {
    console.error("[TelegramBot] Error:", err.message);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  bot.launch({
    allowedUpdates: ["message", "callback_query"],
  }).catch((err: any) => {
    console.error("[TelegramBot] ❌ Launch failed:", err.message);
  });

  console.log("[TelegramBot] ✅ BMT Decor Telegram Bot is LIVE!");
}
