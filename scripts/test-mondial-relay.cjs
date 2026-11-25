const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

function loadTypeScript(file, dependencies = {}) {
  const compiled = transformSync(readFileSync(file, "utf8"), {
    loader: "ts",
    format: "cjs",
  }).code;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name === "zod") return require(name);
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const relayTypes = loadTypeScript("lib/mondialRelayTypes.ts");
const homeSettings = {
  ...relayTypes.DEFAULT_MONDIAL_RELAY_SETTINGS,
  homeDeliveryEnabled: true,
  homeDeliveryContractConfirmed: true,
};
assert.equal(relayTypes.getHomeDeliveryPriceCents(homeSettings, 1), 749);
assert.equal(relayTypes.getHomeDeliveryPriceCents(homeSettings, 2), null);
assert.deepEqual(
  relayTypes.getHomeDeliveryParcelProfile(homeSettings, 1),
  {
    itemsPerParcel: 1,
    weightGrams: 500,
    lengthCm: 30,
    widthCm: 21,
    depthCm: 6,
  },
);
assert.equal(
  relayTypes.getHomeDeliveryPriceCents(
    { ...homeSettings, homeDeliveryContractConfirmed: false },
    1,
  ),
  null,
);
const relaySettings = loadTypeScript("lib/mondialRelaySettings.ts", {
  "@/lib/mondialRelayTypes": relayTypes,
  "@/lib/newsletterDb": {
    database: () => ({ query: async () => ({ rows: [] }) }),
  },
});
const commerceSecurity = loadTypeScript("lib/commerceSecurity.ts", {
  "./products": {
    products: [
      {
        id: "modest-era",
        name: "Modest Era",
        category: "sac",
        categoryLabel: "Sac",
        price: 100,
        publiclyListed: true,
        availableForSale: true,
        options: {},
      },
    ],
  },
});
const checkoutProof = loadTypeScript("lib/checkoutQuoteProof.ts", {
  "@/lib/commerceSecurity": commerceSecurity,
  "@/lib/mondialRelayPointProof": {
    verifyMondialRelayPointProof: (point) => point.proof === "signed",
  },
  "@/lib/shipping": {
    MONDIAL_RELAY_POINT_RELAIS_ID: "mondial-relay-point-relais",
  },
});
process.env.BETTER_AUTH_SECRET = "unit-test-secret";
const api1Response = loadTypeScript("lib/mondialRelayApi1Response.ts");
const api1 = loadTypeScript("lib/mondialRelayApi1.ts", {
  "@/lib/mondialRelayApi1Response": api1Response,
});
const searchRequest = api1.buildApi1PointSearchRequest({
  shop: "ABCD1234",
  privateKey: "test-key",
  postalCode: "78300",
  city: "Poissy",
  weightGrams: 500,
  serviceCode: "24R/MED",
});
const expectedSearchSignature = createHash("md5")
  .update(
    [
      "ABCD1234",
      "FR",
      "",
      "Poissy",
      "78300",
      "",
      "",
      "",
      "500",
      "MED",
      "",
      "",
      "",
      "10",
      "test-key",
    ].join(""),
    "utf8",
  )
  .digest("hex")
  .toUpperCase();
assert.match(searchRequest, /<Action>MED<\/Action>/);
assert.match(searchRequest, /<NACE><\/NACE>/);
assert.match(searchRequest, new RegExp(`<Security>${expectedSearchSignature}</Security>`));
const lockerSearchRequest = api1.buildApi1PointSearchRequest({
  shop: "ABCD1234",
  privateKey: "test-key",
  postalCode: "78300",
  city: "Poissy",
  weightGrams: 500,
  serviceCode: "24R/APM",
});
assert.match(lockerSearchRequest, /<Action>APM<\/Action>/);
const expectedLockerSignature = createHash("md5")
  .update(
    [
      "ABCD1234",
      "FR",
      "",
      "Poissy",
      "78300",
      "",
      "",
      "",
      "500",
      "APM",
      "",
      "",
      "",
      "10",
      "test-key",
    ].join(""),
    "utf8",
  )
  .digest("hex")
  .toUpperCase();
