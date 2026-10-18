const fs = require("fs");
const path = require("path");

const root = __dirname;
const output = path.join(root, "dist");
const publicPaths = [
  "assets",
  "songs",
  "src",
  "index.html",
  "config.js",
  "database.js",
  "discord.js",
  "script.js",
  "theme.js"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
f 
for (const item of publicPaths) {
  fs.cpSync(path.join(root, item), path.join(output, item), { recursive: true });
}
