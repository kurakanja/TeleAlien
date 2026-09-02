const fs = require("fs");
const path = require("path");

class ReminderQueueStore {
  constructor({ filePath }) { this.filePath = filePath; this.state = { reminders: [] }; this.load(); }
  load() { try { this.state = JSON.parse(fs.readFileSync(this.filePath, "utf8")); } catch { this.state = { reminders: [] }; } this.state.reminders = Array.isArray(this.state.reminders) ? this.state.reminders : []; }
  save() { fs.mkdirSync(path.dirname(this.filePath), { recursive: true }); fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2)); }
  enqueue(reminder) { this.load(); this.state.reminders.push(reminder); this.state.reminders.sort((a, b) => a.dueAtMs - b.dueAtMs); this.save(); return reminder; }
  listDue(now = Date.now()) { this.load(); const due = this.state.reminders.filter((item) => Number(item.dueAtMs) <= now); this.state.reminders = this.state.reminders.filter((item) => Number(item.dueAtMs) > now); if (due.length) this.save(); return due; }
}

module.exports = { ReminderQueueStore };
