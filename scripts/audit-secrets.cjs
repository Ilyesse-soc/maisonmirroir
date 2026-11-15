// Compares actual configured secrets in memory; reports only a key name and file, never a value.
const fs = require("node:fs"),
  path = require("node:path"),
  { parseEnv } = require("node:util"),
  { spawnSync } = require("node:child_process");
const known = [];
for (const file of [".env.local", ".qa/env.production"])
  if (fs.existsSync(file))
    for (const [k, v] of Object.entries(
      parseEnv(fs.readFileSync(file, "utf8")),
    )) {
      if (
        v.length >= 16 &&
        /SECRET|PASSWORD|PRIVATE|RESEND_API_KEY|TOKEN/.test(k) &&
        !k.startsWith("NEXT_PUBLIC_") &&
        !k.includes("ANON")
      )
        known.push([k, v]);
    }
if (fs.existsSync(".qa/runtime-secrets.json")) {
  const data = JSON.parse(fs.readFileSync(".qa/runtime-secrets.json", "utf8"));
  for (const [k, v] of Object.entries(data.secrets || {}))
    if (typeof v === "string" && v.length >= 16) known.push([k, v]);
  for (const [k, v] of Object.entries(data.setup || {}))
    known.push(["SETUP_" + k, v]);
  for (const [environment, values] of Object.entries(data.runtime || {}))
    for (const [k, v] of Object.entries(values))
      if (k.endsWith("_URL")) known.push([environment + "_" + k, v]);
}
let failed = false,
  scanned = 0;
function inspect(file) {
  const data = fs.readFileSync(file);
  scanned++;
  for (const [k, v] of known)
    if (data.includes(Buffer.from(v))) {
      console.error("Configured secret found:", k, "in", file);
      failed = true;
    }
  if (
    /^-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----$/m.test(
      data.toString("utf8"),
    )
  ) {
    console.error("Private key file found in publishable source:", file);
    failed = true;
  }
}
const source = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
);
if (source.status !== 0) throw Error("SOURCE_ENUMERATION_FAILED");
for (const file of source.stdout.split("\n").filter(Boolean))
  if (fs.existsSync(file) && fs.statSync(file).isFile()) inspect(file);
for (const root of [".next/static", ".next/standalone"])
  if (fs.existsSync(root)) {
    const walk = (directory) => {
      for (const e of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) walk(file);
        else inspect(file);
      }
    };
    walk(root);
  }
const history = spawnSync(
  "git",
  ["log", "--all", "--format=", "-p", "--", "."],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (history.status !== 0) throw Error("HISTORY_SCAN_FAILED");
for (const [k, v] of known)
  if (history.stdout.includes(v)) {
    console.error("Configured secret found in Git history:", k);
    failed = true;
  }
if (failed) process.exitCode = 1;
else
  console.log(
    "PASS: no configured private secret or private-key file found in publishable source, generated static/standalone artifacts, or available Git history. Files inspected:",
    scanned,
  );
