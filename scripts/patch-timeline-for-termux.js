const fs = require("fs");
const path = require("path");

const packageDir = path.dirname(require.resolve("timeline-for-agent/package.json"));
const entryFile = path.join(packageDir, "src", "index.js");
let source = fs.readFileSync(entryFile, "utf8");
const eagerImport = 'const { runTimelineScreenshotCommand } = require("./app/timeline-screenshot-cli");\n';
const screenshotBlock = [
  'if (command === "screenshot") {',
  '    const { runTimelineScreenshotCommand } = require("./app/timeline-screenshot-cli");',
  '    await runTimelineScreenshotCommand(config);',
  '    return;',
  '  }',
].join("\n");

if (source.includes(eagerImport)) source = source.replace(eagerImport, "");
if (!source.includes(screenshotBlock)) {
  source = source.replace(
    'if (command === "screenshot") {\n    await runTimelineScreenshotCommand(config);\n    return;\n  }',
    screenshotBlock
  );
}

fs.writeFileSync(entryFile, source, "utf8");
console.log("timeline-for-agent patched: Playwright now loads only for the screenshot command.");
