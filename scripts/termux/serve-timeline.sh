#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_DIR="${TELEALIEN_REPO_DIR:-$HOME/telealien}"
export TIMELINE_FOR_AGENT_STATE_DIR="${TELEALIEN_STATE_DIR:-$HOME/.telealien}"
export TIMELINE_FOR_AGENT_LOCALE="${TIMELINE_FOR_AGENT_LOCALE:-zh-CN}"
cd "$REPO_DIR"

node ./scripts/patch-timeline-for-termux.js
node ./node_modules/timeline-for-agent/bin/timeline-for-agent.js build
exec node ./node_modules/timeline-for-agent/bin/timeline-for-agent.js serve --port 4317
