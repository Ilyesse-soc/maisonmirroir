"use client";
import { useEffect, useState } from "react";
type Cart = {
  id: string;
  email: string;
  items: { name: string; quantity: number }[];
  consent: boolean;
  status: string;
  updated_at: string;
  reminder_status: string | null;
};
export default function AbandonedCartsAdmin() {
  const [carts, setCarts] = useState<Cart[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/carts", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (active) setCarts(d.carts);
      })
      .catch(() => {
        if (active) setMessage("Paniers indisponibles.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function remind(id: string) {
    try {
      const r = await fetch("/api/admin/carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error();
      setMessage(
        d.queued
          ? "Relance ajoutée à la file."
          : "Aucune relance ajoutée : délai de 48 heures, consentement ou boutique ouverte requis, ou rappel déjà préparé.",
      );
    } catch {
      setMessage("Relance impossible.");
    }
  }
  return (
    <section>
      <h2>Paniers à retrouver</h2>
      <p>
        Relance automatique après 48 heures sans modification, uniquement avec
        consentement. Un rappel par version du panier. Les commandes terminées
        et les désinscriptions annulent les relances en attente.
      </p>
      <p role="status">{message}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Articles</th>
              <th>Dernière activité</th>
              <th>État</th>
              <th>Relance</th>
            </tr>
          </thead>
          <tbody>
            {carts.map((c) => (
              <tr key={c.id}>
                <td>{c.email}</td>
                <td>
                  {c.items.map((i, index) => (
                    <div key={index}>
                      {i.name} ? {i.quantity}
                    </div>
                  ))}
                </td>
                <td>{new Date(c.updated_at).toLocaleString("fr-FR")}</td>
                <td>
                  {c.status} ?{" "}
                  {c.consent ? "consentement reçu" : "sans consentement"}
                </td>
                <td>
                  {c.reminder_status || "Aucun rappel"}
                  <button
                    disabled={!c.consent || c.status !== "active"}
                    onClick={() => void remind(c.id)}
                  >
                    Préparer la relance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
