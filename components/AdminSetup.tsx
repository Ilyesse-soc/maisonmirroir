"use client";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PATH } from "@/lib/adminPath";
const subscribe = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
export default function AdminSetup() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(location.hash.slice(1)).get("key") || "",
    () => "",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmation")) {
      setMessage("Les deux mots de passe doivent être identiques.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin-access/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, password: data.get("password") }),
      });
      if (!response.ok)
        throw Error(
          "Initialisation impossible. Le lien privé est invalide, expiré ou déjà utilisé.",
        );
      // The password stays in memory only; the secure session cookie is set by login.
      await fetch("/api/admin-access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      }).catch(() => null);
      history.replaceState(null, "", location.pathname);
      router.replace(ADMIN_PATH);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Initialisation impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!key)
    return (
      <p>
        Vous n’avez pas encore défini votre mot de passe. Ouvrez votre lien
        privé de première connexion pour le créer une seule fois. Vous
        réutiliserez ensuite ce même mot de passe sur cette page.
      </p>
    );
  return (
    <form onSubmit={submit}>
      <p>
        Choisissez un mot de passe unique d’au moins 14 caractères. Vous le
        réutiliserez ensuite pour entrer dans votre espace.
      </p>
      <label>
        Créer mon mot de passe
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={14}
          maxLength={128}
          required
        />
      </label>
      <label>
        Confirmer mon mot de passe
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={14}
          maxLength={128}
          required
        />
      </label>
      <button disabled={busy}>
        {busy ? "Enregistrement en cours…" : "Créer mon mot de passe"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
