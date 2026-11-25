"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Customer = { email: string; first_name: string; last_name: string; phone: string; paid_orders: number; net_paid_cents: number; last_order_at: string };
type Detail = {
  customer: { firstName: string; lastName: string; email: string; phone: string; street?: string; city?: string; zip?: string; country?: string };
  newsletterConsent: null | { status: string; consentAt: string | null; confirmedAt: string | null; consentVersion: string | null; lastEvent: string | null; lastEventAt: string | null };
  orders: Array<{
    orderId: string; orderDate: string; paymentStatus: string; shipmentStatus: string;
    subtotalCents: number; discountCents: number; shippingCents: number;
    totalCents: number; refundedCents: number;
    shipping?: { label?: string; relayPoint?: { id: string; label: string; address: string[]; postalCode: string; city: string } };
    items: Array<{ name: string; quantity: number; catalogName?: string; catalogImage?: string | null; catalogColor?: string | null }>;
  }>;
};
const money = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async (targetPage = page) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(targetPage), limit: "25", search });
      const response = await fetch(`/api/admin/customers?${query}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Clients indisponibles.");
      setCustomers(data.customers); setTotal(data.total); setPage(targetPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Clients indisponibles."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    fetch("/api/admin/customers?page=1&limit=25&search=", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Clients indisponibles.");
        if (!active) return;
        setCustomers(data.customers); setTotal(data.total); setPage(1);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Clients indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const openCustomer = async (email: string) => {
    setError("");
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(email)}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Dossier client indisponible.");
      setDetail(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dossier client indisponible."); }
  };
  return <main className="admin-page"><h1>Clients</h1>
    <p className="admin-muted">Uniquement les clients ayant au moins une commande réellement payée. Aucun abonnement marketing n’est créé.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <form className="admin-actions" onSubmit={(e) => { e.preventDefault(); void load(1); }}><label style={{ flex: "1 1 260px" }}>Recherche email, nom ou téléphone<input value={search} onChange={(e) => setSearch(e.target.value)} /></label><button disabled={loading}>Rechercher</button></form>
    <section className="admin-card" style={{ marginTop: 16 }}><div className="admin-table-wrap"><table><thead><tr><th>Client</th><th>Commandes payées</th><th>Net encaissé</th><th>Dernière commande</th><th></th></tr></thead><tbody>
      {customers.map((customer) => <tr key={customer.email}><td>{customer.first_name} {customer.last_name}<br /><a href={`mailto:${customer.email}`}>{customer.email}</a><br />{customer.phone}</td><td>{customer.paid_orders}</td><td>{money(customer.net_paid_cents)}</td><td>{new Date(customer.last_order_at).toLocaleDateString("fr-FR")}</td><td><button onClick={() => void openCustomer(customer.email)}>Détails</button></td></tr>)}
      {!customers.length && !loading && <tr><td colSpan={5}>Aucun client correspondant.</td></tr>}
    </tbody></table></div><div className="admin-actions" style={{ marginTop: 12 }}><button disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Précédent</button><span>Page {page} · {total} clients</span><button disabled={page * 25 >= total || loading} onClick={() => void load(page + 1)}>Suivant</button></div></section>
    {detail && <section className="admin-card" style={{ marginTop: 18 }}><div className="admin-actions"><h2 style={{ flex: 1 }}>{detail.customer.firstName} {detail.customer.lastName}</h2><button onClick={() => setDetail(null)}>Fermer</button></div><p>{detail.customer.email} · {detail.customer.phone}</p>
      <p><strong>Adresse client saisie au checkout :</strong> {detail.customer.street || "—"}, {detail.customer.zip || ""} {detail.customer.city || ""} {detail.customer.country || ""}</p>
      <p><strong>Consentement newsletter déjà enregistré :</strong> {detail.newsletterConsent ? `${detail.newsletterConsent.status}${detail.newsletterConsent.lastEvent ? ` · événement : ${detail.newsletterConsent.lastEvent}` : ""}${detail.newsletterConsent.consentAt ? ` · ${new Date(detail.newsletterConsent.consentAt).toLocaleDateString("fr-FR")}` : ""}` : "aucun enregistrement trouvé; aucun abonnement n’a été créé."}</p>
      <div className="admin-table-wrap"><table><thead><tr><th>Commande</th><th>Paiement</th><th>Expédition</th><th>Articles</th><th>Sous-total produits</th><th>Livraison</th><th>Réduction</th><th>Remboursé</th><th>Total net</th></tr></thead><tbody>{detail.orders.map((order) => <tr key={order.orderId}>
        <td><a href={`/admin/orders?search=${encodeURIComponent(order.orderId)}`}>{order.orderId}</a><br />{new Date(order.orderDate).toLocaleString("fr-FR")}</td>
        <td>{order.paymentStatus}</td><td>{order.shipmentStatus}<br />{order.shipping?.label || ""}{order.shipping?.relayPoint && <div><strong>Point de livraison Mondial Relay :</strong><br />{order.shipping.relayPoint.label}, {order.shipping.relayPoint.address.join(", ")}, {order.shipping.relayPoint.postalCode} {order.shipping.relayPoint.city}</div>}</td>
        <td>{order.items?.map((item, index) => <div key={`${item.catalogName || item.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          {item.catalogImage && <Image src={item.catalogImage} alt={item.catalogName || item.name} width={44} height={44} style={{ objectFit: "cover" }} />}
          <span>{item.catalogName || item.name}{item.catalogColor ? ` · ${item.catalogColor}` : ""} × {item.quantity}</span>
        </div>)}</td>
        <td>{money(order.subtotalCents)}</td><td>{money(order.shippingCents)}</td><td>{money(order.discountCents)}</td><td>{money(order.refundedCents)}</td><td>{money(order.totalCents - order.refundedCents)}</td>
      </tr>)}</tbody></table></div>
    </section>}
  </main>;
}
