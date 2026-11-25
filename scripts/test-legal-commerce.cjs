const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const source = readFileSync("lib/businessDays.ts", "utf8");
const compiled = transformSync(source, {
  loader: "ts",
  format: "cjs",
}).code;
const loaded = { exports: {} };
new Function("module", "exports", compiled)(loaded, loaded.exports);

assert.equal(
  loaded.exports.addFrenchBusinessDays(new Date("2026-04-03T12:00:00Z"), 1),
  "2026-04-07",
);
assert.equal(
  loaded.exports.addFrenchBusinessDays(new Date("2026-04-30T12:00:00Z"), 1),
  "2026-05-04",
);
assert.equal(
  loaded.exports.addFrenchBusinessDays(new Date("2026-11-25T12:00:00Z"), 3),
  "2026-11-30",
);
assert.throws(
  () => loaded.exports.addFrenchBusinessDays(new Date("2026-11-25"), 0),
  /INVALID_PREPARATION_DEADLINE_INPUT/,
);

const cgv = readFileSync("app/conditions-de-vente/page.tsx", "utf8");
const delivery = readFileSync("app/livraison/page.tsx", "utf8");
const legalPages = [
  cgv,
  delivery,
  readFileSync("app/mentions-legales/page.tsx", "utf8"),
  readFileSync("app/retours/page.tsx", "utf8"),
].join("\n");
assert.equal((cgv.match(/<h2>Article [0-9]+ -/g) || []).length, 16);
assert.match(delivery, /4,10 € TTC/);
assert.match(delivery, /4,54 € TTC/);
assert.match(delivery, /7,49 € TTC/);
assert.match(delivery, /jours ouvrés/);
assert.doesNotMatch(legalPages, /À compléter|A compléter|a completer/i);

const footer = readFileSync("components/Footer.tsx", "utf8");
for (const href of [
  "/conditions-de-vente",
  "/livraison",
  "/retours",
  "/mentions-legales",
])
  assert(footer.includes(href), `Footer is missing ${href}`);

console.log(
  "PASS: French preparation deadlines, all 16 CGV articles, confirmed delivery prices, no public placeholders, and footer legal links.",
);
