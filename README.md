# TeleAlien

Private Telegram assistant powered by Gemini. It keeps short-lived chat history, supports reminders and proactive check-ins, and can record Android foreground app use into `timeline-for-agent`.

## Start

```sh
npm install
cp .env.example .env
npm run start
```

## Conversation and shared memory

The default short-term conversation limit is **40 turns**. Change `TELEALIEN_GEMINI_MAX_HISTORY_TURNS` in `.env` to adjust it; larger values use more Gemini tokens with every reply. `/new` clears only this short-term conversation.

For long-term shared memory, set these two `.env` paths to the **existing files in Android shared storage**. TeleAlien reads and writes those same files directly, so you can open and edit them in Samsung My Files without creating a new memory file:

```dotenv
TELEALIEN_CHARACTER_FILE=/data/data/com.termux/files/home/storage/shared/<your-existing-folder>/gemini-character.md
TELEALIEN_USER_FILE=/data/data/com.termux/files/home/storage/shared/<your-existing-folder>/gemini-user.md
```

Shared memory remains after `/new`. Use `/memory` in Telegram to view it; ask the assistant to remember, forget, or organize something to update it. The prior version is saved beside the same file as `gemini-user.md.bak` whenever the assistant changes it.

For Android / Termux deployment, see [docs/termux-android.md](docs/termux-android.md).