assert.match(lockerSearchRequest, new RegExp(`<Security>${expectedLockerSignature}</Security>`));

const successfulSearch = `<Response><STAT>0</STAT><PointsRelais>
  <PointRelais_Details><Num>123456</Num><Localisation1>Relais &amp; boutique</Localisation1>
  <LgAdr1>1 rue de test</LgAdr1><CP>78300</CP><Ville>Poissy</Ville><Distance>1200</Distance>
  </PointRelais_Details></PointsRelais></Response>`;
const points = api1Response.parseMondialRelayApi1Response(
  successfulSearch,
  "24R/MED",
);
assert.equal(points.length, 1);
assert.equal(points[0].source, "production");
assert.equal(points[0].serviceCode, "24R/MED");
assert.equal(points[0].label, "Relais & boutique");
assert.equal(points[0].distanceKm, 1.2);
assert.deepEqual(
  api1Response.parseMondialRelayApi1Response(
    "<Response><STAT>0</STAT><PointsRelais /></Response>",
    "24R/APM",
  ),
  [],
);
assert.throws(
  () =>
    api1Response.parseMondialRelayApi1Response(
      "<Response><STAT>97</STAT></Response>",
      "24R/MED",
    ),
  (error) =>
    error instanceof api1Response.MondialRelayApi1ResponseError &&
    error.code === "STAT_97",
);

const trackingRequest = api1.buildApi1TrackingRequest({
  shop: "ABCD1234",
  privateKey: "test-key",
  shipmentNumber: "12345678",
});
const expectedTrackingSignature = createHash("md5")
  .update("ABCD123412345678FRtest-key", "utf8")
  .digest("hex")
  .toUpperCase();
assert.match(trackingRequest, /<Expedition>12345678<\/Expedition>/);
assert.match(trackingRequest, new RegExp(`<Security>${expectedTrackingSignature}</Security>`));
const tracking = api1.parseMondialRelayTrackingResponse(
  `<WSI2_TracingColisDetailleResponse><WSI2_TracingColisDetailleResult>
    <Libelle01>En transit</Libelle01><Relais_Libelle>Relais Poissy</Relais_Libelle>
    <Relais_Num>123456</Relais_Num><Tracing>
      <ret_WSI2_sub_TracingColisDetaille><Libelle>Pris en charge</Libelle>
        <Date>01/01/2026</Date><Heure>10:00</Heure><Emplacement>Poissy</Emplacement>
        <Relais_Num>123456</Relais_Num><Relais_Pays>FR</Relais_Pays>
      </ret_WSI2_sub_TracingColisDetaille>
    </Tracing></WSI2_TracingColisDetailleResult></WSI2_TracingColisDetailleResponse>`,
);
assert.equal(tracking.summary, "En transit");
assert.equal(tracking.events[0].location, "Poissy");

