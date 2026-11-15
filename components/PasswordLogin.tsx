"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PATH } from "@/lib/adminPath";
export default function PasswordLogin() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin-access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      });
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "Trop de tentatives. Patientez quelques minutes."
            : "Connexion impossible. Vérifiez votre mot de passe ou réessayez plus tard.",
        );
      router.replace(ADMIN_PATH);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Votre mot de passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={14}
          maxLength={128}
          required
        />
      </label>
      <button disabled={busy}>
        {busy ? "Connexion en cours..." : "Entrer dans mon espace"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
