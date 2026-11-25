const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const events = new Map();
const sent = [];
const database = {
  async query(sql, params) {
    const [eventKey] = params;
    if (sql.includes("INSERT INTO mm_commerce_email_events")) {
      if (events.has(eventKey)) return { rowCount: 0 };
      events.set(eventKey, "pending");
      return { rowCount: 1 };
    }
    if (sql.includes("UPDATE mm_commerce_email_events")) {
      events.set(eventKey, sql.includes("status='sent'") ? "sent" : "failed");
      return { rowCount: 1 };
    }
    throw new Error(`Unexpected database query: ${sql}`);
  },
};

const source = readFileSync("lib/commerceNotifications.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
}).code;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(
  (name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/newsletterDb")
      return {
        database: () => database,
        transaction: (callback) => callback(database),
      };
    if (name === "@/lib/email")
      return {
        getAdminEmail: () => "admin@example.test",
        getEmailFrom: () => "shop@example.test",
        sendEmailOrThrow: async (message) => sent.push(message),
      };
    if (name === "@/lib/observability") return { securityEvent() {} };
    throw new Error(`Unexpected dependency: ${name}`);
  },
  loaded,
  loaded.exports,
);

const order = {
  orderId: "MM-2026-ABCDEFGH",
  customer: { firstName: "Camille", email: "customer@example.test" },
  shipping: {
    trackingBaseUrl: "https://www.mondialrelay.fr/suivi-de-colis/",
    relayPoint: {
      label: "Point Poissy",
      address: ["1 rue du Test"],
      postalCode: "78300",
      city: "Poissy",
    },
    mondialRelayShipment: {
      shipmentNumber: "12345678",
    },
  },
};

(async () => {
  await loaded.exports.sendCommerceOrderNotification(
    order,
    "shipment_confirmation",
    "Expediee",
  );
  await loaded.exports.sendCommerceOrderNotification(
    order,
    "shipment_confirmation",
    "Expediee",
  );
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /12345678/);
  assert.match(sent[0].html, /https:\/\/www\.mondialrelay\.fr\/suivi-de-colis\//);

  await loaded.exports.sendCommerceOrderNotification(
    order,
    "relay_available",
    "12345678",
  );
  await loaded.exports.sendCommerceOrderNotification(
    order,
    "relay_available",
    "12345678",
  );
  assert.equal(sent.length, 2);
  assert.match(sent[1].html, /Point Poissy/);
  assert.match(sent[1].html, /78300 Poissy/);
  assert.match(sent[1].html, /12345678/);

  console.log(
    "PASS: shipment and Point Relais notifications include tracking details and are idempotent. No real emails sent.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
