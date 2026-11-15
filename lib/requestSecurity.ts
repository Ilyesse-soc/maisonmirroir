import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
export class InputError extends Error {
  constructor(public status = 400) {
    super("INVALID_REQUEST");
  }
}
export function mutationAllowed(request: NextRequest, json = true) {
  const origin = request.headers.get("origin");
  const allowed = new Set([
    request.nextUrl.origin,
    ...(process.env.NEWSLETTER_SITE_URL
      ? [new URL(process.env.NEWSLETTER_SITE_URL).origin]
      : []),
  ]);
  if (origin && !allowed.has(origin))
    return new NextResponse(null, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new NextResponse(null, { status: 403 });
  if (
    json &&
    request.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    return new NextResponse(null, { status: 415 });
  return null;
}
export async function readBoundedText(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new InputError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new InputError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 4096,
): Promise<T> {
  try {
    return schema.parse(JSON.parse(await readBoundedText(request, limit)));
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError();
  }
}
export function inputResponse(error: unknown) {
  return NextResponse.json(
    { error: "Requête invalide." },
    { status: error instanceof InputError ? error.status : 400 },
  );
}
export function clientIp(request: NextRequest) {
  return (
    (process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for")
      : request.headers.get("x-forwarded-for")
    )
      ?.split(",")[0]
      ?.trim()
      .slice(0, 64) || "unknown"
  );
}
