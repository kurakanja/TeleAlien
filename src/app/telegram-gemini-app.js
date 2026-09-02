const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createTelegramChannelAdapter } = require("../adapters/channel/telegram");
const { ReminderQueueStore } = require("../core/reminder-queue-store");
const { AppActivityTracker } = require("../services/app-activity-tracker");

class TelegramGeminiApp {
  constructor(config) {
    this.config = config;
    this.channel = createTelegramChannelAdapter(config);
    this.reminders = new ReminderQueueStore({ filePath: config.reminderQueueFile });
    this.activityTracker = new AppActivityTracker(config);
    this.history = this.loadHistory();
    this.running = false;
  }

  loadHistory() {
    try { return JSON.parse(fs.readFileSync(this.config.geminiHistoryFile, "utf8")); } catch { return {}; }
  }

  saveHistory() {
    fs.mkdirSync(path.dirname(this.config.geminiHistoryFile), { recursive: true });
    fs.writeFileSync(this.config.geminiHistoryFile, JSON.stringify(this.history, null, 2));
  }

  async start() {
    this.running = true;
    this.startActivityServer();
    this.startReminderLoop();
    this.startCheckinLoop();
    this.startActivityNudgeLoop();
    console.log("[telealien] Telegram + Gemini bridge started; private messages only.");
    while (this.running) {
      try {
        const updates = await this.channel.getUpdates();
        for (const update of updates) await this.handleUpdate(update);
      } catch (error) {
        console.error(`[telealien] Telegram poll failed: ${error.message}`);
        await wait(2_000);
      }
    }
  }

  async handleUpdate(update) {
    const message = this.channel.normalizeIncomingMessage(update);
    if (!message) return;
    if (/^\/start\b/.test(message.text)) {
      return this.channel.sendText({ userId: message.senderId, text: "TeleAlien \u5df2\u555f\u52d5\u3002\u76f4\u63a5\u50b3\u8a0a\u606f\u5373\u53ef\uff1b/new \u53ef\u6e05\u9664\u672c\u6b21\u5c0d\u8a71\u8a18\u61b6\u3002" });
    }
    if (/^\/new\b/.test(message.text)) {
      delete this.history[message.senderId];
      this.saveHistory();
      return this.channel.sendText({ userId: message.senderId, text: "\u5df2\u958b\u59cb\u65b0\u5c0d\u8a71\u3002" });
    }
    if (/^\/memory\b/.test(message.text)) {
      const memory = this.readUserMemory();
      return this.channel.sendText({ userId: message.senderId, text: memory || "\u76ee\u524d\u6c92\u6709\u5df2\u5132\u5b58\u7684\u5171\u540c\u8a18\u61b6\u3002" });
    }
    await this.channel.sendTyping({ userId: message.senderId }).catch(() => {});
    try { await this.reply(message.senderId, message.text); }
    catch (error) { await this.channel.sendText({ userId: message.senderId, text: `\u8acb\u6c42\u5931\u6557\uff1a${error.message}` }); }
  }

