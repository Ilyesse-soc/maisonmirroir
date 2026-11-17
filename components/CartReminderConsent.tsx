"use client";
import { useState } from "react";
import { useCart } from "./CartProvider";
export default function CartReminderConsent({ email }: { email: string }) {
  const { items } = useCart(),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState("");
  async function update(checked: boolean) {
    setConsent(checked);
    try {
      const r = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          email,
          consent: checked,
        }),
      });
      if (!r.ok) throw Error();
      setMessage(
        checked
          ? "Votre choix est enregistré."
          : "Vous ne recevrez pas de rappel de panier.",
      );
    } catch {
      setMessage("Votre choix n’a pas pu être enregistré. Veuillez réessayer.");
      setConsent(false);
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => void update(e.target.checked)}
        />{" "}
        J’accepte de recevoir un rappel par e-mail si je laisse mon panier
        pendant 48 heures. Je peux me désinscrire à tout moment.
      </label>
      <p role="status">{message}</p>
    </div>
  );
}
