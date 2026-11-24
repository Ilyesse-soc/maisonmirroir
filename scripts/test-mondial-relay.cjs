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

const api1ResponseSource = readFileSync(
  "lib/mondialRelayApi1Response.ts",
  "utf8",
);
const api1ResponseCompiled = transformSync(api1ResponseSource, {
  loader: "ts",
  format: "cjs",
}).code;
const api1ResponseLoaded = { exports: {} };
new Function("module", "exports", api1ResponseCompiled)(
  api1ResponseLoaded,
  api1ResponseLoaded.exports,
);
const {
  MondialRelayApi1ResponseError,
  parseMondialRelayApi1Response,
} = api1ResponseLoaded.exports;
const api2Source = readFileSync("lib/mondialRelayApi2.ts", "utf8");
const api2Compiled = transformSync(api2Source, {
  loader: "ts",
  format: "cjs",
}).code;
const api2Loaded = { exports: {} };
new Function("require", "module", "exports", api2Compiled)(
  (name) => {
    if (name === "server-only") return {};
    throw new Error(`Unexpected dependency: ${name}`);
  },
  api2Loaded,
  api2Loaded.exports,
);
const {
  MondialRelayApi2Error,
  buildApi2SandboxTestRequest,
  parseApi2SandboxResponse,
} = api2Loaded.exports;

const api2Request = buildApi2SandboxTestRequest(
  {
    login: "test&login",
    password: "test<password>",
    customerId: "TEST01",
  },
  { weightGrams: 500, lengthCm: 45, widthCm: 40, depthCm: 5 },
);
assert.match(api2Request, /<Login>test&amp;login<\/Login>/);
assert.match(api2Request, /<Password>test&lt;password&gt;<\/Password>/);
assert.match(api2Request, /<DeliveryMode Mode="24R" Location="FR-66974"/);
assert.match(api2Request, /<Depth Value="5" Unit="cm" \/>/);
assert.match(api2Request, /<City>POISSY<\/City>/);
assert.match(api2Request, /sandbox-test@example\.com/);
assert.match(api2Source, /Content-Type": "text\/xml; charset=utf-8"/);
const api2Response = parseApi2SandboxResponse(
  `<ShipmentCreationResponse>
    <ShipmentsList><Shipment ShipmentNumber="12345678">
      <LabelList><Label><Output>http://connect.mondialrelay.com/label.pdf?crc=abc&amp;format=10x15</Output></Label></LabelList>
    </Shipment></ShipmentsList>
    <StatusList />
  </ShipmentCreationResponse>`,
);
assert.equal(api2Response.shipmentNumber, "12345678");
assert.equal(
  api2Response.labelUrl,
  "https://connect.mondialrelay.com/label.pdf?crc=abc&format=10x15",
);
assert.throws(
  () =>
    parseApi2SandboxResponse(
      "<Response><StatusList><Status><Code>10001</Code></Status></StatusList></Response>",
    ),
  (error) =>
    error instanceof MondialRelayApi2Error &&
    error.code === "PROVIDER_10001",
);
assert.throws(
  () =>
    parseApi2SandboxResponse(
      `<ShipmentCreationResponse>
        <ShipmentsList><Shipment ShipmentNumber="12345678">
          <LabelList><Label><Output>https://attacker.example/label.pdf</Output></Label></LabelList>
        </Shipment></ShipmentsList><StatusList />
      </ShipmentCreationResponse>`,
    ),
  (error) =>
    error instanceof MondialRelayApi2Error &&
    error.code === "LABEL_URL_UNTRUSTED",
);

const successfulSoapResponse = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><m:WSI4_PointRelais_RechercheResponse xmlns:m="http://www.mondialrelay.fr/webservice/">
    <m:WSI4_PointRelais_RechercheResult>
      <m:STAT>0</m:STAT>
      <m:PointsRelais><m:PointRelais_Details>
        <m:Num>12345</m:Num><m:Localisation1>Relais &amp; boutique</m:Localisation1>
        <m:LgAdr1>1 rue de test</m:LgAdr1><m:CP>78300</m:CP><m:Ville>Poissy</m:Ville>
        <m:Distance>1.2</m:Distance>
      </m:PointRelais_Details></m:PointsRelais>
    </m:WSI4_PointRelais_RechercheResult>
  </m:WSI4_PointRelais_RechercheResponse></soap:Body>
</soap:Envelope>`;
const parsedPoints = parseMondialRelayApi1Response(successfulSoapResponse, "24R");
assert.equal(parsedPoints.length, 1);
assert.equal(parsedPoints[0].id, "12345");
assert.equal(parsedPoints[0].label, "Relais & boutique");
assert.equal(parsedPoints[0].source, "sandbox");
assert.deepEqual(
  parseMondialRelayApi1Response(
    "<Response><PointsRelais /></Response>",
    "24R",
  ),
  [],
);
assert.throws(
  () =>
    parseMondialRelayApi1Response(
      "<Response><STAT>97</STAT></Response>",
      "24R",
    ),
  (error) =>
    error instanceof MondialRelayApi1ResponseError &&
    error.code === "STAT_97",
);
assert.throws(
  () => parseMondialRelayApi1Response("<Response />", "24R"),
  (error) =>
    error instanceof MondialRelayApi1ResponseError &&
    error.code === "STATUS_MISSING",
);

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
const api2Route = readFileSync(
  "app/api/admin/shipping-settings/test-shipment/route.ts",
  "utf8",
);
assert.match(api2Route, /MONDIAL_RELAY_API2_SANDBOX_TEST_RESERVED/);
assert.match(api2Route, /pg_advisory_xact_lock/);
assert.match(api2Route, /api2SandboxEnabled/);
assert.doesNotMatch(api2Source, /connect-api\.mondialrelay\.com\/api\/shipment/);

console.log(
  "PASS: API1 SOAP status handling, API2 sandbox request/response validation and idempotency guards, test-only quotes, contract-rate fail-closed behavior, simulated relay markers, and non-destructive migration",
);
