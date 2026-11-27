const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file, module);
  cache.set(file, mod);
  mod.require = id => {
    if (id === 'server-only') return {};
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    if (id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(file), id + '.ts')))
      return load(path.resolve(path.dirname(file), id + '.ts'));
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports;
}
process.env.BETTER_AUTH_SECRET = 'isolated-relay-payload-signing-fixture';
const { parseMondialRelayApi1Response } = load('lib/mondialRelayApi1Response.ts');
const { signMondialRelayPoint, verifyMondialRelayPointProof } = load('lib/mondialRelayPointProof.ts');
const { orderPayloadSchema, checkoutOrderSchema } = load('lib/commerceSecurity.ts');
const xml = `<root><STAT>0</STAT><PointsRelais><PointRelais_Details>
  <Num>123456</Num><LgAdr1>Fixture Relay</LgAdr1><LgAdr3>1 rue Fixture</LgAdr3><CP>78300</CP><Ville>Poissy</Ville>
  <Latitude>48.9</Latitude><Longitude>2.0</Longitude><Distance>1000</Distance>
  <Horaires_Lundi><string>1000</string><string>2000</string><string/><string/></Horaires_Lundi>
  <Horaires_Vendredi><string>0900</string><string>1200</string><string>1400</string><string>1900</string></Horaires_Vendredi>
  <Horaires_Samedi><string>08:00-12:00</string><string>14:00-19:00</string></Horaires_Samedi>
  <Horaires_Dimanche><string/><string/><string/><string/></Horaires_Dimanche>
</PointRelais_Details></PointsRelais></root>`;
const relay = signMondialRelayPoint(parseMondialRelayApi1Response(xml, '24R/MED')[0]);
assert.deepEqual(relay.openingHours, [
  { day: 'Lundi', periods: ['10:00-20:00'] },
  { day: 'Vendredi', periods: ['09:00-12:00', '14:00-19:00'] },
  { day: 'Samedi', periods: ['08:00-12:00', '14:00-19:00'] },
]);
assert.deepEqual(relay.coordinates, { latitude: 48.9, longitude: 2 });
const product = id => ({ id, name: id, category: 'sac', unitPrice: 29.9, quantity: 1 });
const order = {
  product: product('modest-era'), items: [product('modest-era'), product('paradise-way')],
  customer: { firstName: ' Fixture ', lastName: ' Buyer ', email: ' buyer@example.test ', phone: '0600000000', street: '1 rue Fixture', city: 'Poissy', zip: '78300', country: 'France' },
  shippingMethodId: 'mondial-relay-point-relais', relayPoint: relay,
  attachments: [], promotionCode: 'FIRSTPRINCESS1', acceptTerms: true, cgvVersion: 'fixture-v1',
};
const parsed = orderPayloadSchema.parse(order);
assert.equal(parsed.customer.email, 'buyer@example.test');
assert.equal(verifyMondialRelayPointProof(parsed.relayPoint), true);
assert.equal(verifyMondialRelayPointProof({ ...parsed.relayPoint, city: 'Tampered' }), false);
assert.equal(orderPayloadSchema.safeParse({ ...order, relayPoint: { ...relay, unknownField: true } }).success, false);
assert.equal(orderPayloadSchema.safeParse({ ...order, relayPoint: { ...relay, coordinates: { latitude: 1000, longitude: 2 } } }).success, false);
const samplePdf = Buffer.from('%PDF-1.7\nsynthetic').toString('base64');
const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64');
const withAttachment = (contentType, base64) => ({
  ...order, attachments: [{ filename: 'fixture', contentType, base64 }],
});
assert.equal(checkoutOrderSchema.safeParse(withAttachment('application/pdf', samplePdf)).success, true);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('image/png', samplePng)).success, true);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('application/pdf', Buffer.from('not a PDF').toString('base64'))).success, false);
assert.equal(orderPayloadSchema.safeParse(withAttachment('application/pdf', Buffer.from('not a PDF').toString('base64'))).success, true);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('image/png', samplePdf)).success, false);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('application/pdf', samplePdf + '!')).success, false);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('application/pdf', '')).success, false);
assert.equal(checkoutOrderSchema.safeParse(withAttachment('application/pdf', 'YR==')).success, false);
// Previously cached relay metadata is accepted too, without changing signed
// core fields, while new searches no longer emit malformed empty SOAP slots.
assert.equal(orderPayloadSchema.safeParse({ ...order, relayPoint: { ...relay, openingHours: [{ day: 'Dimanche', periods: ['string /string /string /string /'] }] } }).success, true);
console.log('PASS: full signed API1 relay metadata accepted at checkout, core proof still enforced, empty hours removed and clock ranges formatted. Isolated fixture only; no database, PayPal order or external request.');
