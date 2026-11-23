"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type MarketingEvent = {
  id: string;
  title: string;
  kind: "campaign" | "launch" | "content" | "other";
  starts_at: string;
  ends_at: string | null;
  notes: string;
  campaign_id: string | null;
  campaign_title?: string | null;
};
type ScheduledCampaign = { id: string; title: string; starts_at: string; status: string };
const kinds: Record<MarketingEvent["kind"], string> = {
  campaign: "Campagne",
  launch: "Lancement",
  content: "Contenu",
  other: "Autre",
};
const localInputDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const localDayKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; status: string }[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledCampaign[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/calendar", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Calendrier indisponible.");
      setEvents(data.events);
      setCampaigns(data.campaigns);
      setScheduled(data.scheduledCampaigns);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calendrier indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/calendar", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Calendrier indisponible.");
        return data;
      })
      .then((data) => {
        if (active) {
          setEvents(data.events);
          setCampaigns(data.campaigns);
          setScheduled(data.scheduledCampaigns);
        }
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Calendrier indisponible.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const eventMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string; starts_at: string; kind: string; source: "event" | "campaign" }[]>();
    for (const event of events) {
      const key = localDayKey(event.starts_at);
      map.set(key, [...(map.get(key) || []), { ...event, kind: kinds[event.kind], source: "event" }]);
    }
    for (const campaign of scheduled) {
      const key = localDayKey(campaign.starts_at);
      map.set(key, [...(map.get(key) || []), { ...campaign, kind: "Envoi programmé", source: "campaign" }]);
    }
    return map;
  }, [events, scheduled]);

  const firstDayOffset = (month.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstDayOffset).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setLoading(true);
    setMessage("");
    const form = new FormData(formElement);
    const starts = String(form.get("startsAt"));
    const ends = String(form.get("endsAt") || "");
    const payload = {
      action: editing ? "update" : "create",
      ...(editing ? { id: editing } : {}),
      title: form.get("title"),
      kind: form.get("kind"),
      startsAt: new Date(starts).toISOString(),
      endsAt: ends ? new Date(ends).toISOString() : undefined,
      notes: form.get("notes"),
      campaignId: form.get("campaignId") || undefined,
    };
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      formElement.reset();
      setEditing("");
      setMessage("Événement enregistré. Aucun envoi n’a été déclenché.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  function edit(item: MarketingEvent) {
    const form = document.querySelector<HTMLFormElement>("#marketing-event-form");
    if (!form) return;
    (form.elements.namedItem("title") as HTMLInputElement).value = item.title;
    (form.elements.namedItem("kind") as HTMLSelectElement).value = item.kind;
    (form.elements.namedItem("startsAt") as HTMLInputElement).value = localInputDate(item.starts_at);
    (form.elements.namedItem("endsAt") as HTMLInputElement).value = item.ends_at ? localInputDate(item.ends_at) : "";
    (form.elements.namedItem("notes") as HTMLTextAreaElement).value = item.notes;
    (form.elements.namedItem("campaignId") as HTMLSelectElement).value = item.campaign_id || "";
    setEditing(item.id);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cet événement du calendrier ?")) return;
    setBusy(true);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      await load();
      setMessage("Événement supprimé.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-page">
      <h1>Calendrier marketing</h1>
      <p className="admin-muted">Les événements sont enregistrés dans PostgreSQL. Une programmation de campagne affichée ici n’active pas à elle seule les envois.</p>
      {message && <p className={message.includes("impossible") || message.includes("indisponible") ? "admin-error" : "admin-success"} role="status">{message}</p>}
      <section className="admin-card">
        <div className="admin-actions" style={{ justifyContent: "space-between" }}>
          <button type="button" aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
          <h2>{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h2>
          <button type="button" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        </div>
        <div className="admin-calendar-grid" role="grid" aria-label="Calendrier mensuel">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <strong key={day} role="columnheader">{day}</strong>)}
          {cells.map((day, index) => {
            if (!day) return <div key={`blank-${index}`} aria-hidden="true" />;
            const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            return <div className="admin-calendar-day" key={key} role="gridcell">
              <strong>{day}</strong>
              {(eventMap.get(key) || []).map((item) => <div className="admin-calendar-item" key={`${item.source}-${item.id}`}>{item.kind}: {item.title}</div>)}
            </div>;
          })}
        </div>
        {loading && <p role="status">Chargement…</p>}
      </section>
      <section className="admin-card" style={{ marginTop: 18 }}>
        <h2>{editing ? "Modifier un événement" : "Ajouter un événement"}</h2>
        <form id="marketing-event-form" className="admin-form-grid" onSubmit={submit}>
          <label>Titre<input name="title" required maxLength={160} /></label>
          <label>Type<select name="kind"><option value="campaign">Campagne</option><option value="launch">Lancement</option><option value="content">Contenu</option><option value="other">Autre</option></select></label>
          <label>Début<input name="startsAt" type="datetime-local" required /></label>
          <label>Fin (facultative)<input name="endsAt" type="datetime-local" /></label>
          <label>Campagne liée (facultatif)<select name="campaignId"><option value="">Aucune</option>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.title} - {item.status}</option>)}</select></label>
          <label>Notes<textarea name="notes" maxLength={2000} rows={3} /></label>
          <div className="admin-actions">
            <button disabled={busy}>{editing ? "Enregistrer les modifications" : "Ajouter au calendrier"}</button>
            {editing && <button type="button" disabled={busy} onClick={() => { setEditing(""); document.querySelector<HTMLFormElement>("#marketing-event-form")?.reset(); }}>Annuler</button>}
          </div>
        </form>
      </section>
      <section className="admin-card" style={{ marginTop: 18 }}>
        <h2>Événements à venir</h2>
        <div className="admin-event-list">
          {events.filter((item) => new Date(item.starts_at) >= new Date()).map((item) => (
            <article className="admin-event" key={item.id}>
              <strong>{item.title}</strong> · {kinds[item.kind]} · {new Date(item.starts_at).toLocaleString("fr-FR")}
              {item.campaign_title && <p>Campagne : {item.campaign_title}</p>}
              {item.notes && <p>{item.notes}</p>}
              <div className="admin-actions"><button type="button" disabled={busy} onClick={() => edit(item)}>Modifier</button><button type="button" disabled={busy} onClick={() => void remove(item.id)}>Supprimer</button></div>
            </article>
          ))}
          {!events.length && !scheduled.length && <p>Aucun événement enregistré.</p>}
        </div>
      </section>
    </main>
  );
}
