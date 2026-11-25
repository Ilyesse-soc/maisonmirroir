"use client";

import { useEffect, useState } from "react";

type Product = {
  product_id: string;
  name: string;
  color: string;
  price_cents: number;
  initial_quantity: number;
  quantity_on_hand: number;
  reserved_quantity: number;
  sold_quantity: number;
  available_quantity: number;
  active: boolean;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; price: string; reason: string }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  const refresh = async () => {
    const response = await fetch("/api/admin/inventory", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Inventaire indisponible.");
    setProducts(data.products);
    setDrafts(Object.fromEntries(data.products.map((product: Product) => [
      product.product_id,
      { quantity: String(product.quantity_on_hand), price: (product.price_cents / 100).toFixed(2), reason: "" },
    ])));
  };
  useEffect(() => {
    let active = true;
    fetch("/api/admin/inventory", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Inventaire indisponible.");
        if (!active) return;
        setProducts(data.products);
        setDrafts(Object.fromEntries(data.products.map((product: Product) => [
          product.product_id,
          { quantity: String(product.quantity_on_hand), price: (product.price_cents / 100).toFixed(2), reason: "" },
        ])));
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Inventaire indisponible."); });
    return () => { active = false; };
  }, []);

  const save = async (product: Product) => {
    const draft = drafts[product.product_id];
    const price = Number(draft.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price * 100)) {
      setError("Saisissez un prix positif ou nul avec au maximum deux décimales.");
      return;
    }
    setPending(product.product_id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.product_id, quantity: Number(draft.quantity),
          priceCents: Math.round(price * 100), reason: draft.reason,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setMessage(`Modification enregistrée pour ${product.name}.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally { setPending(""); }
  };

  return <main className="admin-page">
    <h1>Stocks et inventaire</h1>
    <p className="admin-muted">Quantités issues du stock commerce, réservations et ventes réelles. Toute correction est journalisée.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {message && <p className="admin-success" role="status">{message}</p>}
    <div className="admin-grid">{products.map((product) => {
      const draft = drafts[product.product_id];
      if (!draft) return null;
      return <section className="admin-card" key={product.product_id}>
        <h2>{product.name}</h2><p className="admin-muted">{product.color} · {product.product_id}</p>
        <p>Initial : {product.initial_quantity} · Réservé : {product.reserved_quantity} · Vendu : {product.sold_quantity}</p>
        <p><strong>Disponible : {product.available_quantity}</strong></p>
        <label>Quantité totale<input type="number" min={product.reserved_quantity} step="1" value={draft.quantity} onChange={(event) => setDrafts((value) => ({ ...value, [product.product_id]: { ...value[product.product_id], quantity: event.target.value } }))} /></label>
        <label>Prix en euros<input inputMode="decimal" value={draft.price} onChange={(event) => setDrafts((value) => ({ ...value, [product.product_id]: { ...value[product.product_id], price: event.target.value } }))} /></label>
        <label>Motif obligatoire<input maxLength={500} value={draft.reason} onChange={(event) => setDrafts((value) => ({ ...value, [product.product_id]: { ...value[product.product_id], reason: event.target.value } }))} /></label>
        <button type="button" disabled={pending === product.product_id || draft.reason.trim().length < 3} onClick={() => void save(product)}>{pending === product.product_id ? "Enregistrement…" : "Enregistrer la correction"}</button>
      </section>;
    })}</div>
  </main>;
}
