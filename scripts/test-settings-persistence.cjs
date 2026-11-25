const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { NextRequest } = require('next/server');

(async () => {
  const db = new PGlite();
  for (const file of fs.readdirSync('migrations').filter(f => f.endsWith('.sql')).sort())
    await db.exec(fs.readFileSync(path.join('migrations', file), 'utf8'));
  const adapt = result => ({ ...result, rowCount: result.affectedRows ?? result.rows.length });
  const query = async (sql, args) => adapt(await db.query(sql, args));
  const pool = { query };
  const transaction = callback => db.transaction(tx => callback({ query: async (sql, args) => adapt(await tx.query(sql, args)) }));
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module);
    cache.set(file, mod);
    mod.require = id => {
      if (id === 'server-only') return {};
      if (id === '@/lib/newsletterDb' || id === './newsletterDb') return { database: () => pool, transaction };
      if (id === '@/lib/adminAuth') return { adminDenied: async () => null, adminSession: async () => ({ user: { id: 'settings-fixture-admin' } }) };
      if (id === '@/lib/adminAudit') return { adminAudit: async () => {} };
      if (id === '@/lib/observability') return { securityEvent() {} };
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
    return mod.exports;
  }
  const request = (route, payload) => new NextRequest('https://settings.test/api/admin/' + route, {
    method: 'PATCH', headers: { 'content-type': 'application/json', origin: 'https://settings.test' }, body: JSON.stringify(payload),
  });
  const shipping = load('app/api/admin/shipping-settings/route.ts');
  const brand = load('app/api/admin/settings/route.ts');
  const types = load('lib/mondialRelayTypes.ts');
  const sender = { company: 'Fixture company', firstName: 'Ada', lastName: 'Fixture', street: 'rue Fixture', houseNo: '1', postalCode: '75001', city: 'Paris', countryCode: 'FR', phone: '0600000000', email: 'sender@example.test' };

  // Match the production failure: a historical JSON row omits context fields.
  await query('INSERT INTO mm_shipping_settings(id,settings,updated_by) VALUES(1,$1,$2)', [JSON.stringify({ fulfillmentMode: 'manual_connect', manualConnectConfirmed: false, shippingTiers: types.DEFAULT_MONDIAL_RELAY_SETTINGS.shippingTiers, preparationDays: 3, futureKey: 'retain' }), 'fixture']);
  const baseline = (await (await shipping.GET()).json()).settings;
  const response = await shipping.PATCH(request('shipping-settings', {
    changes: { sender, serviceConfirmed: true, collectionModeConfirmed: true },
    expected: { sender: baseline.sender, serviceConfirmed: false, collectionModeConfirmed: false },
  }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).persisted, true);
  const reread = (await (await shipping.GET()).json()).settings;
  assert.deepEqual(reread.sender, sender);
  assert.equal(reread.serviceConfirmed, true);
  assert.equal(reread.collectionModeConfirmed, true);
  const stored = (await query('SELECT settings FROM mm_shipping_settings WHERE id=1')).rows[0].settings;
  assert.equal(stored.serviceCode, '24R/MED');
  assert.equal(stored.collectionMode, 'REL');
  assert.equal(stored.futureKey, 'retain');
  assert.equal(stored.manualConnectConfirmed, false);

  // A second editor changes another field from its older snapshot without
  // erasing the first editor's sender or tariff data.
  assert.equal((await shipping.PATCH(request('shipping-settings', { changes: { preparationDays: 4 }, expected: { preparationDays: 3 } }))).status, 200);
  assert.deepEqual((await (await shipping.GET()).json()).settings.sender, sender);
  assert.equal((await shipping.PATCH(request('shipping-settings', { changes: { preparationDays: 5 }, expected: { preparationDays: 3 } }))).status, 409);

  // Every declared legal key must be accepted by the actual migrated CHECK.
  const beforeBrand = (await (await brand.GET()).json()).settings;
  const changes = { legal_seller_name: '  Ada Fixture  ', professional_phone: ' 0600000000 ', mediator_name: 'Fixture mediator', mediator_address: '1 rue Fixture, Paris', mediator_url: 'https://example.test/mediation', legal_terms_confirmed: 'true' };
  const expected = Object.fromEntries(Object.keys(changes).map(key => [key, beforeBrand[key]]));
  const savedBrand = await brand.PATCH(request('settings', { changes, expected }));
  assert.equal(savedBrand.status, 200, JSON.stringify(await savedBrand.clone().json()));
  const confirmedBrand = (await (await brand.GET()).json()).settings;
  assert.equal(confirmedBrand.legal_seller_name, 'Ada Fixture');
  assert.equal(confirmedBrand.professional_phone, '0600000000');
  assert.equal(confirmedBrand.mediator_url, changes.mediator_url);
  assert.equal(confirmedBrand.legal_terms_confirmed, 'true');
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_brand_settings WHERE key IN ('legal_seller_name','mediator_name','mediator_address','mediator_url','legal_terms_confirmed')")).rows[0].n, 5);
  await db.close();
  console.log('PASS: migrated legal key constraint, historical shipping context, verified API persistence, independent edits, conflict rejection and retained fields (isolated PGlite, no external calls).');
})().catch(error => { console.error(error); process.exitCode = 1; });
