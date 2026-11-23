"use client";

import { useEffect, useState } from "react";

type Dashboard = {
  subscribers: {
    total: number;
    confirmed: number;
    pending: number;
    unsubscribed: number;
    suppressed: number;
    today: number;
    this_week: number;
    this_month: number;
  };
  signups: { day: string; count: number }[];
  campaigns: {
    drafts: number;
    scheduled: number;
    sending: number;
    completed: number;
    delivered: number;
    failed: number;
  };
  activity: { action: string; created_at: string }[];
  service: {
    newsletterSendEnabled: boolean;
    emailReady: boolean;
    shopOpen: boolean;
    autoPublish: boolean;
    worker: null | {
      status: string;
      started_at: string;
      finished_at: string | null;
      processed: number;
    };
    lastResendEventAt: string | null;
  };
  metricsAvailability: { opens: boolean; clicks: boolean };
};

const number = (value: number | string | undefined) =>
  Number(value || 0).toLocaleString("fr-FR");

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Chargement impossible.");
        return result as Dashboard;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Chargement impossible.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="admin-page">
      <h1>Tableau de bord</h1>
      <p className="admin-muted">Vue d’ensemble des données réelles de Maison Miroir.</p>
      {loading && <p role="status">Chargement des données…</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {data && (
        <>
          <section aria-label="Abonnées" className="admin-grid">
            {[
              ["Abonnées au total", data.subscribers.total],
              ["Confirmées", data.subscribers.confirmed],
              ["En attente", data.subscribers.pending],
              ["Désinscrites", data.subscribers.unsubscribed],
              ["Nouvelles aujourd’hui", data.subscribers.today],
              ["Cette semaine", data.subscribers.this_week],
              ["Ce mois-ci", data.subscribers.this_month],
              ["Supprimées des envois", data.subscribers.suppressed],
            ].map(([label, value]) => (
              <div className="admin-stat" key={String(label)}>
                <span>{label}</span>
                <strong>{number(value as number)}</strong>
              </div>
            ))}
          </section>

          <section className="admin-card" style={{ marginTop: 18 }}>
            <h2>Inscriptions - 30 derniers jours</h2>
            <SignupChart data={data.signups} />
          </section>

          <section className="admin-grid" style={{ marginTop: 18 }}>
            <div className="admin-card">
              <h2>Campagnes</h2>
              <p>Brouillons : <strong>{number(data.campaigns.drafts)}</strong></p>
              <p>Programmées : <strong>{number(data.campaigns.scheduled)}</strong></p>
              <p>En cours : <strong>{number(data.campaigns.sending)}</strong></p>
              <p>Terminées : <strong>{number(data.campaigns.completed)}</strong></p>
              <p>Livrées selon le fournisseur : <strong>{number(data.campaigns.delivered)}</strong></p>
              <p>En échec : <strong>{number(data.campaigns.failed)}</strong></p>
              <p className="admin-muted">Ouvertures et clics : données indisponibles.</p>
            </div>
            <div className="admin-card">
              <h2>Service newsletter</h2>
              <p>Envois transactionnels : {data.service.newsletterSendEnabled ? "activés" : "désactivés"}</p>
              <p>Configuration d’envoi : {data.service.emailReady ? "complète" : "incomplète"}</p>
              <p>Worker : {data.service.worker ? `${data.service.worker.status} - ${data.service.worker.processed} traités, dernier passage ${new Date(data.service.worker.started_at).toLocaleString("fr-FR")}` : "aucune exécution enregistrée"}</p>
              <p>Dernier événement Resend : {data.service.lastResendEventAt ? new Date(data.service.lastResendEventAt).toLocaleString("fr-FR") : "aucun événement reçu"}</p>
              <p>Boutique : {data.service.shopOpen ? "ouverte" : "fermée"}</p>
              <p>Publication automatique des campagnes : {data.service.autoPublish ? "activée" : "désactivée"}</p>
            </div>
          </section>

          <section className="admin-card" style={{ marginTop: 18 }}>
            <h2>Activité administrative récente</h2>
            {data.activity.length ? (
              <ul>
                {data.activity.map((item, index) => (
                  <li key={`${item.action}-${item.created_at}-${index}`}>
                    {item.action.replaceAll("_", " ")} - {new Date(item.created_at).toLocaleString("fr-FR")}
                  </li>
                ))}
              </ul>
            ) : <p>Aucune activité administrative enregistrée.</p>}
          </section>
        </>
      )}
    </main>
  );
}

function SignupChart({ data }: { data: Dashboard["signups"] }) {
  if (!data.length) return <p>Aucune donnée disponible.</p>;
  const width = 800;
  const height = 190;
  const max = Math.max(1, ...data.map((item) => Number(item.count)));
  const points = data.map((item, index) => {
    const x = 24 + index * ((width - 48) / Math.max(data.length - 1, 1));
    const y = height - 34 - (Number(item.count) / max) * (height - 72);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Graphique des inscriptions sur les trente derniers jours">
      <line x1="24" y1={height - 34} x2={width - 24} y2={height - 34} stroke="#d8c6aa" />
      <polyline points={points} fill="none" stroke="#8c6d14" strokeWidth="3" />
      {data.map((item, index) => {
        const x = 24 + index * ((width - 48) / Math.max(data.length - 1, 1));
        const y = height - 34 - (Number(item.count) / max) * (height - 72);
        return <circle key={item.day} cx={x} cy={y} r="3" fill="#684633"><title>{item.day} : {item.count}</title></circle>;
      })}
      <text x="24" y={height - 8}>{data[0]?.day.slice(5)}</text>
      <text x={width - 55} y={height - 8}>{data[data.length - 1]?.day.slice(5)}</text>
      <text x="24" y="16">Maximum quotidien : {max}</text>
    </svg>
  );
}
