# TeleAlien

[繁體中文](#繁體中文) · [English](#english)

---

<a id="繁體中文"></a>

## 繁體中文

TeleAlien 是一個只供自己私訊使用的 Telegram + Gemini 助手。它可維持短期對話脈絡、讀寫共同記憶、建立提醒，並可選擇搭配 Android 收集器記錄手機前景 App 使用情況。

> Android 監控器是**可選功能**。不安裝 APK 時，Telegram Bot、角色設定、共同記憶、提醒與一般主動關心都能正常使用。

### 功能

- 僅允許指定 Telegram 使用者 ID 私訊。
- Gemini 多 API key 輪替（免費額度或暫時失敗時嘗試下一把 key）。
- `/new` 清除本次短期對話，不清除共同記憶；`/memory` 查看共同記憶。
- AI 更新共同記憶時，會留下 `.bak` 備份。
- 回覆可自然分成 1–4 則 Telegram 訊息。
- 可選 Android 前景 App 時間軸與使用過久／切換 App 的主動關心。

### 下載與首次啟動

在電腦或 Termux 安裝 Node.js 22 以上與 Git，然後：

```bash
git clone https://github.com/<你的帳號>/telealien.git
cd telealien
npm install
cp .env.example .env
```

若從 GitHub 下載 ZIP，解壓後進入**含有 `package.json` 的那一層**資料夾，再執行上面的 `npm install` 與 `cp`。

Termux 建議放在 `~/telealien`，啟動：

```bash
bash scripts/termux/start-telealien.sh
```

電腦上則使用：

```bash
npm run start
```

### 設定 `.env`

使用 `nano .env` 編輯。**絕對不要上傳 `.env` 到 GitHub**，裡面有 Bot token 和 Gemini API key。

```dotenv
TELEGRAM_BOT_TOKEN=從BotFather取得的token
GEMINI_API_KEYS=key1,key2,key3
TELEALIEN_ALLOWED_USER_IDS=你的Telegram數字ID
TELEALIEN_GEMINI_MODEL=gemini-3.5-flash
TELEALIEN_TIME_ZONE=Asia/Taipei
```

多把 Gemini key 用**英文逗號**分隔，不需要空格。程式會在額度／暫時性錯誤時改試下一把 key；同一 Google 專案的 key 通常共用配額。

每次修改 `.env` 後，都要重啟 Bot：

```bash
pkill -f 'telealien.js' || true
bash scripts/termux/start-telealien.sh
```

### 可調整項目

| 項目 | `.env` 變數 | 預設值／說明 |
| --- | --- | --- |
| 可聊天的帳號 | `TELEALIEN_ALLOWED_USER_IDS` | Telegram 數字 ID；多個 ID 用逗號分隔。 |
| Gemini 模型 | `TELEALIEN_GEMINI_MODEL` | `gemini-3.5-flash`。 |
| API keys | `GEMINI_API_KEYS` | 多把 key 以逗號分隔；也相容單一 `GEMINI_API_KEY`。 |
| 對話脈絡上限 | `TELEALIEN_GEMINI_MAX_HISTORY_TURNS` | `40` 輪。提高可記得更久，但每次回覆會用更多 token。 |
| 時區 | `TELEALIEN_TIME_ZONE` | `Asia/Taipei`；提醒時間以此為準。 |
| 隨機主動關心 | `TELEALIEN_CHECKIN_RANGE_MINUTES` | 留空為關閉；例如 `180-360` 代表每 3–6 小時隨機一次。 |
| Bot 資料位置 | `TELEALIEN_STATE_DIR` | 預設 `~/.telealien`，保存短期對話、提醒和活動資料。 |
| 自訂 Telegram API 位址 | `TELEGRAM_API_BASE_URL` | 一般不需設定。 |

**回覆與提醒時間：** 提醒佇列約每 20 秒檢查一次（Bot 必須持續運作）；一般 Gemini 回覆沒有固定秒數，取決於網路與 API。

### 角色與共同記憶：直接在手機檔案管理員編輯

可保留原本的 `gemini-character.md` 和 `gemini-user.md`，將它們放在手機共用儲存空間，例如「我的檔案」可見的 `TeleAlien` 資料夾。再在 `.env` 指向這兩個**既有檔案**：

```dotenv
TELEALIEN_CHARACTER_FILE=/data/data/com.termux/files/home/storage/shared/TeleAlien/gemini-character.md
TELEALIEN_USER_FILE=/data/data/com.termux/files/home/storage/shared/TeleAlien/gemini-user.md
```

這樣你在 Samsung「我的檔案」修改的檔案，就是 AI 實際讀取與寫入的檔案；不需要軟連結。AI 更新共同記憶時，會把舊版保存為同資料夾的 `gemini-user.md.bak`。

若偏好軟連結，兩種方式擇一：不要同時在 `.env` 指定上述外部路徑。

```bash
mkdir -p ~/.telealien
ln -sf ~/storage/shared/TeleAlien/gemini-character.md ~/.telealien/gemini-character.md
ln -sf ~/storage/shared/TeleAlien/gemini-user.md ~/.telealien/gemini-user.md
```

### Android App 使用監控（可選）

Android 不允許 Termux 直接讀取其他 App 使用情況，因此此功能需要收集器 APK。

1. 從此 repo 的 GitHub **Releases** 下載 `app-debug.apk`（若已發布），或自行在 Android Studio 開啟 `mobile/app-usage-collector` 後 Build APK。通常輸出在：

   ```text
   mobile/app-usage-collector/app/build/outputs/apk/debug/app-debug.apk
   ```

2. 傳 APK 到手機，從「我的檔案」安裝。若 Android 阻擋，允許你使用的檔案管理員／瀏覽器「安裝未知 App」。
3. 在 `.env` 新增一串私密的本機 token：

   ```dotenv
   TELEALIEN_ACTIVITY_TRACKING_TOKEN=自行建立的一長串隨機文字
   TELEALIEN_ACTIVITY_NUDGES=true
   TELEALIEN_ACTIVITY_LONG_USE_MINUTES=45
   TELEALIEN_ACTIVITY_NUDGE_GAP_MINUTES=20
   ```

4. 重啟 TeleAlien，開啟 **TeleAlien Activity** APK：
   - 點 `Open Usage Access settings`，在 Android 設定中允許使用情況存取權。
   - 將 `.env` 的同一串 token 貼入 App。
   - 點 `Start monitoring`，並允許通知權限。
   - Samsung 使用者請將 **Termux** 和 **TeleAlien Activity** 加到「永不休眠的應用程式」。

收集器每約 15 秒檢查一次前景 App。切換到第二個 App 時，第一段使用時間才會完成並寫入時間軸。手動檢查收集器：`http://127.0.0.1:4319/`。它是同手機的本機狀態頁，不必持續開著。

可選的完整時間軸頁位於 `http://127.0.0.1:4317/`；需要查看時才在另一個 Termux session 執行：

```bash
cd ~/telealien
node scripts/patch-timeline-for-termux.js
bash scripts/termux/serve-timeline.sh
```

### Android / Termux 開機自啟

安裝 **Termux:Boot**，至少打開它一次，然後在 Termux 執行：

```bash
mkdir -p ~/.termux/boot
cp scripts/termux/boot-telealien.sh ~/.termux/boot/
chmod +x ~/.termux/boot/boot-telealien.sh
```

重開手機後查看日誌：

```bash
tail -f ~/.telealien/termux.log
```

### 技術簡述與致謝

TeleAlien 使用 Telegram Bot API 長輪詢、Gemini API、Node.js 與本機 JSON 狀態檔。Android 收集器以 Usage Access 讀取前景 App，只 POST 到同手機的 `127.0.0.1`，不會主動把使用資料傳到外部伺服器。

本專案改寫自 [WenXiaoWendy/cyberboss](https://github.com/WenXiaoWendy/cyberboss)，時間軸功能使用 [WenXiaoWendy/timeline-for-agent](https://github.com/WenXiaoWendy/timeline-for-agent)。感謝原作者與貢獻者。

---

<a id="english"></a>

## English

TeleAlien is a private Telegram + Gemini assistant for personal direct messages. It keeps short-term conversation context, reads and updates shared memory, creates reminders, and can optionally track Android foreground-app usage.

> The Android monitor is **optional**. The Telegram bot, character file, shared memory, reminders, and normal proactive check-ins work without installing the APK.

### Quick start

```bash
git clone https://github.com/<your-account>/telealien.git
cd telealien
npm install
cp .env.example .env
npm run start
```

On Termux, use `~/telealien` and start with:

```bash
bash scripts/termux/start-telealien.sh
```

Edit `.env` with `nano .env`. Never commit it: it contains private credentials.

```dotenv
TELEGRAM_BOT_TOKEN=your_botfather_token
GEMINI_API_KEYS=key1,key2,key3
TELEALIEN_ALLOWED_USER_IDS=your_numeric_telegram_id
TELEALIEN_GEMINI_MODEL=gemini-3.5-flash
TELEALIEN_TIME_ZONE=Asia/Taipei
```

Separate Gemini keys with commas. TeleAlien tries the next key after quota or temporary API errors. Restart after any `.env` change:

```bash
pkill -f 'telealien.js' || true
bash scripts/termux/start-telealien.sh
```

### What you can configure

| Setting | Environment variable | Notes |
| --- | --- | --- |
| Allowed users | `TELEALIEN_ALLOWED_USER_IDS` | Numeric Telegram IDs, comma-separated. |
| Gemini model | `TELEALIEN_GEMINI_MODEL` | Default: `gemini-3.5-flash`. |
| API-key rotation | `GEMINI_API_KEYS` | Comma-separated keys; single `GEMINI_API_KEY` also works. |
| Context limit | `TELEALIEN_GEMINI_MAX_HISTORY_TURNS` | Default: `40` turns. Higher values cost more tokens per reply. |
| Time zone | `TELEALIEN_TIME_ZONE` | Default: `Asia/Taipei`. |
| Random proactive check-ins | `TELEALIEN_CHECKIN_RANGE_MINUTES` | Empty disables it; `180-360` means a random 3–6 hour interval. |
| State directory | `TELEALIEN_STATE_DIR` | Default: `~/.telealien`. |
| Activity monitor | `TELEALIEN_ACTIVITY_*` | Optional; see below. |

`/new` clears only short-term context. `/memory` displays shared memory. Memory updates keep a `.bak` copy. Reminder checks run about every 20 seconds while the bot is running; normal Gemini response timing depends on network and API availability.

### Edit character and memory from the phone

Point TeleAlien to your existing files in Android shared storage. These same files can then be edited in Samsung My Files—no symlink is required:

```dotenv
TELEALIEN_CHARACTER_FILE=/data/data/com.termux/files/home/storage/shared/TeleAlien/gemini-character.md
TELEALIEN_USER_FILE=/data/data/com.termux/files/home/storage/shared/TeleAlien/gemini-user.md
```

If you prefer symlinks instead, do not set those two variables. Use:

```bash
mkdir -p ~/.telealien
ln -sf ~/storage/shared/TeleAlien/gemini-character.md ~/.telealien/gemini-character.md
ln -sf ~/storage/shared/TeleAlien/gemini-user.md ~/.telealien/gemini-user.md
```

### Optional Android activity monitor

Download `app-debug.apk` from this repository's GitHub Releases when available, or build `mobile/app-usage-collector` with Android Studio. The usual debug APK output is:

```text
mobile/app-usage-collector/app/build/outputs/apk/debug/app-debug.apk
```

Install it on the phone, then set and restart with a private local token:

```dotenv
TELEALIEN_ACTIVITY_TRACKING_TOKEN=a-long-random-secret
TELEALIEN_ACTIVITY_NUDGES=true
TELEALIEN_ACTIVITY_LONG_USE_MINUTES=45
TELEALIEN_ACTIVITY_NUDGE_GAP_MINUTES=20
```

Open **TeleAlien Activity**, grant Usage Access, paste the same token, allow notifications, and press **Start monitoring**. On Samsung, add both Termux and TeleAlien Activity to Never sleeping apps. Check its local-only status page at `http://127.0.0.1:4319/`; the optional full timeline dashboard is served at port `4317` using `bash scripts/termux/serve-timeline.sh`.

### Credits

TeleAlien is adapted from [WenXiaoWendy/cyberboss](https://github.com/WenXiaoWendy/cyberboss) and uses [WenXiaoWendy/timeline-for-agent](https://github.com/WenXiaoWendy/timeline-for-agent) for timeline support.
