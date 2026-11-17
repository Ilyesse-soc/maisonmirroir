"use client";

import { FormEvent, useEffect, useState } from "react";

type Settings = {
  brand_name: string;
  contact_email: string;
  instagram_url: string;
  tiktok_url: string;
  welcome_copy: string;
  confirmation_copy: string;
  launch_copy: string;
  campaign_footer: string;
};

const empty: Settings = {
  brand_name: "",
  contact_email: "",
  instagram_url: "",
  tiktok_url: "",
  welcome_copy: "",
  confirmation_copy: "",
  launch_copy: "",
  campaign_footer: "",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(empty);
  const [secretStatus, setSecretStatus] = useState({ resend: false, gemini: false, grok: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chargement impossible.");
        if (active) {
          setSettings(data.settings);
          setSecretStatus(data.secretsConfigured);
        }
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Chargement impossible.");
      });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setSettings(data.settings);
      setMessage("Paramètres enregistrés. Aucun secret n’a été affiché ou modifié.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  function field(key: keyof Settings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="admin-page">
      <h1>Paramètres de la marque</h1>
      <p className="admin-muted">Informations éditables et textes réutilisés par les communications. Les secrets restent côté serveur.</p>
      {message && <p className={message.includes("impossible") ? "admin-error" : "admin-success"} role="status">{message}</p>}
      <form className="admin-card" onSubmit={save}>
        <div className="admin-form-grid">
          <label>Nom de la marque<input value={settings.brand_name} onChange={(event) => field("brand_name", event.target.value)} maxLength={120} required /></label>
          <label>Email de contact<input type="email" value={settings.contact_email} onChange={(event) => field("contact_email", event.target.value)} maxLength={254} required /></label>
          <label>Instagram (URL HTTPS)<input type="url" value={settings.instagram_url} onChange={(event) => field("instagram_url", event.target.value)} /></label>
          <label>TikTok (URL HTTPS)<input type="url" value={settings.tiktok_url} onChange={(event) => field("tiktok_url", event.target.value)} /></label>
          <label>Texte de confirmation<textarea rows={4} value={settings.confirmation_copy} onChange={(event) => field("confirmation_copy", event.target.value)} maxLength={2000} required /></label>
          <label>Texte de bienvenue<textarea rows={6} value={settings.welcome_copy} onChange={(event) => field("welcome_copy", event.target.value)} maxLength={4000} required /></label>
          <label>Texte d’annonce de lancement<textarea rows={5} value={settings.launch_copy} onChange={(event) => field("launch_copy", event.target.value)} maxLength={4000} required /></label>
          <label>Signature des campagnes (facultative)<textarea rows={3} value={settings.campaign_footer} onChange={(event) => field("campaign_footer", event.target.value)} maxLength={1000} /></label>
        </div>
        <div className="admin-actions" style={{ marginTop: 18 }}>
          <button disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          <span>Resend : {secretStatus.resend ? "configuré" : "non configuré"}</span>
          <span>Gemini : {secretStatus.gemini ? "configuré" : "non configuré"}</span>
          <span>Grok (secours) : {secretStatus.grok ? "configuré" : "non configuré"}</span>
        </div>
      </form>
      <section className="admin-card" style={{ marginTop: 18 }}>
        <h2>Garde-fous de campagne</h2>
        <p>La validation explicite reste obligatoire. La boutique doit être ouverte par configuration serveur avant qu’une campagne puisse être approuvée.</p>
        <p>Ouvertures et clics : non suivis. Aucune statistique n’est inventée.</p>
      </section>
    </main>
  );
}
