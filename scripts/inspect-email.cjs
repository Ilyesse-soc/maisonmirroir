// Read-only provider/domain inspection. Never prints a credential or sends mail.
require("@next/env").loadEnvConfig(process.cwd());
const dns = require("node:dns/promises");
async function main() {
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || "";
  const domain = from.match(/@([^>\s]+)/)?.[1];
  if (domain) {
    for (const name of [domain, `_dmarc.${domain}`]) {
      try {
        const records = await dns.resolveTxt(name);
        console.log(
          name,
          records
            .map((r) => r.join(""))
            .filter((r) => /v=spf1|v=DMARC1/.test(r)),
        );
      } catch (error) {
        console.log(name, "TXT lookup unavailable:", error.code);
      }
    }
  }
  if (!process.env.RESEND_API_KEY) {
    console.log("Resend key absent");
    return;
  }
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!response.ok) {
    console.log(
      "Resend domain inspection HTTP",
      response.status,
      "(no delivery test performed)",
    );
    return;
  }
  const data = await response.json();
  for (const d of data.data || []) {
    console.log("Sending domain", d.name, "status", d.status);
    const detail = await fetch(
      `https://api.resend.com/domains/${encodeURIComponent(d.id)}`,
      { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } },
    );
    if (detail.ok) {
      const info = await detail.json();
      for (const record of info.records || [])
        console.log(
          "DNS verification",
          record.record,
          record.name,
          record.status,
        );
    }
  }
  console.log(
    "Provider domain inspection completed. Quotas and real delivery remain untested.",
  );
}
main().catch(() => {
  console.error("Read-only inspection unavailable. No mail sent.");
  process.exitCode = 1;
});
