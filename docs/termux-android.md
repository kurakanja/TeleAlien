# Android / Termux deployment

## Run the bot on the phone

Install **Termux** and **Termux:Boot** from the same source (F-Droid is recommended). In Termux:

```sh
pkg update && pkg upgrade
pkg install nodejs-lts git curl
```

Clone **this modified TeleAlien repository** into `$HOME/telealien` (or transfer that folder from the computer). Do not clone the original upstream repository, because it does not contain the Telegram and Android changes. Then run:

```sh
cd "$HOME/telealien"
npm install
cp .env.example .env
```

Copy the tested `.env` values manually, then run:

```sh
bash scripts/termux/start-telealien.sh
```

### Keep character and shared memory editable in phone storage

If you already have the old `gemini-character.md` and `gemini-user.md` in your phone's shared-storage folder, keep them there; do **not** make new files or symlinks. Add their direct Termux paths to `.env`, replacing `<your-existing-folder>` with the folder that already contains them:

```dotenv
TELEALIEN_CHARACTER_FILE=/data/data/com.termux/files/home/storage/shared/<your-existing-folder>/gemini-character.md
TELEALIEN_USER_FILE=/data/data/com.termux/files/home/storage/shared/<your-existing-folder>/gemini-user.md
```

You can then view and edit both files with Samsung **My Files**. TeleAlien will update that same `gemini-user.md` when it saves shared memory and retain a `.bak` copy beside it.

Disable battery optimisation for Termux. To start after reboot, open Termux:Boot once, then:

```sh
mkdir -p "$HOME/.termux/boot"
cp scripts/termux/boot-telealien.sh "$HOME/.termux/boot/"
chmod +x "$HOME/.termux/boot/boot-telealien.sh"
```

## App-usage collection protocol

Android does not let Termux read other apps' usage directly. A collector with **Usage Access** permission must send a local event whenever the foreground app changes. Add a long random value to `.env`:

```dotenv
TELEALIEN_ACTIVITY_TRACKING_TOKEN=replace-with-a-long-random-secret
```

The collector sends this only to the same phone:

```http
POST http://127.0.0.1:4319/activity
Authorization: Bearer <TELEALIEN_ACTIVITY_TRACKING_TOKEN>
Content-Type: application/json

{"packageName":"com.example.app","appName":"Example App","at":"2026-08-07T16:43:00+08:00"}
```

Each changed App closes the preceding time block; closed blocks are written through `timeline-for-agent` with the `app-usage` tag. The health endpoint is `GET http://127.0.0.1:4319/healthz`. For a small manual status page, open `http://127.0.0.1:4319/` in the phone browser; it shows the current App and the most recently closed block. It does not need to stay open.

To let the bot consider a proactive check-in after a long stay in one App or an App switch, set these in `.env` and restart TeleAlien:

```dotenv
TELEALIEN_ACTIVITY_NUDGES=true
TELEALIEN_ACTIVITY_LONG_USE_MINUTES=45
TELEALIEN_ACTIVITY_NUDGE_GAP_MINUTES=20
```

The cooldown applies to both triggers. The model is allowed to remain silent when an interruption would not help.

### Verify the local timeline receiver before installing the companion app

Keep `npm run start` running in one Termux session. In a second session, load the token from the bot configuration and send two different foreground-app events:

```sh
cd ~/telealien
set -a
. ./.env
set +a

curl -s -X POST http://127.0.0.1:4319/activity \
  -H "Authorization: Bearer $TELEALIEN_ACTIVITY_TRACKING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packageName":"com.example.first","appName":"First test app","at":"2026-08-08T12:00:00+08:00"}'

curl -s -X POST http://127.0.0.1:4319/activity \
  -H "Authorization: Bearer $TELEALIEN_ACTIVITY_TRACKING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packageName":"com.example.second","appName":"Second test app","at":"2026-08-08T12:05:00+08:00"}'
```

The first event becomes the active app; the second closes it and writes the five-minute block into the local timeline. A `200` response means the receiver accepted the event. The bot terminal should not show a timeline error.

## Open the timeline dashboard on the phone

After at least one completed app block exists, open a new Termux session and run:

```sh
cd ~/telealien
node scripts/patch-timeline-for-termux.js
bash scripts/termux/serve-timeline.sh
```

Keep this session open, then open this address in the phone browser:

```text
http://127.0.0.1:4317
```

This dashboard is available only on the same phone. Stop it with `Ctrl+C` when finished.

The next component is a small Android collector app (or a Tasker profile) with Usage Access permission. Do not expose port 4319 to Wi-Fi or the internet.

## Native collector for Samsung S23 FE

The companion Android Studio project is in `mobile/app-usage-collector`. Build and install its debug APK from a computer. Open it once, grant **Usage Access** and notification permission, then use **Start monitoring**. On Samsung, also set the app and Termux to **Never sleeping apps**.

Before pressing Start, paste the same `TELEALIEN_ACTIVITY_TRACKING_TOKEN` from Termux `.env` into the companion app's token field. This token keeps the localhost receiver private.