const api2 = loadTypeScript("lib/mondialRelayApi2.ts");
const shipmentRequest = api2.buildApi2ProductionRequest(
  { login: "test&login", password: "test<password>", customerId: "TEST01" },
  {
    orderNo: "MM-2026-12345678",
    customerNo: "MM-2026-12345678",
    serviceCode: "24R/MED",
    relayLocation: "FR-123456",
    collectionMode: "REL",
    sender: {
      firstName: "Maison",
      lastName: "Miroir",
      street: "Rue de test",
      houseNo: "1",
      countryCode: "FR",
      postalCode: "78300",
      city: "Poissy",
      email: "sender@example.test",
    },
    recipient: {
      firstName: "Test",
      lastName: "Client",
      street: "Rue de test",
      houseNo: "2",
      countryCode: "FR",
      postalCode: "75001",
      city: "Paris",
      email: "client@example.test",
    },
    parcels: [
      {
        content: "Sac Maison Miroir",
        weightGrams: 500,
        lengthCm: 45,
        widthCm: 40,
        depthCm: 5,
      },
    ],
  },
);
assert.match(shipmentRequest, /<Login>test&amp;login<\/Login>/);
assert.match(shipmentRequest, /<Password>test&lt;password&gt;<\/Password>/);
assert.match(shipmentRequest, /<DeliveryMode Mode="24R" Location="FR-123456"/);
assert.match(shipmentRequest, /<CollectionMode Mode="REL" Location=""/);
assert.match(shipmentRequest, /<Content>Sac Maison Miroir<\/Content>/);
assert.match(shipmentRequest, /<HouseNo>2<\/HouseNo>/);
const homeShipmentRequest = api2.buildApi2ProductionRequest(
  { login: "test-login", password: "test-password", customerId: "TEST01" },
  {
    orderNo: "MM-2026-12345679",
    customerNo: "MM-2026-12345679",
    deliveryMode: "HOM",
    collectionMode: "REL",
    sender: {
      firstName: "Maison",
      lastName: "Miroir",
      street: "Rue de test",
      houseNo: "1",
      countryCode: "FR",
      postalCode: "78300",
      city: "Poissy",
      email: "sender@example.test",
    },
    recipient: {
      firstName: "Test",
      lastName: "Client",
      street: "Rue de test",
      houseNo: "2",
      countryCode: "FR",
      postalCode: "75001",
      city: "Paris",
      email: "client@example.test",
    },
    parcels: [
      {
        content: "Sac Maison Miroir",
        weightGrams: 500,
        lengthCm: 30,
        widthCm: 21,
        depthCm: 6,
      },
    ],
  },
);
assert.match(homeShipmentRequest, /<DeliveryMode Mode="HOM" \/>/);
assert.match(homeShipmentRequest, /<CollectionMode Mode="REL" Location=""/);
assert.doesNotMatch(homeShipmentRequest, /<DeliveryMode[^>]*Location=/);
assert.match(api2.API2_PRODUCTION_URL || api2Source(), /api\/shipment/i);

function api2Source() {
  return readFileSync("lib/mondialRelayApi2.ts", "utf8");
}

const api2Response = api2.parseApi2ProductionResponse(
  `<ShipmentCreationResponse>
    <ShipmentsList><Shipment ShipmentNumber="12345678">
      <LabelList><Label><Output>http://connect.mondialrelay.com/label.pdf?crc=abc&amp;format=10x15</Output></Label></LabelList>
    </Shipment></ShipmentsList><StatusList />
  </ShipmentCreationResponse>`,
);
assert.equal(api2Response.shipmentNumber, "12345678");
assert.equal(
  api2Response.labelUrl,
  "https://connect.mondialrelay.com/label.pdf?crc=abc&format=10x15",
);
assert.throws(
  () =>
    api2.parseApi2ProductionResponse(
      `<ShipmentCreationResponse><ShipmentsList>
        <Shipment ShipmentNumber="12345678"><LabelList><Label>
          <Output>https://attacker.example/label.pdf</Output>
        </Label></LabelList></Shipment></ShipmentsList><StatusList /></ShipmentCreationResponse>`,
    ),
  (error) =>
    error instanceof api2.MondialRelayApi2Error &&
    error.code === "LABEL_URL_UNTRUSTED",
);