  async reply(userId, text, { proactive = false } = {}) {
    let contents = [...(Array.isArray(this.history[userId]) ? this.history[userId] : []), { role: "user", parts: [{ text }] }];
    for (let round = 0; round < 6; round += 1) {
      const result = await this.generate(contents, { proactive });
      const parts = result?.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((part) => part.functionCall);
      if (!calls.length) {
        const answer = parts.map((part) => part.text || "").join("").trim() || "\u6211\u76ee\u524d\u6c92\u6709\u7522\u751f\u56de\u8986\u3002";
        this.history[userId] = [...contents, { role: "model", parts }].slice(-this.config.geminiMaxHistoryTurns * 2);
        this.saveHistory();
        await this.channel.sendText({ userId, text: answer });
        return;
      }

      contents.push({ role: "model", parts });
      if (calls.some((part) => part.functionCall?.name === "stay_silent")) {
        this.history[userId] = contents.slice(-this.config.geminiMaxHistoryTurns * 2);
        this.saveHistory();
        return;
      }
      const delivery = calls.find((part) => part.functionCall?.name === "deliver_messages");
      if (delivery) {
        const messages = normalizeDeliveryMessages(delivery.functionCall.args?.messages);
        if (!messages.length) throw new Error("\u6a21\u578b\u56de\u8986\u683c\u5f0f\u4e0d\u6b63\u78ba\uff0c\u8acb\u518d\u8a66\u4e00\u6b21\u3002");
        for (const part of calls) {
          if (part === delivery) continue;
          await this.invokeFunction(userId, part.functionCall.name, part.functionCall.args || {});
        }
        this.history[userId] = contents.slice(-this.config.geminiMaxHistoryTurns * 2);
        this.saveHistory();
        for (const message of messages) await this.channel.sendText({ userId, text: message });
        return;
      }

      const responses = [];
      for (const part of calls) {
        responses.push({ functionResponse: { name: part.functionCall.name, response: await this.invokeFunction(userId, part.functionCall.name, part.functionCall.args || {}) } });
      }
      contents.push({ role: "user", parts: responses });
    }
    throw new Error("\u6a21\u578b\u5de5\u5177\u547c\u53eb\u6b21\u6578\u904e\u591a\uff0c\u8acb\u63db\u500b\u65b9\u5f0f\u518d\u8a66\u4e00\u6b21\u3002");
  }

