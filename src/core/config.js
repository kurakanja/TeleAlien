const os = require("os");
const path = require("path");

function readConfig() {
  const argv = process.argv.slice(2);
  const stateDir = readTextEnv("TELEALIEN_STATE_DIR") || path.join(os.homedir(), ".telealien");
  return {
    mode: argv[0] || "",
    stateDir,
    workspaceId: readTextEnv("TELEALIEN_WORKSPACE_ID") || "default",
    allowedUserIds: readListEnv("TELEALIEN_ALLOWED_USER_IDS"),
    telegramBotToken: readTextEnv("TELEGRAM_BOT_TOKEN"),
    telegramApiBaseUrl: readTextEnv("TELEGRAM_API_BASE_URL") || "https://api.telegram.org",
    telegramUpdateOffsetFile: path.join(stateDir, "telegram-update-offset.json"),
    geminiApiKeys: readListEnv("GEMINI_API_KEYS").length ? readListEnv("GEMINI_API_KEYS") : readListEnv("GEMINI_API_KEY"),
    geminiModel: readTextEnv("TELEALIEN_GEMINI_MODEL") || "gemini-3.5-flash",
    geminiHistoryFile: path.join(stateDir, "gemini-history.json"),
    // Change TELEALIEN_GEMINI_MAX_HISTORY_TURNS in .env to adjust this. More turns use more API tokens.
    geminiMaxHistoryTurns: readIntEnv("TELEALIEN_GEMINI_MAX_HISTORY_TURNS") || 40,
    // Point these at the existing files in shared storage to edit/read memory directly from the phone.
    characterFile: readTextEnv("TELEALIEN_CHARACTER_FILE") || path.join(stateDir, "gemini-character.md"),
    userFile: readTextEnv("TELEALIEN_USER_FILE") || path.join(stateDir, "gemini-user.md"),
    timeZone: readTextEnv("TELEALIEN_TIME_ZONE") || "Asia/Taipei",
    checkinRangeMinutes: readTextEnv("TELEALIEN_CHECKIN_RANGE_MINUTES"),
    reminderQueueFile: path.join(stateDir, "reminder-queue.json"),
    activityTrackingToken: readTextEnv("TELEALIEN_ACTIVITY_TRACKING_TOKEN"),
    activityTrackingHost: readTextEnv("TELEALIEN_ACTIVITY_TRACKING_HOST") || "127.0.0.1",
    activityTrackingPort: readIntEnv("TELEALIEN_ACTIVITY_TRACKING_PORT") || 4319,
    activityStoreFile: path.join(stateDir, "app-activity.json"),
    activityNudgesEnabled: readBoolEnv("TELEALIEN_ACTIVITY_NUDGES"),
    activityLongUseMinutes: readIntEnv("TELEALIEN_ACTIVITY_LONG_USE_MINUTES") || 45,
    activityNudgeGapMinutes: readIntEnv("TELEALIEN_ACTIVITY_NUDGE_GAP_MINUTES") || 20,
  };
}

function readListEnv(name) { return String(process.env[name] || "").split(",").map((item) => item.trim()).filter(Boolean); }
function readTextEnv(name) { return typeof process.env[name] === "string" ? process.env[name].trim() : ""; }
function readIntEnv(name) { const value = Number.parseInt(readTextEnv(name), 10); return Number.isFinite(value) ? value : undefined; }
function readBoolEnv(name) { return ["1", "true", "yes", "on"].includes(readTextEnv(name).toLowerCase()); }

module.exports = { readConfig };