const checkoutOrder = {
  product: {
    id: "modest-era",
    name: "Modest Era",
    category: "sac",
    categoryLabel: "Sac",
    unitPrice: 100,
    quantity: 1,
  },
  items: [
    {
      id: "modest-era",
      name: "Modest Era",
      category: "sac",
      categoryLabel: "Sac",
      unitPrice: 100,
      quantity: 1,
    },
  ],
  customer: {
    firstName: "Test",
    lastName: "Client",
    email: "client@example.test",
    phone: "0612345678",
    street: "2 rue de test",
    city: "Paris",
    zip: "75001",
    country: "France",
  },
  shippingMethodId: "mondial-relay-point-relais",
  relayPoint: {
    id: "123456",
    location: "FR-123456",
    label: "Relay",
    address: ["1 rue de test"],
    postalCode: "75001",
    city: "Paris",
    source: "production",
    serviceCode: "24R/MED",
    proof: "signed",
  },
  attachments: [],
  customValues: {},
};
const proof = checkoutProof.createCheckoutQuoteProof(
  "A123456789012345",
  checkoutOrder,
  { subtotalCents: 10000, shippingCents: 425, totalCents: 10425 },
);
assert.equal(
  checkoutProof.verifyCheckoutQuoteProof(
    proof,
    "A123456789012345",
    checkoutOrder,
  ).totalCents,
  10425,
);
assert.throws(() =>
  checkoutProof.verifyCheckoutQuoteProof(
    proof,
    "A123456789012345",
    {
      ...checkoutOrder,
      customer: { ...checkoutOrder.customer, street: "3 rue de test" },
    },
  ),
);
assert.throws(() =>
  checkoutProof.verifyCheckoutQuoteProof(
    proof,
    "A123456789012346",
    checkoutOrder,
  ),
);

const quoteSettings = {
  serviceCode: "24R/MED",
  allowedServices: ["24R/MED"],
  contractConfirmed: true,
  serviceConfirmed: true,
  contractParcel: {
    itemsPerParcel: 1,
    weightGrams: 500,
    lengthCm: 45,
    widthCm: 40,
    depthCm: 5,
  },
  contractRates: [
    {
      serviceCode: "24R/MED",
      maxWeightGrams: 600,
      priceCents: 425,
      priceBasis: "TTC",
      customerPriceCents: 499,
      confirmed: true,
    },
  ],
  proposedRate: relayTypes.DEFAULT_MONDIAL_RELAY_SETTINGS.proposedRate,
};
assert.deepEqual(relayTypes.getMondialRelayQuote(quoteSettings, 1), {
  priceCents: 499,
  parcelCount: 1,
  serviceCode: "24R/MED",
  source: "contract",
});
assert.equal(relayTypes.getMondialRelayQuote(quoteSettings, 2), null);
assert.equal(
  relayTypes.getMondialRelayQuote(
    { ...quoteSettings, contractRates: [{ ...quoteSettings.contractRates[0], priceCents: 0 }] },
    1,
  ),
  null,
);
assert.equal(
  relayTypes.getMondialRelayQuote(
    {
      ...quoteSettings,
      proposedRate: {
        ...relayTypes.DEFAULT_MONDIAL_RELAY_SETTINGS.proposedRate,
        confirmed: false,
      },
      contractRates: [],
    },
    1,
  ),
  null,
);
assert.equal(
  relayTypes.getMondialRelayQuote(
    { ...quoteSettings, allowedServices: [] },
    1,
  ),
  null,
);
const quantitySettings = {
  ...quoteSettings,
  shippingTiers: relayTypes.DEFAULT_MONDIAL_RELAY_SETTINGS.shippingTiers,
};
assert.equal(relayTypes.getMondialRelayQuote(quantitySettings, 1).priceCents, 410);
assert.equal(relayTypes.getMondialRelayQuote(quantitySettings, 2), null);
assert.equal(relayTypes.getMondialRelayQuote(quantitySettings, 3), null);
const confirmedTwoBagTier = {
  ...quantitySettings,
  shippingTiers: quantitySettings.shippingTiers.map((tier) =>
    tier.quantity === 2
      ? { ...tier, lengthCm: 30, widthCm: 21, depthCm: 6, confirmed: true }
      : tier,
  ),
};
assert.equal(relayTypes.getMondialRelayQuote(confirmedTwoBagTier, 2).priceCents, 454);
assert.equal(
  relayTypes.getMondialRelayParcelProfile(confirmedTwoBagTier, 2).weightGrams,
  1000,
);
const legacySettings = relaySettings.parseMondialRelaySettings({
  serviceCode: "24R/MED",
  testParcel: {
    itemsPerParcel: 1,
    weightGrams: 500,
    lengthCm: 45,
    widthCm: 40,
    depthCm: 5,
  },
  contractParcel: {
    itemsPerParcel: 1,
    weightGrams: 500,
    lengthCm: 45,
    widthCm: 40,
    depthCm: 5,
  },
  testRates: [],
  contractRates: [
    { serviceCode: "24R/MED", maxWeightGrams: 600, priceCents: 451 },
  ],
});
assert.equal(legacySettings.contractConfirmed, false);
assert.deepEqual(legacySettings.allowedServices, []);
assert.equal(legacySettings.contractRates[0].confirmed, false);
assert.equal(legacySettings.proposedRate.priceCents, 451);
assert.equal(legacySettings.proposedRate.maxWeightGrams, null);
assert.equal(legacySettings.proposedRate.priceBasis, "unknown");
assert.equal(legacySettings.proposedRate.customerPriceCents, null);
assert.equal(legacySettings.proposedRate.confirmed, false);
assert.equal(
  relayTypes.getMondialRelayQuote(legacySettings, 1),
  null,
);
assert.equal(
  relayTypes.isRelayPoint({ ...points[0], proof: "signed-token" }),
  true,
);
assert.equal(
  relayTypes.isRelayPoint({ ...points[0], source: "sandbox" }),
  false,
);

