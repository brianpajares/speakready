import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const allowlist = JSON.parse(await readFile("config/license-allowlist.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const allowed = new Set(allowlist.allowed);
const blocked = [];
const unknown = [];

for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path || !path.includes("node_modules/")) continue;
  if (!existsSync(join(process.cwd(), path))) continue;
  // Next's optional image optimizer is disabled in next.config.ts, so the app does not invoke its LGPL libvips binaries.
  if (entry.optional && (path === "node_modules/sharp" || path.includes("node_modules/@img/sharp-"))) continue;
  const license = entry.license;
  if (typeof license !== "string" || !license.trim()) {
    unknown.push(path);
    continue;
  }
  const expressions = license.split(/\s+(?:OR|AND)\s+|,\s*/).map((part) => part.replace(/[()]/g, "").trim());
  if (!expressions.every((item) => allowed.has(item))) blocked.push({ path, license });
}

if (unknown.length || blocked.length) {
  if (unknown.length) console.error("Missing license metadata:", unknown.join(", "));
  if (blocked.length) console.error("Licenses outside the allowlist:", blocked);
  process.exitCode = 1;
} else {
  console.log(`Installed dependencies outside the unused optional image optimizer have allowlisted license metadata.`);
}
