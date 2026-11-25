import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RelayPoint } from "@/lib/mondialRelayTypes";

const MAX_PROOF_AGE_SECONDS = 6 * 60 * 60;

function relayPointData(point: RelayPoint) {
  return {
    id: point.id,
    location: point.location,
    label: point.label,
    address: point.address,
    postalCode: point.postalCode,
    city: point.city,
    ...(point.distanceKm === undefined ? {} : { distanceKm: point.distanceKm }),
    source: point.source,
    serviceCode: point.serviceCode,
  };
}

function hmac(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("MONDIAL_RELAY_POINT_SIGNING_NOT_CONFIGURED");
  return createHmac("sha256", secret)
    .update(`mondial-relay-point\0${value}`, "utf8")
    .digest("base64url");
}

export function signMondialRelayPoint(point: RelayPoint, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      point: relayPointData(point),
      expiresAt: Math.floor(now / 1000) + MAX_PROOF_AGE_SECONDS,
    }),
    "utf8",
  ).toString("base64url");
  return { ...point, proof: `${payload}.${hmac(payload)}` };
}

export function verifyMondialRelayPointProof(
  point: RelayPoint,
  now = Date.now(),
) {
  if (
    point.source !== "production" ||
    !point.proof ||
    !/^[0-9]{6}$/.test(point.id) ||
    point.location !== `FR-${point.id}`
  )
    return false;
  const [payload, signature, extra] = point.proof.split(".");
  if (!payload || !signature || extra) return false;
  let expected: string;
  try {
    expected = hmac(payload);
  } catch {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  )
    return false;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as { point?: unknown; expiresAt?: unknown };
    if (
      typeof record.expiresAt !== "number" ||
      record.expiresAt <= Math.floor(now / 1000) ||
      record.expiresAt >
        Math.floor(now / 1000) + MAX_PROOF_AGE_SECONDS
    )
      return false;
    return JSON.stringify(record.point) === JSON.stringify(relayPointData(point));
  } catch {
    return false;
  }
}

export function withoutMondialRelayPointProof(point: RelayPoint): RelayPoint {
  const storedPoint = { ...point };
  delete storedPoint.proof;
  return storedPoint;
}
