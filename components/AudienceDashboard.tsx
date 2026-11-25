"use client";

import { useEffect, useState } from "react";

type AudienceMetrics = {
  active: { visitors: number; cart: number; checkout: number };
  today: {
    visitors: number;
    visits: number;
    pageViews: number;
    paidOrders: number;
    conversionRate: number;
    products: Record<"modest-era" | "paradise-way", number>;
  };
  hourly: { hour: number; visitors: number }[];
  history: { day: string; visitors: number; pageViews: number }[];
  refreshedAt: string;
  activeWindowSeconds: number;
  heartbeatSeconds: number;
  refreshSeconds: number;
};

const number = (value: number) => value.toLocaleString("fr-FR");

function TrafficChart({
  values,
  labels,
  label,
}: {
  values: number[];
  labels: string[];
  label: string;
}) {
  const maximum = Math.max(1, ...values);
  return (
    <div>
      <div
        className="admin-audience-chart"
        role="img"
        aria-label={label}
        style={{
          gridTemplateColumns: `repeat(${Math.max(values.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {values.map((value, index) => (
          <span
            className="admin-audience-chart-bar"
            key={`${labels[index]}-${index}`}
            title={`${labels[index]} : ${number(value)}`}
            style={{ height: `${value ? Math.max(3, (value / maximum) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="admin-audience-chart-labels" aria-hidden="true">
        {labels.map((value, index) => (
          <span key={`${value}-${index}`}>{value}</span>
        ))}
      </div>
    </div>
  );
}

export default function AudienceDashboard() {
  const [metrics, setMetrics] = useState<AudienceMetrics | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/audience", {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | AudienceMetrics
          | { error?: string };
        if (!response.ok)
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Chargement impossible.",
          );
        if (active) {
          setMetrics(data as AudienceMetrics);
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Chargement impossible.",
          );
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 10_000);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const history = metrics?.history.slice(-range) || [];
  const hourLabels = metrics?.hourly.map((item) =>
    item.hour % 4 === 0 ? `${item.hour} h` : "",
  ) || [];
  const historyLabels = history.map((item, index) =>
    index === 0 ||
    index === history.length - 1 ||
    index % (range === 7 ? 2 : 7) === 0
      ? new Date(`${item.day}T12:00:00`).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        })
      : "",
  );

  return (
    <main className="admin-page">
      <h1>Audience en direct</h1>
      <p className="admin-muted">
        Estimation fondée sur les sessions ayant accepté les statistiques et
        envoyé un signal au cours des 90 dernières secondes. Les onglets d’un
        même navigateur partagent une session.
      </p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!metrics && !error && <p role="status">Chargement des statistiques…</p>}
      {metrics && (
        <>
          <section className="admin-grid" aria-label="Audience actuelle et du jour">
            {[
              ["Visiteurs actifs estimés", metrics.active.visitors],
              ["Visiteurs aujourd’hui", metrics.today.visitors],
              ["Visites aujourd’hui", metrics.today.visits],
              ["Pages consultées aujourd’hui", metrics.today.pageViews],
              ["Visiteurs actuellement dans le panier", metrics.active.cart],
              ["Visiteurs actuellement au checkout", metrics.active.checkout],
              ["Commandes payées aujourd’hui", metrics.today.paidOrders],
              ["Taux de conversion journalier", `${metrics.today.conversionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`],
            ].map(([label, value]) => (
              <article className="admin-stat" key={label}>
                <span>{label}</span>
                <strong>{typeof value === "number" ? number(value) : value}</strong>
              </article>
            ))}
          </section>

          <section className="admin-card admin-audience-products" aria-labelledby="audience-products-heading">
            <h2 id="audience-products-heading">Pages produits aujourd’hui</h2>
            <div className="admin-grid">
              <article className="admin-stat">
                <span>Modest Era</span>
                <strong>{number(metrics.today.products["modest-era"])}</strong>
              </article>
              <article className="admin-stat">
                <span>Paradise Way</span>
                <strong>{number(metrics.today.products["paradise-way"])}</strong>
              </article>
            </div>
          </section>

          <section className="admin-card admin-audience-section" aria-labelledby="audience-hourly-heading">
            <h2 id="audience-hourly-heading">Fréquentation par heure aujourd’hui</h2>
            <TrafficChart
              values={metrics.hourly.map((item) => item.visitors)}
              labels={hourLabels}
              label="Visiteurs uniques par heure aujourd’hui"
            />
          </section>

          <section className="admin-card admin-audience-section" aria-labelledby="audience-history-heading">
            <div className="admin-audience-heading">
              <h2 id="audience-history-heading">Historique de fréquentation</h2>
              <label>
                Période
                <select
                  value={range}
                  onChange={(event) =>
                    setRange(event.target.value === "30" ? 30 : 7)
                  }
                >
                  <option value={7}>7 jours</option>
                  <option value={30}>30 jours</option>
                </select>
              </label>
            </div>
            <TrafficChart
              values={history.map((item) => item.visitors)}
              labels={historyLabels}
              label={`Visiteurs uniques par jour sur ${range} jours`}
            />
            <p className="admin-muted">
              Barres : visiteurs uniques. Les pages consultées sont disponibles
              dans le tableau ci-dessous.
            </p>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th>Visiteurs</th>
                    <th>Pages consultées</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.day}>
                      <td>
                        {new Date(`${item.day}T12:00:00`).toLocaleDateString(
                          "fr-FR",
                          { weekday: "short", day: "2-digit", month: "long" },
                        )}
                      </td>
                      <td>{number(item.visitors)}</td>
                      <td>{number(item.pageViews)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="admin-muted" role="status">
            Actualisé à{" "}
            {new Date(metrics.refreshedAt).toLocaleTimeString("fr-FR")} -
            actualisation automatique toutes les {metrics.refreshSeconds} secondes.
          </p>
        </>
      )}
    </main>
  );
}
