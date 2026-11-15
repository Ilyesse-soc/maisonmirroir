import { betterAuth } from "better-auth";
import type { Pool } from "pg";
export function makeAuth(pool: Pool, bootstrap = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL =
    process.env.BETTER_AUTH_URL || process.env.NEWSLETTER_SITE_URL;
  if (!secret || secret.length < 32 || !baseURL)
    throw new Error("AUTH_NOT_CONFIGURED");
  if (
    process.env.NODE_ENV === "production" &&
    new URL(baseURL).protocol !== "https:"
  )
    throw new Error("AUTH_HTTPS_REQUIRED");
  return betterAuth({
    appName: "Maison Miroir",
    database: pool,
    baseURL,
    secret,
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !bootstrap,
      minPasswordLength: 14,
      maxPasswordLength: 128,
    },
    user: { modelName: "mm_auth_user" },
    account: { modelName: "mm_auth_account" },
    verification: { modelName: "mm_auth_verification" },
    session: {
      modelName: "mm_auth_session",
      expiresIn: 8 * 60 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "mm_auth_rate_limit",
      window: 60,
      max: 30,
      customRules: { "/sign-in/email": { window: 300, max: 5 } },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      },
      ipAddress: {
        ipAddressHeaders: process.env.VERCEL
          ? ["x-vercel-forwarded-for"]
          : ["x-forwarded-for"],
      },
    },
  });
}
