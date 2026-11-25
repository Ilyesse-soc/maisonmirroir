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
const mondialRelayMigration = fs.readFileSync(
    "migrations/007_mondial_relay_settings.sql",
    "utf8",
  ),
  mondialRelaySettings = fs.readFileSync(
    "app/api/shipping/config/route.ts",
    "utf8",
  ),
  mondialRelayOrder = fs.readFileSync("app/api/order/route.ts", "utf8"),
  paypalOrderRoute = fs.readFileSync(
    "app/api/paypal/create-order/route.ts",
    "utf8",
  ),
  mondialRelayCreate = fs.readFileSync(
    "app/api/admin/orders/[orderId]/mondial-relay/create/route.ts",
    "utf8",
  ),
  productionReadiness = fs.readFileSync("lib/mondialRelaySettings.ts", "utf8");
assert(
  /CREATE TABLE IF NOT EXISTS mm_shipping_settings/.test(mondialRelayMigration) &&
    !/\b(?:DROP|TRUNCATE|DELETE)\b/i.test(mondialRelayMigration),
  "Mondial Relay settings migration must be additive and non-destructive",
);
assert(
  mondialRelaySettings.includes("relay.checkoutShippingReady") &&
    mondialRelaySettings.includes("relay.shipmentCreationEnabled") &&
  mondialRelayOrder.includes("verifyCommerceCheckoutProof") &&
    mondialRelayOrder.includes("await captureAndVerifyPayPalOrder(") &&
    mondialRelayOrder.includes("await finalizeCommercePayment(") &&
    paypalOrderRoute.includes("SHOP_OPEN") &&
    paypalOrderRoute.includes("REAL_PAYMENTS_ENABLED") &&
    productionReadiness.includes("MONDIAL_RELAY_PRODUCTION_CONFIRMED") &&
    productionReadiness.includes("REAL_SHIPMENT_CREATION_ENABLED") &&
    mondialRelayCreate.includes("reserveMondialRelayShipment") &&
    mondialRelayCreate.includes("SHIPMENT_RESULT_UNKNOWN"),
  "production checkout and shipments must require explicit readiness and idempotency guards",
);
const imageWorkflow = fs.readFileSync(".github/workflows/ovh-images.yml", "utf8"),
  releaseWorkflow = fs.readFileSync(".github/workflows/ovh-release.yml", "utf8"),
  maintenanceWorkflow = fs.readFileSync(
    ".github/workflows/security-maintenance.yml",
    "utf8",
  ),
  dependabotWorkflow = fs.readFileSync(
    ".github/workflows/dependabot-safe-updates.yml",
    "utf8",
  ),
  nginxDigest =
    "sha256:8c950211a641ec5b23f265450517001f6bcca533666120ebe36cb4cff3d00a55";
assert(
  imageWorkflow.includes("if: github.ref == 'refs/heads/main'"),
  "production image publication must be restricted to main",
);
assert(
  imageWorkflow.includes(nginxDigest) &&
    fs.readFileSync("ops/compose.yml", "utf8").includes(nginxDigest),
  "the scanned and deployed Nginx digest must match",
);
for (const value of [
  "actions/workflows/ovh-images.yml",
  ".head_branch",
  ".conclusion",
  "org.opencontainers.image.revision",
  "auto-deploy:patch",
]) {
  assert(releaseWorkflow.includes(value), "release provenance validation is missing " + value);
}
assert(
  releaseWorkflow.includes("tr '[:upper:]' '[:lower:]'") &&
    releaseWorkflow.includes('image="ghcr.io/$repository:$HEAD_SHA"'),
  "release image references must normalize repository casing for OCI registries",
);
assert(
  maintenanceWorkflow.includes("Europe/Paris") &&
    maintenanceWorkflow.includes("npm audit --audit-level=low") &&
    maintenanceWorkflow.includes("ops/test-runtime.sh") &&
    maintenanceWorkflow.includes("openssl x509 -noout -checkend"),
  "scheduled maintenance must test dependencies, isolated runtime, proxy, and TLS",
);
assert(
  dependabotWorkflow.includes("version-update:semver-patch") &&
    dependabotWorkflow.includes("package-ecosystem == 'npm'") &&
    dependabotWorkflow.includes("package-lock.json"),
  "automatic merge/deploy must be limited to tested npm patch updates",
);
const previewNginx = fs.readFileSync("ops/preview/nginx.conf", "utf8");
assert(
  !previewNginx.includes("auth_basic") &&
    previewNginx.includes("location = /api { return 404; }") &&
    previewNginx.includes("location ^~ /api/ { return 404; }") &&
    previewNginx.includes("location ^~ /api/admin/") &&
    previewNginx.includes("location ^~ /api/admin-access/") &&
    previewNginx.includes("location ^~ /api/auth/") &&
    !previewNginx.includes("location ~* ^/(admin|connexion|77774555474447777554555)"),
  "preview must forward protected admin/auth routes and keep other APIs blocked",
);
const previewCompose = fs.readFileSync("ops/preview.compose.yml", "utf8"),
  previewInit = fs.readFileSync("ops/preview/init.sh", "utf8"),
  previewSeed = fs.readFileSync("ops/preview/seed-fixtures.sql", "utf8");
assert(
  previewCompose.includes("postgres:18-alpine@sha256:") &&
    previewCompose.includes("name: maison-miroir-preview-db") &&
    previewCompose.includes("NEWSLETTER_SEND_ENABLED: \"false\"") &&
    previewCompose.includes("DATABASE_CA_FILE: /run/secrets/db-ca.crt") &&
    previewCompose.includes("./secrets/app.env") &&
    previewCompose.includes("./secrets/migrate.env") &&
    previewCompose.includes("condition: service_healthy") &&
    !previewCompose.includes("RESEND_API_KEY"),
  "preview must use a separate TLS database, persistent isolated storage and no mail provider credentials",
);
assert(
  previewInit.includes("mm_preview_app") &&
    previewInit.includes("mm_preview_migrate") &&
    previewInit.includes("CREATE SCHEMA mm_preview") &&
    previewSeed.includes("@example.test") &&
    previewSeed.includes("'draft'"),
  "preview initialization must use isolated database roles and synthetic fixtures",
);
console.log(
  "PASS: production Compose schema and release gates, plus preview-only authenticated admin routes, synthetic data and separate TLS PostgreSQL with real email credentials absent. Permanent production container memory cap:",
  Math.round(permanent / 1024 / 1024),
  "MiB. This is configuration validation, not a load measurement.",
);
