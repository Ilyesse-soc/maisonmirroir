"use client";

import { FormEvent, useState } from "react";

export default function RetractionRequestForm() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/retractation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim().toUpperCase(),
          email: email.trim(),
          confirmRetraction: confirmed,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Trop de tentatives. Réessayez plus tard."
            : "La demande n’a pas pu être enregistrée. Réessayez ou contactez-nous par e-mail.",
        );
      setMessage(
        data.message ||
          "Votre demande a été enregistrée. Un accusé de réception vous sera envoyé par e-mail si la commande est retrouvée.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La demande n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="legal-form">
      <label>
        Numéro de commande
        <input
          required
          autoComplete="off"
          pattern="MM-[0-9]{4}-[A-Z0-9]{8}"
          maxLength={16}
          value={orderId}
          onChange={(event) => setOrderId(event.target.value.toUpperCase())}
        />
      </label>
      <label>
        Adresse e-mail utilisée pour la commande
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="legal-checkbox">
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          Je demande la rétractation de la commande identifiée ci-dessus.
        </span>
      </label>
      <button type="submit" disabled={busy || !confirmed}>
        {busy ? "Envoi en cours..." : "Envoyer ma demande"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
