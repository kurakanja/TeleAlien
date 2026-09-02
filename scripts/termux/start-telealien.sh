#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
REPO_DIR="${TELEALIEN_REPO_DIR:-$HOME/telealien}"
cd "$REPO_DIR"
termux-wake-lock
exec npm run start
