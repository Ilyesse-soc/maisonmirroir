"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AUDIENCE_IDENTITY_KEY,
  CONSENT_CHANGED_EVENT,
  COOKIE_PREFERENCES_EVENT,
  LEGACY_AUDIENCE_CONSENT_KEY,
  PRIVACY_PREFERENCES_KEY,
  createPrivacyPreferences,
  parsePrivacyPreferences,
} from "@/lib/privacyConsent";

function getSnapshot() {
  try {
    return localStorage.getItem(PRIVACY_PREFERENCES_KEY) || "unset";
  } catch {
    return "unavailable";
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CONSENT_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CONSENT_CHANGED_EVENT, listener);
  };
}

async function withdrawAudienceIdentity() {
  const raw = localStorage.getItem(AUDIENCE_IDENTITY_KEY);
  const identity = raw ? (JSON.parse(raw) as { token?: unknown }) : null;
  if (typeof identity?.token === "string" && identity.token) {
    const response = await fetch("/api/audience/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({ token: identity.token }),
    });
    if (!response.ok) throw new Error("AUDIENCE_WITHDRAWAL_FAILED");
  }
  localStorage.removeItem(AUDIENCE_IDENTITY_KEY);
  localStorage.removeItem(LEGACY_AUDIENCE_CONSENT_KEY);
}

export default function AudienceConsent() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "unset");
  const preferences = parsePrivacyPreferences(snapshot);
  const [panelOpen, setPanelOpen] = useState(false);
  const [audience, setAudience] = useState(false);
  const [error, setError] = useState("");
  const [expiryTick, setExpiryTick] = useState(0);
  const audienceAllowed = preferences?.audience === true;
  const preferenceExpiry = preferences?.expiresAt;

  useEffect(() => {
    if (audienceAllowed) return;

    let active = true;
    try {
      const hasLegacyChoice = Boolean(
        localStorage.getItem(LEGACY_AUDIENCE_CONSENT_KEY),
      );
      const hasIdentity = Boolean(localStorage.getItem(AUDIENCE_IDENTITY_KEY));
      if (!hasLegacyChoice && !hasIdentity) return;
    } catch {
      return;
    }

    void withdrawAudienceIdentity().catch(() => {
      if (!active) return;
      setError(
        "La mesure est arrêtée dans ce navigateur, mais la suppression des anciennes données sur le serveur doit être réessayée.",
      );
      setPanelOpen(true);
    });
    return () => {
      active = false;
    };
  }, [audienceAllowed, preferenceExpiry, snapshot]);

  useEffect(() => {
    window.addEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
    return () =>
      window.removeEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);

    function openPreferences() {
      setAudience(parsePrivacyPreferences(getSnapshot())?.audience ?? false);
      setPanelOpen(true);
      setError("");
    }
  }, []);

  useEffect(() => {
    const expiresAt = preferences?.expiresAt;
    if (expiresAt === undefined) return;
    const delay = Math.min(
      Math.max(0, expiresAt - Date.now() + 1),
      2_147_000_000,
    );
    const timer = window.setTimeout(
      () => setExpiryTick(Date.now()),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [preferences?.expiresAt, expiryTick]);

  function saveChoice(allowAudience: boolean) {
    try {
      localStorage.setItem(
        PRIVACY_PREFERENCES_KEY,
        JSON.stringify(createPrivacyPreferences(allowAudience)),
      );
      localStorage.removeItem(LEGACY_AUDIENCE_CONSENT_KEY);
      window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
      setPanelOpen(false);
      setError("");
    } catch {
      setError("Votre choix n’a pas pu être enregistré dans ce navigateur.");
      setPanelOpen(true);
      return;
    }
  }

  async function retryWithdrawal() {
    try {
      await withdrawAudienceIdentity();
      setError("");
    } catch {
      setError(
        "La suppression des données sur le serveur a échoué. Réessayez plus tard.",
      );
    }
  }

  const visible = panelOpen || !preferences;

  if (!visible) return null;

  return (
    <section
      className="cookie-consent"
      aria-labelledby="cookie-consent-title"
      role="dialog"
    >
      <div className="cookie-consent-heading">
        <div>
          <p className="cookie-consent-eyebrow">MAISON MIROIR</p>
          <h2 id="cookie-consent-title">
            Votre confidentialité compte pour nous
          </h2>
        </div>
        {preferences && (
          <button
            type="button"
            className="cookie-consent-close"
            aria-label="Fermer les préférences de cookies"
            onClick={() => setPanelOpen(false)}
          >
            Fermer
          </button>
        )}
      </div>

      <p className="cookie-consent-copy">
        Maison Miroir utilise des cookies nécessaires au bon fonctionnement de
        sa boutique. Avec votre accord, nous utilisons également des outils de
        mesure d’audience afin d’améliorer votre expérience de navigation.
      </p>
      <p className="cookie-consent-copy">
        Vous pouvez accepter, refuser ou personnaliser vos préférences à tout
        moment.
      </p>
      <p className="cookie-consent-policy">
        <Link href="/politique-de-cookies">Politique de cookies</Link>
      </p>

      {panelOpen && (
        <div className="cookie-consent-options">
          <section aria-labelledby="cookie-essential-title">
            <h3 id="cookie-essential-title">Cookies essentiels</h3>
            <p>
              Toujours actifs. Nécessaires au fonctionnement du panier, à la
              sécurité, à la gestion des sessions et à la mémorisation de vos
              préférences de confidentialité.
            </p>
            <span className="cookie-essential-status">Toujours actifs</span>
          </section>
          <section aria-labelledby="cookie-audience-title">
            <div className="cookie-option-heading">
              <div>
                <h3 id="cookie-audience-title">Mesure d’audience</h3>
                <p>
                  Facultative. Elle nous aide à comprendre la fréquentation et
                  à améliorer la boutique. Elle reste désactivée sans votre
                  accord.
                </p>
              </div>
              <label className="cookie-toggle">
                <span className="visually-hidden">
                  Autoriser la mesure d’audience
                </span>
                <input
                  type="checkbox"
                  checked={audience}
                  onChange={(event) => setAudience(event.target.checked)}
                />
                <span aria-hidden="true" />
              </label>
            </div>
          </section>
          <p className="cookie-consent-no-marketing">
            Aucun traceur marketing n’est actuellement utilisé.
          </p>
        </div>
      )}

      {error && (
        <p className="cookie-consent-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => void retryWithdrawal()}
          >
            Réessayer la suppression
          </button>
        </p>
      )}

      <div className="cookie-consent-actions">
        <button
          type="button"
          className="cookie-consent-action cookie-consent-action--accept"
          onClick={() => void saveChoice(true)}
        >
          Tout accepter
        </button>
        <button
          type="button"
          className="cookie-consent-action cookie-consent-action--reject"
          onClick={() => void saveChoice(false)}
        >
          Tout refuser
        </button>
        {panelOpen ? (
          <button
            type="button"
            className="cookie-consent-action cookie-consent-action--save"
            onClick={() => void saveChoice(audience)}
          >
            Enregistrer mes choix
          </button>
        ) : (
          <button
            type="button"
            className="cookie-consent-action cookie-consent-action--customize"
            onClick={() => {
              setAudience(preferences?.audience ?? false);
              setPanelOpen(true);
            }}
          >
            Personnaliser
          </button>
        )}
      </div>
    </section>
  );
}
