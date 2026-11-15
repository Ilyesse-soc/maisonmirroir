import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { database } from "@/lib/newsletterDb";
import { makeAuth } from "@/lib/authConfiguration";
import {
  readJson,
  mutationAllowed,
  InputError,
  inputResponse,
  clientIp,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
const schema = z
  .object({
    key: z.string().regex(/^[a-f0-9]{64}$/),
    password: z.string().min(14).max(128),
  })
  .strict();
export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  let client;
  try {
    const data = await readJson(request, schema);
    client = await database().connect();
    await client.query("BEGIN");
    const rateKey =
      "admin-setup:" +
      createHash("sha256")
        .update((process.env.NEWSLETTER_HASH_SECRET || "") + clientIp(request))
        .digest("hex");
    const rate = (
      await client.query(
        "INSERT INTO mm_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '5 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END,expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN now()+interval '5 minutes' ELSE mm_rate_limits.expires_at END RETURNING count",
        [rateKey],
      )
    ).rows[0];
    if (rate.count > 5) {
      await client.query("COMMIT");
      return new NextResponse(null, { status: 429 });
    }
    const setup = (
      await client.query(
        "SELECT * FROM mm_admin_setup WHERE singleton=true FOR UPDATE",
      )
    ).rows[0];
    const actual = Buffer.from(
        createHash("sha256").update(data.key).digest("hex"),
      ),
      expected = Buffer.from(setup?.token_hash || "");
    if (
      !setup ||
      setup.claimed_at ||
      new Date(setup.expires_at).getTime() < Date.now() ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      await client.query("COMMIT");
      return new NextResponse(null, { status: 403 });
    }
    const email = (
      process.env.ADMIN_EMAIL ||
      process.env.EMAIL_ADMIN ||
      process.env.OWNER_EMAIL ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!email) throw Error("ADMIN_NOT_CONFIGURED");
    await makeAuth(database(), true).api.signUpEmail({
      body: { name: "Maison Miroir", email, password: data.password },
    });
    await client.query(
      "UPDATE mm_admin_setup SET claimed_at=now(),token_hash=NULL WHERE singleton=true",
    );
    await client.query("COMMIT");
    securityEvent("ADMIN_SETUP_COMPLETED", "info");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("ADMIN_SETUP_FAILED");
    return NextResponse.json(
      { error: "Initialisation impossible." },
      { status: 503 },
    );
  } finally {
    client?.release();
  }
}
