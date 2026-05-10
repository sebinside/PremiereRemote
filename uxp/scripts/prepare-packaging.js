// Replaces symlinks in node_modules/.bin with copies of their real content.
// Required because the UXP packager cannot handle symlinks (lol).

const fs = require("fs");
const path = require("path");

const binDir = path.resolve(__dirname, "../node_modules/.bin");

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

console.log("Done.");
