"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function AdminSessionControls() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    try {
      const r = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw Error();
      router.replace("/77774555474447777554555");
      router.refresh();
    } catch {
      setError("Déconnexion impossible. Veuillez réessayer.");
    }
  }
  return (
    <div style={{ padding: 12, background: "#f3ece1", textAlign: "right" }}>
      <button onClick={logout}>Se déconnecter</button>
      <span role="status">{error}</span>
    </div>
  );
}
