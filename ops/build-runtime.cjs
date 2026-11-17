const esbuild = require("esbuild");
async function main() {
  for (const [entry, name] of [
    ["ops/worker.ts", "worker"],
    ["ops/migrate.ts", "migrate"],
    ["ops/import-orders.ts", "import-orders"],
  ])
    await esbuild.build({
      entryPoints: [entry],
      outfile: "dist/" + name + ".mjs",
      bundle: true,
      platform: "node",
      target: "node24",
      format: "esm",
      conditions: ["react-server"],
      packages: "bundle",
      external: ["pg"],
      banner: {
        js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);",
      },
    });
}
main().catch(() => {
  console.error("Runtime bundling failed");
  process.exitCode = 1;
});
