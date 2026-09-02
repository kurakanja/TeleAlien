const fs = require("fs");
const path = require("path");

const MAX_MESSAGE_LENGTH = 4096;

function createTelegramChannelAdapter(config) {
  const token = String(config.telegramBotToken || "").trim();
  const apiBase = String(config.telegramApiBaseUrl || "https://api.telegram.org").replace(/\/$/, "");
  const allowedUsers = new Set((config.allowedUserIds || []).map(String));

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }

  async function call(method, body = {}, options = {}) {
    const response = await fetch(`${apiBase}/bot${token}/${method}`, {
      method: "POST",
      headers: options.headers ?? { "content-type": "application/json" },
      body: options.body || JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram ${method} failed: ${payload.description || response.status}`);
    }
    return payload.result;
  }

  function getOffset() {
    try { return Number(JSON.parse(fs.readFileSync(config.telegramUpdateOffsetFile, "utf8")).offset) || 0; } catch { return 0; }
  }

  function saveOffset(offset) {
    fs.mkdirSync(path.dirname(config.telegramUpdateOffsetFile), { recursive: true });
    fs.writeFileSync(config.telegramUpdateOffsetFile, JSON.stringify({ offset }, null, 2));
  }

  async function sendText({ userId, text }) {
    const chunks = splitText(text, MAX_MESSAGE_LENGTH);
    for (const chunk of chunks) {
      await call("sendMessage", { chat_id: userId, text: chunk, disable_web_page_preview: true });
    }
  }

  return {
    describe: () => ({ id: "telegram", kind: "channel", allowedUsers: [...allowedUsers] }),
    resolveAccount: () => ({ accountId: "telegram-bot" }),
    getKnownContextTokens: () => Object.fromEntries([...allowedUsers].map((id) => [id, "telegram"])),
    async getUpdates({ timeoutMs = 30_000 } = {}) {
      const updates = await call("getUpdates", { offset: getOffset(), timeout: Math.max(1, Math.floor(timeoutMs / 1000)), allowed_updates: ["message"] });
      if (updates.length) saveOffset(Math.max(...updates.map((item) => item.update_id)) + 1);
      return updates;
    },
    normalizeIncomingMessage(update) {
      const message = update?.message;
      const senderId = String(message?.from?.id || "");
      if (!message || message.chat?.type !== "private" || !senderId || (allowedUsers.size && !allowedUsers.has(senderId))) return null;
      return {
        accountId: "telegram-bot", workspaceId: config.workspaceId, senderId, contextToken: "telegram", provider: "telegram",
        messageId: String(message.message_id), text: String(message.text || message.caption || ""), originalText: String(message.text || message.caption || ""),
        receivedAt: new Date((message.date || Math.floor(Date.now() / 1000)) * 1000).toISOString(), raw: message,
      };
    },
    sendText,
    async sendTyping({ userId, status = 1 }) { if (status) await call("sendChatAction", { chat_id: userId, action: "typing" }); },
    async sendFile({ userId, filePath }) {
      const form = new FormData(); form.append("chat_id", String(userId)); form.append("document", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
      await call("sendDocument", {}, { body: form, headers: null });
    },
  };
}

function splitText(value, max) {
  let rest = String(value || "").trim() || "…";
  const result = [];
  while (rest.length > max) {
    const breakAt = rest.lastIndexOf("\n", max);
    const size = breakAt > 0 ? breakAt : max;
    result.push(rest.slice(0, size));
    rest = rest.slice(size).replace(/^\n/, "");
  }
  result.push(rest);
  return result;
}

module.exports = { createTelegramChannelAdapter };
