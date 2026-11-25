"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  type MondialRelaySettings,
  type ParcelProfile,
  type ShippingRate,
} from "@/lib/mondialRelayTypes";

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
  const [secretStatus, setSecretStatus] = useState({ resend: false, gemini: false, groq: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState<MondialRelaySettings>(
    DEFAULT_MONDIAL_RELAY_SETTINGS,
  );
  const [shippingMessage, setShippingMessage] = useState("");
  const [shippingBusy, setShippingBusy] = useState(false);
  const [relayStatus, setRelayStatus] = useState({
    api1Configured: false,
    api2Configured: false,
    api1Enabled: false,
    api2Enabled: false,
    api2EndpointConfigured: false,
    providerConfirmed: false,
    senderConfigured: false,
    collectionModeConfigured: false,
  });
  const [relayReadiness, setRelayReadiness] = useState<
    Record<string, boolean>
  >({});

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
    fetch("/api/admin/shipping-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chargement impossible.");
        if (active) {
          setShipping(data.settings);
          setRelayStatus(data.credentialsConfigured);
          setRelayReadiness(data.readiness || {});
        }
      })
      .catch((error) => {
        if (active)
          setShippingMessage(
            error instanceof Error ? error.message : "Chargement impossible.",
          );
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

  async function saveShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShippingBusy(true);
    setShippingMessage("");
    try {
      const response = await fetch("/api/admin/shipping-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipping),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Enregistrement impossible.");
      setShipping(data.settings);
      setShippingMessage(
        "Paramètres contractuels enregistrés. Les commandes et expéditions restent soumises aux garde-fous de production.",
      );
    } catch (error) {
      setShippingMessage(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setShippingBusy(false);
    }
  }

  function updateParcel(
    key: "testParcel" | "contractParcel",
    fieldName: keyof ParcelProfile,
    value: number | null,
  ) {
    setShipping((current) => ({
      ...current,
      [key]: { ...current[key], [fieldName]: value },
    }));
  }

  function updateRate(
    key: "testRates" | "contractRates",
    index: number,
    patch: Partial<ShippingRate>,
  ) {
    setShipping((current) => ({
      ...current,
      [key]: current[key].map((rate, rateIndex) =>
        rateIndex === index ? { ...rate, ...patch } : rate,
      ),
    }));
  }

  function addRate(key: "testRates" | "contractRates") {
    setShipping((current) => ({
      ...current,
      [key]: [
        ...current[key],
        {
          serviceCode: current.serviceCode,
          maxWeightGrams: 500,
          priceCents: 0,
        },
      ],
    }));
  }

  function removeRate(key: "testRates" | "contractRates", index: number) {
    setShipping((current) => ({
      ...current,
      [key]: current[key].filter((_, rateIndex) => rateIndex !== index),
    }));
  }

  function parcelFields(
    title: string,
    key: "testParcel" | "contractParcel",
    profile: ParcelProfile,
  ) {
    const fields: Array<{
      name: keyof ParcelProfile;
      label: string;
      unit: string;
      min: number;
      max: number;
    }> = [
      { name: "itemsPerParcel", label: "Articles par colis", unit: "", min: 1, max: 30 },
      { name: "weightGrams", label: "Poids emballé", unit: "g", min: 1, max: 30000 },
      { name: "lengthCm", label: "Longueur", unit: "cm", min: 1, max: 200 },
      { name: "widthCm", label: "Largeur", unit: "cm", min: 1, max: 200 },
      { name: "depthCm", label: "Hauteur / profondeur", unit: "cm", min: 1, max: 200 },
    ];
    return (
      <fieldset className="admin-form-grid" style={{ marginTop: 16 }}>
        <legend>{title}</legend>
        {fields.map((item) => (
          <label key={item.name}>
            {item.label}{item.unit ? ` (${item.unit})` : ""}
            <input
              type="number"
              min={item.min}
              max={item.max}
              step="1"
              value={profile[item.name] ?? ""}
              onChange={(event) =>
                updateParcel(
                  key,
                  item.name,
                  event.target.value === ""
                    ? item.name === "itemsPerParcel"
                      ? 1
                      : null
                    : Number(event.target.value),
                )
              }
            />
          </label>
        ))}
      </fieldset>
    );
  }

  function rateFields(
    title: string,
    key: "testRates" | "contractRates",
    rates: ShippingRate[],
    description: string,
  ) {
    return (
      <section style={{ marginTop: 20 }}>
        <h3>{title}</h3>
        <p className="admin-muted">{description}</p>
        <div style={{ display: "grid", gap: 10 }}>
          {rates.map((rate, index) => (
            <div
              key={`${key}-${index}`}
              className="admin-form-grid"
              style={{ alignItems: "end" }}
            >
              <label>
                Service
                <select
                  value={rate.serviceCode}
                  onChange={(event) =>
                    updateRate(key, index, {
                      serviceCode: event.target.value as ShippingRate["serviceCode"],
                    })
                  }
                >
                  <option value="24R/MED">24R/MED - Point Relais</option>
                  <option value="24R/APM">24R/APM - Locker</option>
                </select>
              </label>
              <label>
                Poids maximal du colis (g)
                <input
                  type="number"
                  min="1"
                  max="30000"
                  value={rate.maxWeightGrams}
                  onChange={(event) =>
                    updateRate(key, index, {
                      maxWeightGrams: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Tarif par colis (€)
                <input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={(rate.priceCents / 100).toFixed(2)}
                  onChange={(event) =>
                    updateRate(key, index, {
                      priceCents: Math.round(Number(event.target.value) * 100),
                    })
                  }
                />
              </label>
              <button
                type="button"
                style={{
                  border: "1px solid #d5c8b3",
                  background: "#fff",
                  padding: "10px 12px",
                  color: "#302017",
                  cursor: "pointer",
                }}
                onClick={() => removeRate(key, index)}
              >
                Supprimer ce tarif
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          style={{
            marginTop: 10,
            border: "1px solid #d5c8b3",
            background: "#fff",
            padding: "10px 12px",
            color: "#302017",
            cursor: "pointer",
          }}
          onClick={() => addRate(key)}
        >
          Ajouter un tarif
        </button>
      </section>
    );
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
          <span>Groq (secours) : {secretStatus.groq ? "configuré" : "non configuré"}</span>
        </div>
      </form>
      <section className="admin-card" style={{ marginTop: 18 }}>
        <h2>Garde-fous de campagne</h2>
        <p>La validation explicite reste obligatoire. La boutique doit être ouverte par configuration serveur avant qu’une campagne puisse être approuvée.</p>
        <p>Ouvertures et clics : non suivis. Aucune statistique n’est inventée.</p>
      </section>
      <section className="admin-card" style={{ marginTop: 18 }}>
        <h2>Livraison Mondial Relay</h2>
        <p className="admin-muted">
          Les clés ne sont jamais saisies ni affichées ici. Elles doivent rester
          dans l’environnement sécurisé du serveur. Aucun tarif contractuel
          n’est confirmé.
        </p>
        {shippingMessage && (
          <p
            className={shippingMessage.includes("impossible") ? "admin-error" : "admin-success"}
            role="status"
          >
            {shippingMessage}
          </p>
        )}
        <div role="status" className="admin-muted">
          API1 production : {relayStatus.api1Configured ? "identifiants configurés" : "non configuré"}
          {" - "}
          API2 production : {relayStatus.api2Configured ? "identifiants configurés" : "non configuré"}
          {" - "}
          endpoint API2 : {relayStatus.api2EndpointConfigured ? "configuré" : "à confirmer"}
          {" - "}
          contrat fournisseur : {relayStatus.providerConfirmed ? "confirmé" : "non confirmé"}
        </div>
        <p className="admin-error" role="note">
          Les clés restent dans l’environnement serveur. Aucun test, paiement,
          commande ou envoi réel n’est effectué depuis cette page.
        </p>
        <div role="status" className="admin-muted">
          Recherche API1 : {relayReadiness.searchEnabled ? "prête" : "désactivée"}
          {" - "}
          Création API2 : {relayReadiness.shipmentCreationEnabled ? "prête" : "désactivée"}
          {" - "}
          Paiement et livraison : {relayReadiness.checkoutShippingReady ? "prêts" : "désactivés"}
        </div>
        <form onSubmit={saveShipping}>
          <label style={{ display: "block", maxWidth: 360, marginTop: 16 }}>
            Service contractuel autorisé
            <select
              value={shipping.serviceCode}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  serviceCode: event.target.value as ShippingRate["serviceCode"],
                }))
              }
            >
              <option value="24R/MED">24R/MED - Point Relais</option>
              <option value="24R/APM">24R/APM - Locker</option>
            </select>
          </label>
          {parcelFields(
            "Profil colis contractuel - à renseigner après confirmation",
            "contractParcel",
            shipping.contractParcel,
          )}
          {rateFields(
            "Grille tarifaire contractuelle",
            "contractRates",
            shipping.contractRates,
            "Saisissez uniquement des montants confirmés par le contrat. Ces tarifs ne peuvent pas activer les paiements ou les expéditions réelles.",
          )}
          <div className="admin-actions" style={{ marginTop: 18 }}>
            <button disabled={shippingBusy}>
              {shippingBusy ? "Enregistrement…" : "Enregistrer les paramètres de livraison"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
