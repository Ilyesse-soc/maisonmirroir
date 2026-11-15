"use client";
import { useSyncExternalStore } from "react";
const subscribe = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
export default function NewsletterTokenForm({
  initialToken = "",
  action,
  label,
}: {
  initialToken?: string;
  action: string;
  label: string;
}) {
  const token = useSyncExternalStore(
    subscribe,
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("token") ||
      initialToken,
    () => initialToken,
  );
  return (
    <form method="post" action={action}>
      <input type="hidden" name="token" value={token} />
      <button>{label}</button>
    </form>
  );
}
