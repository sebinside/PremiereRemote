/**
 * @fileoverview Replaces symlinks in node_modules/.bin with copies of their real content.
 * This is required because the UXP packager cannot handle symlinks (lol).
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const scriptsDirectoryName = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.resolve(scriptsDirectoryName, "../node_modules/.bin");

if (!fs.existsSync(binDir)) {
    console.warn(
        "✅ `node_modules/.bin` directory does not exist. Further packaging preparation skipped.",
    );
    process.exit(0);
}

for (const name of fs.readdirSync(binDir)) {
    const linkPath = path.join(binDir, name);
    if (!fs.lstatSync(linkPath).isSymbolicLink()) continue;

    const realPath = fs.realpathSync(linkPath);
    const content = fs.readFileSync(realPath);
    const mode = fs.statSync(realPath).mode;

    fs.unlinkSync(linkPath);
    fs.writeFileSync(linkPath, content, { mode });
    console.log(`Resolved: ${name}`);
}

console.log("✅ Done prepare packaging.");
console.log("➡️ Don't forget to reinstall dependencies after packaging using `pnpm install`.");
