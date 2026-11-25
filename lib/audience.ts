import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { database } from "@/lib/newsletterDb";
import { clientIp } from "@/lib/requestSecurity";

const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AudienceClaims = {
  visitorId: string;
  sessionId: string;
  expiresAt: number;
};

function secret() {
  const value = process.env.NEWSLETTER_HASH_SECRET || "";
  if (Buffer.byteLength(value, "utf8") < 32)
    throw new Error("AUDIENCE_SIGNING_SECRET_NOT_CONFIGURED");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAudienceToken(previousToken?: string) {
  const previous = previousToken
    ? verifyAudienceToken(previousToken, true)
    : null;
  const visitorId = previous?.visitorId || randomUUID();
  const claims: AudienceClaims = {
    visitorId,
    sessionId: randomUUID(),
    expiresAt: Date.now() + TOKEN_LIFETIME_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    token: `${payload}.${signature(payload)}`,
    visitorId,
    expiresAt: claims.expiresAt,
  };
}

export function verifyAudienceToken(
  token: string,
  allowExpired = false,
): AudienceClaims | null {
  if (token.length > 4096) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AudienceClaims>;
    if (
      typeof claims.visitorId !== "string" ||
      !UUID_PATTERN.test(claims.visitorId) ||
      typeof claims.sessionId !== "string" ||
      !UUID_PATTERN.test(claims.sessionId) ||
      typeof claims.expiresAt !== "number" ||
      !Number.isSafeInteger(claims.expiresAt) ||
      (!allowExpired && claims.expiresAt <= Date.now())
    )
      return null;
    return claims as AudienceClaims;
  } catch {
    return null;
  }
}

export function normalizeAudiencePath(value: string) {
  const path = value.trim().toLowerCase();
  if (
    path.length > 160 ||
    !/^\/(?:[a-z0-9._/-]*)$/.test(path) ||
    path.includes("..") ||
    path.startsWith("/api/") ||
    path === "/api" ||
    path.startsWith("/admin") ||
    path.startsWith("/_next") ||
    path.startsWith("/77774555474447777554555")
  )
    return null;
  return path || "/";
}

export function audienceFunnelStage(path: string) {
  if (path === "/checkout" || path.startsWith("/checkout/")) return "checkout";
  if (path === "/panier" || path.startsWith("/panier/")) return "cart";
  return "browse";
}

export function isAudienceBot(userAgent: string) {
  return /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|uptime|health.?check/i.test(
    userAgent,
  );
}

export async function audienceRateLimit(
  scope: string,
  identity: string,
  maximum: number,
) {
  const digest = createHmac("sha256", secret())
    .update(`${scope}:${identity}`)
    .digest("hex");
  const result = await database().query(
    `INSERT INTO mm_rate_limits(key,count,expires_at)
     VALUES($1,1,now()+interval '10 minutes')
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END,
       expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN now()+interval '10 minutes' ELSE mm_rate_limits.expires_at END
     RETURNING count`,
    [`audience:${scope}:${digest}`],
  );
  return Number(result.rows[0]?.count || 0) <= maximum;
}

export async function audienceIpRateLimit(
  request: NextRequest,
  scope: string,
  maximum: number,
) {
  return audienceRateLimit(scope, clientIp(request), maximum);
}

let lastAudienceCleanupAt = 0;

export async function cleanupAudienceData() {
  const now = Date.now();
  if (now - lastAudienceCleanupAt < 60 * 60 * 1000) return;
  const db = database();
  await db.query(
    "DELETE FROM mm_audience_sessions WHERE last_heartbeat < now()-interval '24 hours'",
  );
  await db.query(
    "DELETE FROM mm_audience_events WHERE occurred_at < now()-interval '30 days'",
  );
  await db.query("DELETE FROM mm_rate_limits WHERE expires_at < now()");
  lastAudienceCleanupAt = now;
}
