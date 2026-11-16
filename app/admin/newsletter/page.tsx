"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import "../../newsletter/newsletter.css";
import AbandonedCartsAdmin from "@/components/AbandonedCartsAdmin";
type Campaign = {
  id: string;
  title: string;
  subject: string;
  status: string;
  recipients: string;
  accepted: string;
  delivered: string;
  failed: string;
  body: string;
  image_url: string;
  link_url: string;
  promo_code: string;
  ends_at: string;
  products: { id: string }[];
};
export default function NewsletterAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [products, setProducts] = useState<{ id: string; name: string }[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [schedule, setSchedule] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [launchTemplate, setLaunchTemplate] = useState<{
    title: string;
    subject: string;
    body: string;
    linkUrl: string;
  } | null>(null);
  function edit(c: Campaign) {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries({
      title: c.title,
      subject: c.subject,
      body: c.body,
      imageUrl: c.image_url || "",
      linkUrl: c.link_url || "",
      promoCode: c.promo_code || "",
      endsAt: c.ends_at ? c.ends_at.slice(0, 10) : "",
    })) {
      const field = form.elements.namedItem(name) as HTMLInputElement | null;
      if (field) field.value = value;
    }
    const selected = form.elements.namedItem("productIds") as HTMLSelectElement;
    for (const option of Array.from(selected.options))
      option.selected = c.products.some((p) => p.id === option.value);
    setEditing(c.id);
    form.scrollIntoView({ behavior: "auto" });
  }
  async function load() {
    try {
      const r = await fetch("/api/admin/newsletter", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setCampaigns(d.campaigns);
      setProducts(d.products);
      setShopOpen(d.shopOpen === true);
      setLaunchTemplate(d.launchTemplate);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Chargement impossible");
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/admin/newsletter", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then((d) => {
        if (active) {
          setCampaigns(d.campaigns);
          setProducts(d.products);
          setShopOpen(d.shopOpen === true);
          setLaunchTemplate(d.launchTemplate);
        }
      })
      .catch((e) => {
        if (active)
          setMessage(e instanceof Error ? e.message : "Chargement impossible");
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(data: object, path = "/api/admin/newsletter") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.html) setPreview(d.html);
      else {
        setMessage(
          "Opération enregistrée. Les e-mails sont traités par la file d’envoi.",
        );
        await load();
      }
      return r.ok;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opération impossible");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await action({
        ...Object.fromEntries(data),
        productIds: data.getAll("productIds"),
        action: editing ? "update" : "create",
        id: editing,
      })
    ) {
      form.reset();
      setEditing("");
    }
  }
  return (
    <main className="newsletter-page" style={{ paddingTop: 35 }}>
      <a href="/77774555474447777554555/commandes">← Commandes</a>
      <h1>La correspondance Maison Miroir</h1>
      <p>
        Préparez votre campagne, prévisualisez-la, puis validez son envoi. Les
        destinataires sont les abonnées confirmées au moment de la validation.
        Aucun suivi d’ouverture ou de clic n’est affiché.
      </p>
      <p role="status">{message}</p>
      {!shopOpen && (
        <p>
          La boutique est fermée : seules les confirmations d’inscription et les
          bienvenues sont envoyées. Les campagnes restent bloquées.
        </p>
      )}
      <button
        type="button"
        disabled={busy || !launchTemplate}
        onClick={() => {
          if (!launchTemplate || !formRef.current) return;
          formRef.current.reset();
          setEditing("");
          for (const [name, value] of Object.entries(launchTemplate)) {
            const field = formRef.current.elements.namedItem(
              name,
            ) as HTMLInputElement | null;
            if (field) field.value = value;
          }
          setMessage(
            "Modèle de lancement préparé. Aucun envoi ni programmation effectué.",
          );
        }}
      >
        Préparer l’annonce du lancement
      </button>
      <form ref={formRef} onSubmit={save}>
        <h2>{editing ? "Modifier le brouillon" : "Nouvelle campagne"}</h2>
        <label>
          Titre interne
          <input name="title" required maxLength={200} />
        </label>
        <label>
          Objet de l’e-mail
          <input name="subject" required maxLength={200} />
        </label>
        <label>
          Texte principal
          <textarea name="body" required maxLength={12000} rows={5} />
        </label>
        <label>
          Image (URL HTTPS)
          <input name="imageUrl" type="url" />
        </label>
        <label>
          Produits (sélection multiple)
          <select name="productIds" multiple>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Code promotionnel
          <input name="promoCode" maxLength={80} />
        </label>
        <label>
          Fin de l’offre
          <input name="endsAt" type="date" />
        </label>
        <label>
          Lien vers le site (HTTPS)
          <input name="linkUrl" type="url" />
        </label>
        <button disabled={busy}>Enregistrer le brouillon</button>
        {editing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              formRef.current?.reset();
              setEditing("");
            }}
          >
            Annuler la modification
          </button>
        ) : null}
      </form>
      <AbandonedCartsAdmin />
      <h2>Campagnes et historique</h2>
      <label>
        Programmation facultative (heure de votre appareil)
        <input
          type="datetime-local"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
        />
      </label>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Campagne</th>
              <th>Statut</th>
              <th>Destinataires</th>
              <th>Acceptés / livrés / erreurs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.title}
                  <br />
                  {c.subject}
                </td>
                <td>{c.status}</td>
                <td>{c.recipients}</td>
                <td>
                  {c.accepted} / {c.delivered} / {c.failed}
                </td>
                <td>
                  <div className="admin-actions">
                    {c.status === "draft" ? (
                      <button disabled={busy} onClick={() => edit(c)}>
                        Modifier
                      </button>
                    ) : null}
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action({ action: "preview", id: c.id })
                      }
                    >
                      Prévisualiser
                    </button>
                    {c.status === "draft" ? (
                      <button
                        disabled={busy || !shopOpen}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Valider cette campagne pour les abonnées confirmées ?",
                            )
                          )
                            void action({
                              action: "approve",
                              id: c.id,
                              scheduledAt: schedule
                                ? new Date(schedule).toISOString()
                                : undefined,
                            });
                        }}
                      >
                        {schedule ? "Programmer" : "Valider l’envoi"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        La planification nécessite un worker externe appelant la file
        régulièrement. Un lot traite au maximum dix messages.
      </p>
      <button
        disabled={busy}
        onClick={() => void action({}, "/api/admin/newsletter/process")}
      >
        Traiter un lot maintenant
      </button>
      {preview ? (
        <>
          <h2>Aperçu de l’e-mail</h2>
          <iframe title="Aperçu de la campagne" sandbox="" srcDoc={preview} />
        </>
      ) : null}
    </main>
  );
}
