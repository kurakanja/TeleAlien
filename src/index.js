const fs = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");
const { readConfig } = require("./core/config");
const { TelegramGeminiApp } = require("./app/telegram-gemini-app");

function loadEnv() {
  const candidates = [path.join(process.cwd(), ".env"), path.join(os.homedir(), ".telealien", ".env")];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) { dotenv.config({ path: filePath }); return; }
  }
}

async function main() {
  loadEnv();
  const config = readConfig();
  const command = config.mode || "help";
  if (["help", "--help", "-h"].includes(command)) {
    console.log("Usage: telealien start\n\nTelegram + Gemini personal assistant.");
    return;
  }
  if (command !== "start") throw new Error(`Unknown command: ${command}`);
  await new TelegramGeminiApp(config).start();
}

module.exports = { main };
