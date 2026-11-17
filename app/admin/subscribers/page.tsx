"use client";

import { FormEvent, useEffect, useState } from "react";

type Subscriber = {
  id: string;
  email: string;
  status: "active" | "pending" | "unsubscribed" | "suppressed";
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  consent_at: string;
  consent_version: string;
  last_confirmation_at: string | null;
  last_delivery_error: string | null;
};

const statusNames: Record<Subscriber["status"], string> = {
  active: "Confirmée",
  pending: "En attente",
  unsubscribed: "Désinscrite",
  suppressed: "Exclue des envois",
};

export default function SubscribersPage() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [direction, setDirection] = useState("desc");
  const [history, setHistory] = useState<{ event: string; consent_version: string; created_at: string }[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25", status, sort, direction });
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/admin/subscribers?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Chargement impossible.");
        return result;
      })
      .then((result) => {
        if (active) {
          setRows(result.subscribers);
          setTotal(Number(result.total));
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Chargement impossible.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, status, appliedSearch, sort, direction, reloadToken]);

  async function showHistory(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/admin/subscribers?history=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Historique indisponible.");
      setHistory(result.history);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Historique indisponible.");
    }
  }

  async function erase(row: Subscriber) {
    if (!window.confirm(`Supprimer définitivement ${row.email} et ses données d’inscription ?`)) return;
    setBusy(row.id);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "erase", id: row.id, confirmation: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Suppression impossible.");
      setHistory(null);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suppression impossible.");
    } finally {
      setBusy("");
    }
  }

  function searchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setLoading(true);
    setAppliedSearch(search.trim());
  }

  return (
    <main className="admin-page">
      <h1>Abonnées</h1>
      <p className="admin-muted">Recherche, consentement et état des envois. Une désinscription n’est jamais annulée automatiquement.</p>
      <form className="admin-actions" onSubmit={searchSubmit} style={{ margin: "20px 0" }}>
        <label style={{ minWidth: 240, flex: 1 }}>Rechercher une adresse e-mail
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" maxLength={254} />
        </label>
        <label style={{ width: 190 }}>Statut
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true); }}>
            <option value="all">Tous les statuts</option>
            <option value="active">Confirmées</option>
            <option value="pending">En attente</option>
            <option value="unsubscribed">Désinscrites</option>
            <option value="suppressed">Exclues des envois</option>
          </select>
        </label>
        <label style={{ width: 190 }}>Trier par
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); setLoading(true); }}>
            <option value="created_at">Date d’inscription</option>
            <option value="email">Adresse e-mail</option>
            <option value="status">Statut</option>
            <option value="confirmed_at">Date de confirmation</option>
          </select>
        </label>
        <label style={{ width: 150 }}>Ordre
          <select value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); setLoading(true); }}>
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </label>
        <button type="submit">Rechercher</button>
        <button type="button" onClick={() => { setLoading(true); setReloadToken((token) => token + 1); }}>Actualiser</button>
        <a className="admin-button" href={`/api/admin/subscribers/export?status=${encodeURIComponent(status)}&search=${encodeURIComponent(appliedSearch)}`}>Exporter CSV</a>
      </form>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p role="status">Chargement des abonnées…</p> : (
        <div className="admin-table-wrap">
          <table>
            <thead><tr><th>Adresse e-mail</th><th>Statut</th><th>Inscription</th><th>Confirmation</th><th>Erreur de livraison</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.email}<br /><small>Consentement : {new Date(row.consent_at).toLocaleDateString("fr-FR")} ({row.consent_version})</small></td>
                  <td><span className="admin-status">{statusNames[row.status]}</span></td>
                  <td>{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>{row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString("fr-FR") : row.last_confirmation_at ? "En attente d’action" : "—"}</td>
                  <td>{row.last_delivery_error || "—"}</td>
                  <td><div className="admin-actions">
                    <button type="button" onClick={() => void showHistory(row.id)}>Historique</button>
                    <button type="button" disabled={busy === row.id} onClick={() => void erase(row)}>Effacer</button>
                  </div></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6}>Aucune abonnée trouvée.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="admin-actions" style={{ justifyContent: "space-between", marginTop: 16 }}>
        <span>{total.toLocaleString("fr-FR")} résultat(s) — page {page} / {Math.max(1, Math.ceil(total / 25))}</span>
        <div className="admin-actions">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédente</button>
          <button type="button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((value) => value + 1)}>Suivante</button>
        </div>
      </div>
      {history && <section className="admin-card" style={{ marginTop: 20 }}>
        <div className="admin-actions" style={{ justifyContent: "space-between" }}>
          <h2>Historique du consentement</h2>
          <button type="button" onClick={() => setHistory(null)}>Fermer</button>
        </div>
        {history.length ? <ul>{history.map((item, index) => <li key={`${item.event}-${item.created_at}-${index}`}>{item.event} — {new Date(item.created_at).toLocaleString("fr-FR")} ({item.consent_version})</li>)}</ul> : <p>Aucun événement enregistré.</p>}
      </section>}
    </main>
  );
}
