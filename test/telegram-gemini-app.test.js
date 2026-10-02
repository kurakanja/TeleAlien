const assert = require("assert");
const { isServiceUnavailable, keepRecentContents } = require("../src/app/telegram-gemini-app");

assert.equal(isServiceUnavailable({ status: 503 }), true);
assert.equal(isServiceUnavailable({ status: 429 }), false);
assert.deepEqual(keepRecentContents([{ role: "model" }, { role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }]), [{ role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }, { role: "user" }, { role: "model" }]);
