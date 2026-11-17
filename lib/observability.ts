import "server-only";
// Fixed codes only: never accept request bodies or arbitrary exception messages.
export function securityEvent(
  code: string,
  level: "info" | "warn" | "error" = "error",
) {
  const entry = JSON.stringify({
    code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "UNKNOWN_EVENT",
    level,
    at: new Date().toISOString(),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
