"use client";

import { useState, useSyncExternalStore } from "react";

const CONSENT_KEY = "mm-audience-consent-v1";
const IDENTITY_KEY = "mm-audience-identity-v1";

type Choice = "accepted" | "rejected";
type ConsentStatus = Choice | "pending" | "unset" | "unavailable";

function getConsentSnapshot(): ConsentStatus {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "rejected" ? stored : "unset";
  } catch {
    return "unavailable";
  }
}

function subscribeConsent(listener: () => void) {
  const handleChange = () => listener();
  window.addEventListener("storage", handleChange);
  window.addEventListener("mm-audience-consent-change", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("mm-audience-consent-change", handleChange);
  };
}

export default function AudienceConsent() {
  const consentStatus = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    () => "pending",
  );
  const choice: Choice | null =
    consentStatus === "accepted" || consentStatus === "rejected"
      ? consentStatus
      : null;
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const visible =
    panelOpen ||
    consentStatus === "unset" ||
    consentStatus === "unavailable";

  async function saveChoice(next: Choice) {
    let identity: { token?: string } | null = null;
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      identity = raw ? (JSON.parse(raw) as { token?: string }) : null;
      localStorage.setItem(CONSENT_KEY, next);
    } catch {
      setError("Le choix n’a pas pu être enregistré dans ce navigateur.");
      setPanelOpen(true);
      return;
    }
    setPanelOpen(false);
    setError("");
    window.dispatchEvent(new Event("mm-audience-consent-change"));

    if (next === "rejected") {
      try {
        if (identity?.token) {
          const response = await fetch("/api/audience/consent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            keepalive: true,
            body: JSON.stringify({ token: identity.token }),
          });
          if (!response.ok)
            throw new Error("AUDIENCE_WITHDRAWAL_FAILED");
        }
        localStorage.removeItem(IDENTITY_KEY);
      } catch {
        setError(
          "La mesure est arrêtée dans ce navigateur, mais la suppression des données sur le serveur doit être réessayée.",
        );
        setPanelOpen(true);
        return;
      }
    }
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 11000,
    left: 16,
    bottom: 16,
    width: "min(420px, calc(100vw - 32px))",
    boxSizing: "border-box",
    padding: 18,
    border: "1px solid #d8c6aa",
    borderRadius: 8,
    background: "#fffdfa",
    color: "#2c2416",
    boxShadow: "0 8px 30px rgba(44, 36, 22, .18)",
    font: '400 14px/1.55 "Jost", sans-serif',
  };

  return (
    <>
      {visible ? (
        <section
          role="dialog"
          aria-labelledby="audience-consent-title"
          style={panelStyle}
        >
          <strong id="audience-consent-title">Mesure d’audience</strong>
          <p style={{ margin: "8px 0 14px" }}>
            Avec votre accord, nous mesurons la fréquentation du site. Les
            statistiques n’enregistrent ni votre adresse IP ni vos coordonnées.
            Votre choix ne change rien au fonctionnement de la boutique.
          </p>
          {error && (
            <p role="alert" style={{ color: "#7d251e", margin: "0 0 12px" }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => void saveChoice("rejected")}
              style={{
                border: "1px solid #8c6d14",
                borderRadius: 4,
                padding: "9px 13px",
                background: "#fffdfa",
                color: "#453722",
                cursor: "pointer",
                font: '500 13px "Jost", sans-serif',
              }}
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => void saveChoice("accepted")}
              style={{
                border: "1px solid #684633",
                borderRadius: 4,
                padding: "9px 13px",
                background: "#684633",
                color: "#fff9f0",
                cursor: "pointer",
                font: '500 13px "Jost", sans-serif',
              }}
            >
              Autoriser les statistiques
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          aria-label="Gérer les préférences de mesure d’audience"
          onClick={() => setPanelOpen(true)}
          style={{
            position: "fixed",
            zIndex: 10999,
            left: 12,
            bottom: 12,
            border: "1px solid #d8c6aa",
            borderRadius: 20,
            padding: "7px 12px",
            background: "#fffdfa",
            color: "#5a4a2e",
            cursor: "pointer",
            font: '400 11px "Jost", sans-serif',
            boxShadow: "0 3px 12px rgba(44, 36, 22, .12)",
          }}
        >
          Préférences statistiques
        </button>
      )}
      {!visible && choice && (
        <span className="visually-hidden" aria-live="polite">
          Mesure d’audience :{" "}
          {choice === "accepted" ? "autorisée" : "refusée"}.
        </span>
      )}
    </>
  );
}
