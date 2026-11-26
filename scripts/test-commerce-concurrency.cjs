const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { Pool } = require("pg");
const ts = require("typescript");

function loadInventory(database, transaction) {
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const mod = new Module(resolved, module);
    mod.filename = resolved;
    mod.paths = module.paths;
    cache.set(resolved, mod);
    mod.require = (id) => {
      if (id === "server-only") return {};
      if (id === "@/lib/newsletterDb") return { database, transaction };
      if (id === "@/lib/email") return {};
      if (id.startsWith("@/") || id.startsWith(".")) {
        const target = id.startsWith("@/")
          ? path.resolve(id.slice(2))
          : path.resolve(path.dirname(resolved), id);
        if (fs.existsSync(`${target}.ts`)) return load(`${target}.ts`);
      }
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      resolved,
    );
    return mod.exports;
  }
  return load("lib/commerceInventory.ts");
}

async function main() {
  const name = `maison-miroir-security-test-${randomUUID()}`;
  const password = randomUUID();
  let started = false;
  let pool;
  try {
    execFileSync("docker", [
      "run", "--detach", "--rm", "--pull=never", "--name", name,
      "--publish", "127.0.0.1::5432",
      "--tmpfs", "/var/lib/postgresql/data:rw,size=256m",
      "--env", `POSTGRES_PASSWORD=${password}`,
      "--env", "POSTGRES_DB=maison_miroir_security_test",
      "postgres:16-alpine",
    ], { stdio: "pipe" });
    started = true;
    const binding = execFileSync("docker", ["port", name, "5432/tcp"], {
      encoding: "utf8",
    }).trim();
    const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);
    assert(match, `Unexpected test database binding: ${binding}`);
    pool = new Pool({
      host: "127.0.0.1",
      port: Number(match[1]),
      user: "postgres",
      password,
      database: "maison_miroir_security_test",
      max: 50,
      connectionTimeoutMillis: 5000,
    });
    let ready = false;
    let lastError;
    for (let attempt = 0; attempt < 30 && !ready; attempt++) {
      try {
        await pool.query("SELECT 1");
        ready = true;
      } catch (error) {
        lastError = error;
        await delay(1000);
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL did not start", { cause: lastError });
    for (const migration of fs.readdirSync("migrations").filter((file) => file.endsWith(".sql")).sort())
      await pool.query(fs.readFileSync(path.join("migrations", migration), "utf8"));

    let active = 0;
    let peak = 0;
    const backendPids = new Set();
    const transaction = async (callback) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        active++;
        peak = Math.max(peak, active);
        const result = await client.query("SELECT pg_backend_pid() AS pid");
        backendPids.add(result.rows[0].pid);
        const value = await callback(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        active--;
        client.release();
      }
    };
    const inventory = loadInventory(() => pool, transaction);
    const snapshot = { cgvVersion: "security-test", preparationDays: 3 };
    const reserve = (productId, promotionCode) => {
      const product = { id: productId, quantity: 1, unitPrice: 0.01 };
      return inventory.reserveCommerceCheckout({
        order: {
          product,
          items: [product],
          customer: { firstName: "Test", lastName: "Synthetic", email: "test@example.test" },
          acceptTerms: true,
          cgvVersion: snapshot.cgvVersion,
          promotionCode,
        },
        shippingCents: 0,
        orderSnapshot: snapshot,
      });
    };

    const promoResults = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) =>
        reserve(i % 2 ? "modest-era" : "paradise-way", "FIRSTPRINCESS1")),
    );
    const promoSuccess = promoResults.filter((result) => result.status === "fulfilled");
    const promoFailures = promoResults.filter((result) => result.status === "rejected");
    assert.equal(promoSuccess.length, 20);
    assert.equal(promoFailures.length, 20);
    assert(promoFailures.every((result) => result.reason.message === "FIRSTPRINCESS1_EXHAUSTED"));
    let result = await pool.query(
      "SELECT reserved_count, redeemed_count, max_redemptions FROM mm_promotions WHERE code=$1",
      ["FIRSTPRINCESS1"],
    );
    assert.deepEqual(result.rows[0], { reserved_count: 20, redeemed_count: 0, max_redemptions: 20 });
    assert(promoSuccess.every(({ value }) => value.items[0].unitPriceCents === 2990));
    for (const { value } of promoSuccess)
      await inventory.releaseCommerceReservation(value.reservationId);

    await pool.query(
      "UPDATE mm_promotions SET redeemed_count=19 WHERE code=$1",
      ["FIRSTPRINCESS1"],
    );
    const remainingResults = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        reserve(i % 2 ? "modest-era" : "paradise-way", "FIRSTPRINCESS1")),
    );
    const remainingSuccess = remainingResults.filter((entry) => entry.status === "fulfilled");
    const remainingFailures = remainingResults.filter((entry) => entry.status === "rejected");
    assert.equal(remainingSuccess.length, 1);
    assert.equal(remainingFailures.length, 19);
    assert(remainingFailures.every((entry) => entry.reason.message === "FIRSTPRINCESS1_EXHAUSTED"));
    result = await pool.query(
      "SELECT reserved_count, redeemed_count FROM mm_promotions WHERE code=$1",
      ["FIRSTPRINCESS1"],
    );
    assert.deepEqual(result.rows[0], { reserved_count: 1, redeemed_count: 19 });
    await inventory.releaseCommerceReservation(remainingSuccess[0].value.reservationId);
    await pool.query(
      "UPDATE mm_promotions SET redeemed_count=0 WHERE code=$1",
      ["FIRSTPRINCESS1"],
    );

    const stockResults = await Promise.allSettled(
      Array.from({ length: 50 }, () => reserve("modest-era")),
    );
    const stockSuccess = stockResults.filter((entry) => entry.status === "fulfilled");
    const stockFailures = stockResults.filter((entry) => entry.status === "rejected");
    assert.equal(stockSuccess.length, 44);
    assert.equal(stockFailures.length, 6);
    assert(stockFailures.every((entry) => entry.reason.message === "INVENTORY_UNAVAILABLE"));
    result = await pool.query(
      "SELECT quantity_on_hand, reserved_quantity FROM mm_commerce_products WHERE product_id=$1",
      ["modest-era"],
    );
    assert.deepEqual(result.rows[0], { quantity_on_hand: 44, reserved_quantity: 44 });
    assert(peak > 1 && backendPids.size > 1, "Expected concurrent transactions on independent PostgreSQL connections");
    console.log(`PASS: 20 concurrent promotion reservations maximum, 44 stock reservations maximum, ${backendPids.size} PostgreSQL connections, peak ${peak} transactions. Synthetic data only.`);
  } finally {
    if (pool) await pool.end();
    if (started) execFileSync("docker", ["stop", "--time", "2", name], { stdio: "pipe" });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
