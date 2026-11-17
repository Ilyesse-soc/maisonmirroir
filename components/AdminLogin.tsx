"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
export default function AdminLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          rememberMe: false,
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Trop de tentatives. Réessayez dans quelques minutes."
            : "Connexion impossible. Vérifiez vos identifiants ou réessayez plus tard.",
        );
      router.replace("/admin/newsletter");
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
        Adresse e-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Mot de passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <button disabled={busy}>{busy ? "Connexion?" : "Se connecter"}</button>
      <p role="status">{message}</p>
    </form>
  );
}
