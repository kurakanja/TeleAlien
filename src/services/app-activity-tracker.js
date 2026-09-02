const fs = require("fs");
const path = require("path");
const { createTimelineIntegration } = require("../integrations/timeline");

class AppActivityTracker {
  constructor(config) {
    this.config = config;
    this.timeline = createTimelineIntegration(config);
    this.state = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.config.activityStoreFile, "utf8"));
      return { current: parsed?.current || null, closed: Array.isArray(parsed?.closed) ? parsed.closed : [], lastNudgeAt: Number(parsed?.lastNudgeAt) || 0 };
    } catch { return { current: null, closed: [], lastNudgeAt: 0 }; }
  }

  save() {
    fs.mkdirSync(path.dirname(this.config.activityStoreFile), { recursive: true });
    fs.writeFileSync(this.config.activityStoreFile, JSON.stringify(this.state, null, 2));
  }

  async record({ packageName = "", appName = "", at = "" } = {}) {
    const packageId = String(packageName).trim();
    if (!packageId) throw new Error("packageName is required");
    const startedAt = parseTime(at);
    const label = String(appName).trim() || packageId;
    const previous = this.state.current;
    if (previous?.packageName === packageId) return { changed: false, current: previous, closed: null };
    let closed = null;
    if (previous) {
      closed = { ...previous, endedAt: Math.max(startedAt, Number(previous.startedAt) + 1_000), synced: false };
      this.state.closed.push(closed);
    }
    this.state.current = { packageName: packageId, appName: label, startedAt };
    this.save();
    await this.syncClosed();
    return { changed: true, current: this.state.current, closed };
  }

  async syncClosed() {
    let changed = false;
    for (const activity of this.state.closed) {
      if (activity.synced) continue;
      await this.writeTimelineActivity(activity);
      activity.synced = true;
      changed = true;
    }
    if (changed) this.save();
  }

  async writeTimelineActivity(activity) {
    const start = new Date(activity.startedAt);
    const end = new Date(activity.endedAt);
    const event = { startAt: start.toISOString(), endAt: end.toISOString(), title: activity.appName, note: `手機 App 使用：${activity.packageName}`, tags: ["app-usage", activity.packageName] };
    await this.timeline.runSubcommand("write", ["--date", localDate(start, this.config.timeZone), "--events-json", JSON.stringify({ events: [event] })]);
  }

  snapshot() {
    return {
      current: this.state.current,
      recent: this.state.closed.slice(-8).map(({ packageName, appName, startedAt, endedAt }) => ({ packageName, appName, startedAt, endedAt })),
    };
  }

  claimSwitchNudge({ now = Date.now(), minGapMs = 0 } = {}) {
    if (!this.state.current || now - this.state.lastNudgeAt < minGapMs) return null;
    this.state.lastNudgeAt = now;
    this.save();
    return { type: "switch", current: this.state.current };
  }

  claimLongUseNudge({ now = Date.now(), minimumMs = 0, minGapMs = 0 } = {}) {
    const current = this.state.current;
    if (!current || now - Number(current.startedAt) < minimumMs || current.longUseNudged || now - this.state.lastNudgeAt < minGapMs) return null;
    current.longUseNudged = true;
    this.state.lastNudgeAt = now;
    this.save();
    return { type: "long_use", current, durationMs: now - Number(current.startedAt) };
  }
}

function parseTime(value) { const parsed = value ? new Date(value).getTime() : Date.now(); return Number.isFinite(parsed) ? parsed : Date.now(); }
function localDate(date, timeZone) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
module.exports = { AppActivityTracker };
