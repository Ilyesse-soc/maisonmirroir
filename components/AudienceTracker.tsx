"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/CartProvider";

const CONSENT_KEY = "mm-audience-consent-v1";
const IDENTITY_KEY = "mm-audience-identity-v1";
const SESSION_IDLE_MS = 30 * 60 * 1000;

type StoredIdentity = {
  token: string;
  visitorId: string;
  expiresAt: number;
  lastSeenAt: number;
};

function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

function storedIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredIdentity>;
    if (
      typeof value.token !== "string" ||
      typeof value.visitorId !== "string" ||
      typeof value.expiresAt !== "number" ||
      typeof value.lastSeenAt !== "number"
    )
      return null;
    return value as StoredIdentity;
  } catch {
    return null;
  }
}

async function getIdentity(): Promise<StoredIdentity> {
  const issueOrReuse = async () => {
    const existing = storedIdentity();
    if (
      existing &&
      existing.expiresAt > Date.now() + 60_000 &&
      Date.now() - existing.lastSeenAt < SESSION_IDLE_MS
    )
      return existing;
    const response = await fetch("/api/audience/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(
        existing?.token ? { previousToken: existing.token } : {},
      ),
    });
    if (!response.ok) throw new Error("AUDIENCE_SESSION_UNAVAILABLE");
    const issued = (await response.json()) as {
      token: string;
      visitorId: string;
      expiresAt: number;
    };
    const next = {
      ...issued,
      lastSeenAt: Date.now(),
    };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
    return next;
  };

  if (navigator.locks?.request)
    return navigator.locks.request("mm-audience-session", issueOrReuse);
  return issueOrReuse();
}

export default function AudienceTracker() {
  const pathname = usePathname();
  const { items } = useCart();
  const pathRef = useRef(pathname || "/");
  const hasCartItemsRef = useRef(items.length > 0);
  const pageViewIdRef = useRef<string | null>(null);

  useEffect(() => {
    pathRef.current = pathname || "/";
    pageViewIdRef.current = crypto.randomUUID();
    if (hasConsent())
      window.dispatchEvent(new Event("mm-audience-consent-change"));
  }, [pathname]);

  useEffect(() => {
    hasCartItemsRef.current = items.length > 0;
    if (hasConsent())
      window.dispatchEvent(new Event("mm-audience-consent-change"));
  }, [items.length]);

  useEffect(() => {
    let active = true;
    let sending = false;
    const sendHeartbeat = async () => {
      if (
        !active ||
        sending ||
        !hasConsent()
      )
        return;
      sending = true;
      const pageViewId = pageViewIdRef.current;
      try {
        const identity = await getIdentity();
        const response = await fetch("/api/audience/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            token: identity.token,
            path: pathRef.current,
            hasCartItems: hasCartItemsRef.current,
            ...(pageViewId ? { pageViewId } : {}),
          }),
        });
        if (!response.ok) return;
        const latest = storedIdentity();
        if (latest?.token === identity.token) {
          localStorage.setItem(
            IDENTITY_KEY,
            JSON.stringify({ ...latest, lastSeenAt: Date.now() }),
          );
        }
        if (pageViewIdRef.current === pageViewId)
          pageViewIdRef.current = null;
      } catch {
        return;
      } finally {
        sending = false;
      }
    };

    const onConsentChange = () => void sendHeartbeat();
    window.addEventListener("mm-audience-consent-change", onConsentChange);
    window.addEventListener("storage", onConsentChange);
    const timer = window.setInterval(() => void sendHeartbeat(), 30_000);
    if (hasConsent())
      void sendHeartbeat();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(
        "mm-audience-consent-change",
        onConsentChange,
      );
      window.removeEventListener("storage", onConsentChange);
    };
  }, []);

  return null;
}
