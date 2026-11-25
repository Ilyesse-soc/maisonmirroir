import fs from "node:fs/promises";
import { processQueue } from "../lib/newsletter";
import { processMondialRelayShipmentQueue } from "../lib/mondialRelayShipmentQueue";
import { database } from "../lib/newsletterDb";
let stopping = false,
  failures = 0;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
while (!stopping) {
  try {
    const newsletterProcessed =
      process.env.NEWSLETTER_SEND_ENABLED === "false" ? 0 : await processQueue();
    const shipmentProcessed = await processMondialRelayShipmentQueue();
    failures = 0;
    console.info(
      JSON.stringify({
        code: "WORKER_CYCLE_COMPLETED",
        newsletterProcessed,
        shipmentProcessed,
      }),
    );
  } catch {
    failures++;
    console.error(JSON.stringify({ code: "WORKER_CYCLE_FAILED", failures }));
  }
  await fs.writeFile(
    "/tmp/worker-health.json",
    JSON.stringify({ at: Date.now(), failures }),
  );
  if (failures >= 3) {
    process.exitCode = 1;
    break;
  }
  for (let elapsed = 0; elapsed < 60000 && !stopping; elapsed += 1000)
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
await database().end();