const migration = readFileSync(
  "migrations/007_mondial_relay_settings.sql",
  "utf8",
);
assert.match(migration, /CREATE TABLE IF NOT EXISTS mm_shipping_settings/);
assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE)\b/i);
const returnsMigration = readFileSync(
  "migrations/010_commerce_returns.sql",
  "utf8",
);
assert.match(returnsMigration, /ADD COLUMN IF NOT EXISTS return_status/);
assert.doesNotMatch(returnsMigration, /\b(?:DROP|TRUNCATE|DELETE)\b/i);
const publicSettings = readFileSync(
  "app/api/shipping/config/route.ts",
  "utf8",
);
const paypalOrderRoute = readFileSync(
  "app/api/paypal/create-order/route.ts",
  "utf8",
);
const orderRoute = readFileSync("app/api/order/route.ts", "utf8");
const checkoutQuote = readFileSync("lib/checkoutQuote.ts", "utf8");
const relayReadiness = readFileSync("lib/mondialRelaySettings.ts", "utf8");
const shipmentRoute = readFileSync(
  "app/api/admin/orders/[orderId]/mondial-relay/create/route.ts",
  "utf8",
);
assert.match(publicSettings, /SHOP_OPEN/);
assert.match(publicSettings, /REAL_PAYMENTS_ENABLED/);
assert.match(publicSettings, /shippingTiers/);
assert.match(paypalOrderRoute, /prepareCheckoutOrder/);
assert.match(orderRoute, /verifyCommerceCheckoutProof/);
assert.match(orderRoute, /captureAndVerifyPayPalOrder/);
assert.match(checkoutQuote, /checkoutShippingReady/);
assert.match(relayReadiness, /serviceAllowed/);
assert.match(relayReadiness, /collectionModeConfigured/);
assert.match(shipmentRoute, /reserveMondialRelayShipment/);
assert.match(shipmentRoute, /SHIPMENT_RESULT_UNKNOWN/);
assert.doesNotMatch(publicSettings, /simulation/);
assert.doesNotMatch(shipmentRoute, /sandbox/i);
assert.doesNotMatch(publicSettings, /MONDIAL_RELAY_API[12]_PROD_(?:SHOP|PRIVATE_KEY|LOGIN|PASSWORD|CUSTOMER_ID)/);
assert.doesNotMatch(publicSettings, /sender|collectionMode|priceCents/);

console.log(
  "PASS: production-only relay parsing, signed API1 search/tracking requests, contract quote fail-closed behavior, API2 request/response validation, protected checkout, shipment idempotency, and additive migration. No external API requests were made.",
);
