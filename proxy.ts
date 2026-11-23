import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const production = process.env.NODE_ENV === "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const payment =
    process.env.SHOP_OPEN === "true"
      ? " https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com"
      : "";
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    `connect-src 'self'${production ? "" : " ws: wss:"}${payment}`,
    `frame-src 'self'${payment}`,
    ...(production && request.nextUrl.protocol === "https:"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");
  const forwarded = new Headers(request.headers);
  forwarded.set("x-nonce", nonce);
  forwarded.set("Content-Security-Policy", policy);
  let response: NextResponse;
  if (
    process.env.SHOP_OPEN !== "true" &&
    /^\/(panier|checkout)(\/|$)/.test(path)
  )
    response = NextResponse.redirect(new URL("/", request.url));
  else response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  response.headers.set("X-Frame-Options", "DENY");
  if (production && request.nextUrl.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (
    path.startsWith("/77774555474447777554555") ||
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/connexion") ||
    path.startsWith("/newsletter")
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|woff2?|ttf|svg|txt)$).*)",
  ],
};
