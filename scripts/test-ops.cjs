const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { spawnSync } = require("node:child_process");
const result = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    "ops/.env.example",
    "-f",
    "ops/compose.yml",
    "--profile",
    "*",
    "config",
    "--no-env-resolution",
    "--format",
    "json",
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) {
  console.error(
    "Docker Compose validation failed. A current Docker Compose CLI is required; a running Docker daemon is not required.",
  );
  process.exit(1);
}
const config = JSON.parse(result.stdout),
  s = config.services;
for (const name of ["app", "worker", "migrate", "backup"])
  for (const mount of s[name].tmpfs || [])
    assert(
      mount.startsWith("/"),
      name + " tmpfs must name an absolute mount point",
    );
for (const name of ["postgres", "app", "worker", "migrate", "backup"])
  assert(!s[name].ports?.length, name + " must not publish an Internet port");
assert.equal(config.networks.database.internal, true);
for (const name of ["app", "worker", "postgres", "proxy", "backup"]) {
  assert(s[name].healthcheck);
  assert(s[name].mem_limit > 0);
  assert(s[name].cpus > 0);
  assert(s[name].logging.options["max-size"]);
  assert.equal(s[name].restart, "unless-stopped");
}
const permanent = ["postgres", "app", "worker", "proxy", "backup"].reduce(
  (sum, name) => sum + Number(s[name].mem_limit),
  0,
);
assert(permanent < 2.7 * 1024 ** 3);
assert(
  ["app", "worker"].every(
    (n) => s[n].read_only && s[n].cap_drop.includes("ALL"),
  ),
);
assert(
  fs
    .readFileSync("ops/postgres/pg_hba.conf", "utf8")
    .includes("hostnossl all all 0.0.0.0/0 reject"),
);
assert(
  !/--(ignore-unfixed|insecure)|StrictHostKeyChecking=no/.test(
    fs.readFileSync(".github/workflows/ovh-images.yml", "utf8") +
      fs.readFileSync(".github/workflows/ovh-release.yml", "utf8"),
  ),
);
assert(
  !/docker\s+compose[^\n]*\s(?:down\s+-v|build)(?:\s|$)/.test(
    fs.readFileSync("ops/release.sh", "utf8"),
  ),
);
const releaseScript = fs.readFileSync("ops/release.sh", "utf8");
const verifiedBackupPosition = releaseScript.indexOf(
  "docker compose --env-file .env -f compose.yml run --rm --no-deps backup --once",
);
const migrationPosition = releaseScript.indexOf(
  "APP_IMAGE=\"$image\" docker compose --env-file .env -f compose.yml run --rm --no-deps migrate",
);
assert(verifiedBackupPosition >= 0, "release must create and verify a fresh PostgreSQL backup");
assert(migrationPosition > verifiedBackupPosition, "backup must complete before schema migration");
console.log(
  "PASS: Compose schema, private PostgreSQL, published-port boundary, TLS policy, resource caps, healthchecks, bounded logs, non-root read-only app/worker, fixed SSH host validation, no VPS build or volume deletion. Permanent container memory cap:",
  Math.round(permanent / 1024 / 1024),
  "MiB. This is configuration validation, not a load measurement.",
);
