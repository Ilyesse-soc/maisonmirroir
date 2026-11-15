"use client";
import { FormEvent, useRef, useState } from "react";
export default function NewsletterForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          consent: data.get("consent") === "on",
          website: data.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "L’inscription est momentanément indisponible.",
        );
      setSuccess(true);
      setMessage(
        "Consultez votre boîte e-mail et confirmez votre inscription grâce au lien reçu.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Veuillez réessayer plus tard.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="newsletter-form">
      <div className="signup-row">
        <label className="email-field">
          <span aria-hidden="true">✉</span>
          <span className="sr-only">Votre adresse e-mail</span>
          <input
            type="email"
            name="email"
            placeholder="Votre adresse e-mail"
            autoComplete="email"
            maxLength={254}
            required
            disabled={success}
          />
        </label>
        <button disabled={busy || success} type="submit">
          {busy
            ? "INSCRIPTION EN COURS…"
            : success
              ? "VÉRIFIEZ VOTRE BOÎTE E-MAIL"
              : "REJOINDRE LA LISTE PRIVÉE"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="honeypot" aria-hidden="true">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="consent">
        <input type="checkbox" name="consent" required disabled={success} />
        <span>
          J’accepte de recevoir les nouveautés, offres exclusives et annonces de
          Maison Miroir. Désinscription à tout moment.{" "}
          <a href="/politique-de-confidentialite">Confidentialité</a>
        </span>
      </label>
      <p
        role="status"
        aria-live="polite"
        className={success ? "form-message success" : "form-message"}
      >
        {message}
      </p>
    </form>
  );
}