  async generate(contents, { proactive = false } = {}) {
    const body = { systemInstruction: { parts: [{ text: this.buildSystemPrompt({ proactive }) }] }, contents, tools: [{ functionDeclarations: toolDeclarations() }] };
    return this.withGeminiKey(async (key) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.geminiModel)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    });
  }

  async withGeminiKey(request) {
    const keys = this.config.geminiApiKeys;
    if (!keys.length) throw new Error("GEMINI_API_KEYS is required.");
    let lastError;
    for (const [index, key] of keys.entries()) {
      try { return await request(key); }
      catch (error) {
        lastError = error;
        if (!isRotatableGeminiKeyError(error)) throw error;
        console.warn(`[telealien] Gemini key ${index + 1}/${keys.length} unavailable (${error.status || "network"}); trying the next key.`);
      }
    }
    throw new Error(`\u6240\u6709 Gemini API \u91d1\u9470\u90fd\u7121\u6cd5\u4f7f\u7528\uff1a${lastError?.message || "\u672a\u77e5\u932f\u8aa4"}`);
  }

  async invokeFunction(userId, name, args) {
    if (name === "create_reminder") {
      const minutes = Number(args.delayMinutes);
      if (!Number.isInteger(minutes) || minutes < 1) return { error: "delayMinutes must be a positive integer." };
      const item = this.reminders.enqueue({ id: crypto.randomUUID(), accountId: "telegram-bot", senderId: userId, contextToken: "telegram", text: String(args.text || "").trim(), dueAtMs: Date.now() + minutes * 60_000, createdAt: new Date().toISOString() });
      return { ok: true, dueAtLocal: formatLocalTime(item.dueAtMs, this.config.timeZone), timeZone: this.config.timeZone };
    }
    if (name === "send_proactive_message") {
      await this.channel.sendText({ userId, text: String(args.text || "") });
      return { ok: true };
    }
    if (name === "get_current_activity") return this.activityTracker.snapshot();
    if (name === "read_user_memory") return { content: this.readUserMemory() };
    if (name === "update_user_memory") {
      const content = String(args.content || "").trim();
      if (!content) return { error: "content must not be empty" };
      if (content.length > 16_000) return { error: "content is too long" };
      this.writeUserMemory(content);
      return { ok: true, chars: content.length };
    }
    return { error: "Unknown function" };
  }

  startReminderLoop() { setInterval(() => this.flushReminders().catch((error) => console.error(`[telealien] reminder failed: ${error.message}`)), 20_000).unref(); }
  async flushReminders() { for (const reminder of this.reminders.listDue()) await this.channel.sendText({ userId: reminder.senderId, text: `\u63d0\u9192\uff1a${reminder.text}` }); }

  startCheckinLoop() {
    const match = String(this.config.checkinRangeMinutes || "").match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return;
    const schedule = async () => {
      const min = Number(match[1]); const max = Number(match[2]);
      await wait((min + Math.floor(Math.random() * (max - min + 1))) * 60_000);
      for (const userId of this.config.allowedUserIds) await this.reply(String(userId), "\u8acb\u4e3b\u52d5\u95dc\u5fc3\u6211\u4e00\u4e0b\uff1b\u5982\u679c\u6c92\u6709\u5fc5\u8981\uff0c\u7c21\u77ed\u5730\u8aaa\u8072\u554f\u5019\u5373\u53ef\u3002");
      if (this.running) void schedule();
    };
    void schedule();
  }

  startActivityServer() {
    if (!this.config.activityTrackingToken || this.activityServer) return;
    this.activityServer = http.createServer(async (request, response) => {
      if (request.method === "GET" && request.url === "/") return respondActivityDashboard(response, this.activityTracker.snapshot());
      if (request.method === "GET" && request.url === "/healthz") return respondJson(response, 200, { ok: true, activity: this.activityTracker.snapshot() });
      if (request.method !== "POST" || request.url !== "/activity") return respondJson(response, 404, { error: "Not found" });
      if (request.headers.authorization !== `Bearer ${this.config.activityTrackingToken}`) return respondJson(response, 401, { error: "Unauthorized" });
      try {
        const result = await this.activityTracker.record(await readJsonBody(request));
        if (result.closed) void this.handleActivityNudge(this.activityTracker.claimSwitchNudge({ minGapMs: this.activityNudgeGapMs() }));
        respondJson(response, 200, { ok: true, ...result });
      }
      catch (error) { respondJson(response, 400, { error: error.message }); }
    });
    this.activityServer.listen(this.config.activityTrackingPort, this.config.activityTrackingHost, () => console.log(`[telealien] app-activity ingest=http://${this.config.activityTrackingHost}:${this.config.activityTrackingPort}/activity`));
  }

  startActivityNudgeLoop() {
    if (!this.config.activityNudgesEnabled) return;
    setInterval(() => {
      const signal = this.activityTracker.claimLongUseNudge({ minimumMs: this.config.activityLongUseMinutes * 60_000, minGapMs: this.activityNudgeGapMs() });
      void this.handleActivityNudge(signal);
    }, 60_000).unref();
  }

  activityNudgeGapMs() { return this.config.activityNudgeGapMinutes * 60_000; }

  async handleActivityNudge(signal) {
    if (!this.config.activityNudgesEnabled || !signal || !this.config.allowedUserIds.length) return;
    const current = signal.current;
    const duration = signal.type === "long_use" ? ` for ${Math.round(signal.durationMs / 60_000)} minutes` : "";
    const trigger = `[SYSTEM ACTIVITY SIGNAL] The user ${signal.type === "long_use" ? "has stayed in" : "switched to"} ${current.appName || current.packageName}${duration}. This is not a user message. Decide whether a brief, useful check-in would help. If not, call stay_silent. If yes, call deliver_messages with exactly one natural short message.`;
    try { await this.reply(String(this.config.allowedUserIds[0]), trigger, { proactive: true }); }
    catch (error) { console.error(`[telealien] activity nudge failed: ${error.message}`); }
  }

  buildSystemPrompt({ proactive = false } = {}) {
    const character = readTextFile(this.config.characterFile);
    const user = readTextFile(this.config.userFile);
    return [
      "You are TeleAlien, a private Telegram assistant. Reply in the user's language. You may create reminders and send proactive messages using the provided functions. Never claim a function succeeded until its result says so. Keep replies concise.",
      "For every normal chat reply, finish by calling deliver_messages exactly once. Choose 1 to 4 short, complete chat bubbles naturally; default to one. A second or later bubble must add a distinct thought, reaction, question, or natural pause. Never split one paragraph, sentence, list, or explanation merely to create multiple messages. Do not always use the same number of bubbles.",
      "When the user asks what they are using or how they spent recent phone time, call get_current_activity before replying. Do not invent phone activity.",
      "The user context and long-term memory below is the durable source of truth. When the user explicitly asks you to remember, forget, or organize it, call update_user_memory with the complete revised Markdown. You may also update it when the user clearly states a durable goal, preference, project, important person, or standing instruction. Keep it concise and organized. Never store API keys, passwords, one-time details, or sensitive facts the user has not asked you to retain. Do not change it for ordinary small talk.",
      `Current local time: ${formatLocalTime(Date.now(), this.config.timeZone)} (${this.config.timeZone}). All relative times, including reminders, use this time zone.`,
      "Character:\n" + character,
      "User context and long-term memory:\n" + user,
      proactive ? "This is a proactive system activity signal, not a user message. Either call stay_silent or send exactly one short, humane check-in with deliver_messages. Do not lecture, summarize data, or mention internal tools." : "",
    ].join("\n\n");
  }

  readUserMemory() { return readTextFile(this.config.userFile); }

  writeUserMemory(content) {
    const target = this.config.userFile;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${content.trim()}\n`, "utf8");
    fs.renameSync(temporary, target);
  }
}

function toolDeclarations() {
  return [
    { name: "create_reminder", description: "Create a one-time reminder for the user.", parameters: { type: "OBJECT", properties: { text: { type: "STRING" }, delayMinutes: { type: "INTEGER" } }, required: ["text", "delayMinutes"] } },
    { name: "send_proactive_message", description: "Send a message to the user without waiting for a normal reply.", parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] } },
    { name: "get_current_activity", description: "Read the currently tracked Android foreground app and recent completed app-use blocks. Use this only for questions about phone activity or time use.", parameters: { type: "OBJECT", properties: {} } },
    { name: "read_user_memory", description: "Read the durable user context and long-term shared memory.", parameters: { type: "OBJECT", properties: {} } },
    { name: "update_user_memory", description: "Replace the complete durable user context and long-term shared memory with concise, organized Markdown. Use for user-approved memory updates and durable goals or preferences only.", parameters: { type: "OBJECT", properties: { content: { type: "STRING", description: "Complete replacement Markdown for the shared user memory." } }, required: ["content"] } },
    { name: "stay_silent", description: "For a proactive system signal only, choose not to send a message because no interruption is useful.", parameters: { type: "OBJECT", properties: {} } },
    { name: "deliver_messages", description: "Deliver the final reply as 1 to 4 natural, complete Telegram chat bubbles. Use one by default. Do not split a paragraph or sentence just to create more bubbles.", parameters: { type: "OBJECT", properties: { messages: { type: "ARRAY", items: { type: "STRING" }, description: "One to four complete, concise chat messages." } }, required: ["messages"] } },
  ];
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function readTextFile(filePath) { try { return fs.readFileSync(filePath, "utf8").trim(); } catch { return ""; } }
function formatLocalTime(value, timeZone) { return new Intl.DateTimeFormat("zh-TW", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)).replace(/\//g, "-"); }
function isRotatableGeminiKeyError(error) { return [400, 401, 403, 429, 500, 502, 503, 504].includes(Number(error?.status)); }
function normalizeDeliveryMessages(value) { return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4) : []; }
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 32_768) request.destroy(new Error("Request too large")); });
    request.once("error", reject);
    request.once("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); } });
  });
}
function respondJson(response, status, body) { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); }
function respondActivityDashboard(response, activity) {
  const current = activity.current;
  const app = current?.appName || current?.packageName || "尚未收到手機回報";
  const since = current ? new Date(Number(current.startedAt)).toLocaleString("zh-TW", { hour12: false }) : "-";
  const latest = activity.recent.at(-1);
  const last = latest ? `${latest.appName || latest.packageName}（${new Date(Number(latest.endedAt)).toLocaleTimeString("zh-TW", { hour12: false })}）` : "尚無已結束的紀錄";
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>TeleAlien 狀態</title><style>body{font:16px system-ui;max-width:560px;margin:48px auto;padding:0 20px;color:#222}article{border:1px solid #ddd;border-radius:14px;padding:20px}small{color:#666}strong{display:block;margin:8px 0;font-size:22px}</style><article><small>TeleAlien Android 時間軸</small><h1>收集器運作中</h1><small>目前偵測到的 App</small><strong>${escapeHtml(app)}</strong><small>開始：${escapeHtml(since)}<br>最近完成：${escapeHtml(last)}</small></article>`);
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

module.exports = { TelegramGeminiApp };
