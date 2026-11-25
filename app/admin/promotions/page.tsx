"use client";

import { useEffect, useState } from "react";

type Promotion = {
  code: string; discount_type: "percent" | "fixed"; discount_value: number;
  max_redemptions: number | null; redeemed_count: number; reserved_count: number;
  remaining_count: number | null; starts_at: string | null; ends_at: string | null;
  product_ids: string[]; minimum_order_cents: number; active: boolean;
  redemptions: Array<{ orderId: string; discountCents: number; createdAt: string; paymentStatus: string | null }>;
};
type FormValue = {
  code: string; discountType: "percent" | "fixed"; discountValue: string;
  maxRedemptions: string; startsAt: string; endsAt: string;
  productIds: string[]; minimumOrder: string; active: boolean;
};
const empty: FormValue = { code: "", discountType: "percent", discountValue: "10", maxRedemptions: "", startsAt: "", endsAt: "", productIds: [], minimumOrder: "0", active: true };
const localInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Array<{ product_id: string; name: string }>>([]);
  const [form, setForm] = useState<FormValue>(empty);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [promoResponse, inventoryResponse] = await Promise.all([
      fetch("/api/admin/promotions", { cache: "no-store" }),
      fetch("/api/admin/inventory", { cache: "no-store" }),
    ]);
    const promoData = await promoResponse.json(); const inventoryData = await inventoryResponse.json();
    if (!promoResponse.ok) throw new Error(promoData.error || "Promotions indisponibles.");
    setPromotions(promoData.promotions);
    if (inventoryResponse.ok) setProducts(inventoryData.products.map((p: { product_id: string; name: string }) => ({ product_id: p.product_id, name: p.name })));
  };
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/promotions", { cache: "no-store" }),
      fetch("/api/admin/inventory", { cache: "no-store" }),
    ])
      .then(async ([promoResponse, inventoryResponse]) => {
        const promoData = await promoResponse.json();
        const inventoryData = await inventoryResponse.json();
        if (!promoResponse.ok) throw new Error(promoData.error || "Promotions indisponibles.");
        if (!active) return;
        setPromotions(promoData.promotions);
        if (inventoryResponse.ok) setProducts(inventoryData.products.map((p: { product_id: string; name: string }) => ({ product_id: p.product_id, name: p.name })));
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Promotions indisponibles."); });
    return () => { active = false; };
  }, []);
  const set = <K extends keyof FormValue>(key: K, value: FormValue[K]) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (promo: Promotion) => {
    setEditing(true);
    setForm({ code: promo.code, discountType: promo.discount_type, discountValue: String(promo.discount_value),
      maxRedemptions: promo.max_redemptions == null ? "" : String(promo.max_redemptions),
      startsAt: localInput(promo.starts_at), endsAt: localInput(promo.ends_at),
      productIds: promo.product_ids || [], minimumOrder: String((promo.minimum_order_cents / 100).toFixed(2)), active: promo.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const minimum = Number(form.minimumOrder.replace(",", "."));
      if (!Number.isFinite(minimum) || minimum < 0 || !Number.isInteger(minimum * 100)) throw new Error("Minimum de commande invalide.");
      const response = await fetch("/api/admin/promotions", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code, discountType: form.discountType, discountValue: Number(form.discountValue),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          productIds: form.productIds, minimumOrderCents: Math.round(minimum * 100), active: form.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setMessage("Promotion enregistrée."); if (!editing) setForm(empty);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  };
  const toggleActive = async (promo: Promotion) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/promotions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promo.code, discountType: promo.discount_type, discountValue: promo.discount_value,
          maxRedemptions: promo.max_redemptions, startsAt: promo.starts_at, endsAt: promo.ends_at,
          productIds: promo.product_ids || [], minimumOrderCents: promo.minimum_order_cents,
          active: !promo.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setMessage(`Code ${promo.code} ${promo.active ? "désactivé" : "activé"}.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mise à jour impossible."); }
    finally { setBusy(false); }
  };
  return <main className="admin-page">
    <h1>Promotions</h1>
    <p className="admin-muted">Les redemptions conservent leurs montants appliqués aux commandes déjà réglées.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}</p>}
    <section className="admin-card">
      <h2>{editing ? `Modifier ${form.code}` : "Créer une promotion"}</h2>
      <div className="admin-form-grid">
        <label>Code<input disabled={editing} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /></label>
        <label>Type de réduction<select value={form.discountType} onChange={(e) => set("discountType", e.target.value as FormValue["discountType"])}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe (centimes)</option></select></label>
        <label>Valeur {form.discountType === "fixed" ? "(centimes)" : "(%)"}<input type="number" min="1" max={form.discountType === "percent" ? 100 : undefined} value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} /></label>
        <label>Utilisations maximum (vide = illimité)<input type="number" min="1" value={form.maxRedemptions} onChange={(e) => set("maxRedemptions", e.target.value)} /></label>
        <label>Début (facultatif)<input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
        <label>Fin (facultatif)<input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
        <label>Minimum de commande (€)<input type="number" min="0" step="0.01" value={form.minimumOrder} onChange={(e) => set("minimumOrder", e.target.value)} /></label>
        <label><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
      </div>
      <fieldset><legend>Produits concernés (aucune sélection = tous)</legend>{products.map((product) => <label key={product.product_id}><input type="checkbox" checked={form.productIds.includes(product.product_id)} onChange={(e) => set("productIds", e.target.checked ? [...form.productIds, product.product_id] : form.productIds.filter((id) => id !== product.product_id))} /> {product.name}</label>)}</fieldset>
      <div className="admin-actions"><button disabled={busy} onClick={() => void save()}>{busy ? "Enregistrement…" : editing ? "Enregistrer les changements futurs" : "Créer"}</button>{editing && <button type="button" onClick={() => { setEditing(false); setForm(empty); }}>Nouvelle promotion</button>}</div>
    </section>
    <section className="admin-card" style={{ marginTop: 18 }}><h2>Codes et utilisations</h2>
      <div className="admin-table-wrap"><table><thead><tr><th>Code</th><th>Réduction</th><th>Réservé</th><th>Utilisé</th><th>Restant</th><th>Période</th><th>Statut</th><th>Commandes associées</th><th></th></tr></thead><tbody>
      {promotions.map((promo) => <tr key={promo.code}><td>{promo.code}<br /><small>Min. {(promo.minimum_order_cents / 100).toFixed(2)} € · {promo.product_ids?.length ? promo.product_ids.join(", ") : "Tous produits"}</small></td>
        <td>{promo.discount_type === "percent" ? `${promo.discount_value}%` : `${(promo.discount_value / 100).toFixed(2)} €`}</td><td>{promo.reserved_count}</td><td>{promo.redeemed_count}</td><td>{promo.remaining_count ?? "Illimité"}</td>
        <td>{promo.starts_at ? new Date(promo.starts_at).toLocaleDateString("fr-FR") : "—"} – {promo.ends_at ? new Date(promo.ends_at).toLocaleDateString("fr-FR") : "—"}</td><td>{promo.active ? "Active" : "Désactivée"}</td>
        <td>{(promo.redemptions || []).map((r) => <div key={r.orderId}><a href={`/admin/orders?search=${encodeURIComponent(r.orderId)}`}>{r.orderId}</a> · {(r.discountCents / 100).toFixed(2)} €</div>)}</td>
        <td><button type="button" onClick={() => edit(promo)}>Modifier</button><button type="button" disabled={busy} onClick={() => void toggleActive(promo)}>{promo.active ? "Désactiver" : "Activer"}</button></td></tr>)}
      {!promotions.length && <tr><td colSpan={9}>Aucun code promotionnel enregistré.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
