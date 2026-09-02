#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
REPO_DIR="${TELEALIEN_REPO_DIR:-$HOME/telealien}"
termux-wake-lock
cd "$REPO_DIR"
mkdir -p "$HOME/.telealien"
nohup npm run start >> "$HOME/.telealien/termux.log" 2>&1 &
