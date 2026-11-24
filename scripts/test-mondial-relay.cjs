const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const source = readFileSync("lib/mondialRelayTypes.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
}).code;
const loaded = { exports: {} };
new Function("module", "exports", compiled)(loaded, loaded.exports);
const {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  createSimulatedRelayPoint,
  getMondialRelayQuote,
  isRelayPoint,
} = loaded.exports;

const oneTestParcel = getMondialRelayQuote(
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  1,
  "simulation",
);
assert.deepEqual(oneTestParcel, {
  priceCents: 410,
  parcelCount: 1,
  serviceCode: "24R",
  source: "simulation",
});
assert.equal(
  getMondialRelayQuote(DEFAULT_MONDIAL_RELAY_SETTINGS, 2, "simulation")
    .priceCents,
  820,
);
assert.equal(
  getMondialRelayQuote(DEFAULT_MONDIAL_RELAY_SETTINGS, 1, "contract"),
  null,
);
assert.equal(
  getMondialRelayQuote(DEFAULT_MONDIAL_RELAY_SETTINGS, 0, "simulation"),
  null,
);

const largeParcelSettings = {
  ...DEFAULT_MONDIAL_RELAY_SETTINGS,
  serviceCode: "24L",
  contractParcel: {
    itemsPerParcel: 1,
    weightGrams: 1200,
    lengthCm: 45,
    widthCm: 40,
    depthCm: 5,
  },
  contractRates: [
    { serviceCode: "24L", maxWeightGrams: 1500, priceCents: 725 },
  ],
};
assert.equal(
  getMondialRelayQuote(largeParcelSettings, 1, "contract").priceCents,
  725,
);

const simulatedPoint = createSimulatedRelayPoint("75001", "Paris", "24R");
assert.equal(simulatedPoint.source, "simulation");
assert.match(simulatedPoint.id, /^SIM-/);
assert.match(simulatedPoint.location, /^SIM-/);
assert.equal(isRelayPoint(simulatedPoint), true);
assert.equal(isRelayPoint({ ...simulatedPoint, source: "production" }), false);

const migration = readFileSync(
  "migrations/007_mondial_relay_settings.sql",
  "utf8",
);
assert.match(migration, /CREATE TABLE IF NOT EXISTS mm_shipping_settings/);
assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE)\b/i);

const publicSettings = readFileSync(
  "app/api/shipping/config/route.ts",
  "utf8",
);
assert.match(publicSettings, /realShippingEnabled:\s*false/);
assert.match(publicSettings, /realShipmentCreationEnabled:\s*false/);
assert.match(publicSettings, /REAL_PAYMENTS_ENABLED/);

console.log(
  "PASS: test-only quotes, contract-rate fail-closed behavior, simulated relay markers, and non-destructive migration",
);
