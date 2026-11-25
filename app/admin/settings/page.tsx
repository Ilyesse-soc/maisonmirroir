"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  type MondialRelaySettings,
  type MondialRelaySender,
  type ParcelProfile,
  type ProposedShippingRate,
  type ShippingRate,
  type ShippingTier,
} from "@/lib/mondialRelayTypes";

type Settings = {
  brand_name: string;
  contact_email: string;
  professional_phone: string;
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
  professional_phone: "",
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
  contractConfirmed: false,
  serviceAllowed: false,
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
      ...(key === "contractParcel" ? { contractConfirmed: false } : {}),
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
        rateIndex === index
          ? {
              ...rate,
              ...patch,
              ...(Object.keys(patch).length === 1 && "confirmed" in patch
                ? {}
                : { confirmed: false }),
            }
          : rate,
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
          priceBasis: "unknown",
          customerPriceCents: null,
          confirmed: false,
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

  function updateSender(fieldName: keyof MondialRelaySender, value: string) {
    setShipping((current) => ({
      ...current,
      sender: { ...current.sender, [fieldName]: value },
    }));
  }

  function updateProposedRate(
    patch: Partial<ProposedShippingRate>,
  ) {
    setShipping((current) => ({
      ...current,
      proposedRate: { ...current.proposedRate, ...patch },
    }));
  }

  function updateShippingTier(index: number, patch: Partial<ShippingTier>) {
    setShipping((current) => ({
      ...current,
      shippingTiers: current.shippingTiers.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              ...patch,
              ...(Object.keys(patch).length === 1 && "confirmed" in patch
                ? {}
                : { confirmed: false }),
            }
          : tier,
      ),
    }));
  }

  function updateHomeShippingTier(
    index: number,
    patch: Partial<ShippingTier>,
  ) {
    setShipping((current) => ({
      ...current,
      homeShippingTiers: current.homeShippingTiers.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              ...patch,
              ...(Object.keys(patch).length === 1 && "confirmed" in patch
                ? {}
                : { confirmed: false }),
            }
          : tier,
      ),
    }));
  }

  function addHomeShippingTier() {
    setShipping((current) => {
      const quantities = new Set(
        current.homeShippingTiers.map((tier) => tier.quantity),
      );
      let quantity = 1;
      while (quantities.has(quantity) && quantity <= 30) quantity += 1;
      if (quantity > 30) return current;
      return {
        ...current,
        homeShippingTiers: [
          ...current.homeShippingTiers,
          {
            quantity,
            weightGrams: null,
            lengthCm: null,
            widthCm: null,
            depthCm: null,
            customerPriceCents: null,
            confirmed: false,
          },
        ].sort((left, right) => left.quantity - right.quantity),
      };
    });
  }

  function removeHomeShippingTier(index: number) {
    setShipping((current) => ({
      ...current,
      homeShippingTiers: current.homeShippingTiers.filter(
        (_, tierIndex) => tierIndex !== index,
      ),
    }));
  }

  function addShippingTier() {
    setShipping((current) => {
      const quantities = new Set(current.shippingTiers.map((tier) => tier.quantity));
      let quantity = 1;
      while (quantities.has(quantity) && quantity <= 30) quantity += 1;
      if (quantity > 30) return current;
      return {
        ...current,
        shippingTiers: [
          ...current.shippingTiers,
          {
            quantity,
            weightGrams: null,
            lengthCm: null,
            widthCm: null,
            depthCm: null,
            customerPriceCents: null,
            confirmed: false,
          },
        ].sort((left, right) => left.quantity - right.quantity),
      };
    });
  }

  function removeShippingTier(index: number) {
    setShipping((current) => ({
      ...current,
      shippingTiers: current.shippingTiers.filter(
        (_, tierIndex) => tierIndex !== index,
      ),
    }));
  }

  function shippingTierFields() {
    return (
      <section style={{ marginTop: 20 }}>
        <h3>Profils colis et tarifs par quantité</h3>
        <p className="admin-muted">
          Les prix affichés sont les frais TTC facturés à l’acheteuse. Chaque
          quantité doit avoir un poids, des dimensions réelles et un tarif
          confirmé. Sans palier complet, le checkout et la recherche de Point
          Relais restent bloqués pour cette quantité.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {shipping.shippingTiers.map((tier, index) => {
            const complete =
              Boolean(tier.weightGrams) &&
              Boolean(tier.lengthCm) &&
              Boolean(tier.widthCm) &&
              Boolean(tier.depthCm) &&
              Boolean(tier.customerPriceCents);
            return (
              <fieldset
                key={`quantity-tier-${index}`}
                className="admin-form-grid"
                style={{ alignItems: "end" }}
              >
                <legend>{tier.quantity} sac{tier.quantity === 1 ? "" : "s"}</legend>
                <label>
                  Quantité exacte
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={tier.quantity}
                    onChange={(event) =>
                      updateShippingTier(index, {
                        quantity: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Poids colis (g)
                  <input
                    type="number"
                    min="1"
                    max="30000"
                    step="1"
                    value={tier.weightGrams ?? ""}
                    onChange={(event) =>
                      updateShippingTier(index, {
                        weightGrams:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
                {([
                  ["lengthCm", "Longueur (cm)"],
                  ["widthCm", "Largeur (cm)"],
                  ["depthCm", "Hauteur (cm)"],
                ] as const).map(([fieldName, label]) => (
                  <label key={fieldName}>
                    {label}
                    <input
                      type="number"
                      min="1"
                      max="200"
                      step="1"
                      value={tier[fieldName] ?? ""}
                      onChange={(event) =>
                        updateShippingTier(index, {
                          [fieldName]:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Livraison facturée TTC (€)
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="0.01"
                    value={
                      tier.customerPriceCents === null
                        ? ""
                        : (tier.customerPriceCents / 100).toFixed(2)
                    }
                    onChange={(event) =>
                      updateShippingTier(index, {
                        customerPriceCents:
                          event.target.value === ""
                            ? null
                            : Math.round(Number(event.target.value) * 100),
                      })
                    }
                  />
                </label>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={tier.confirmed}
                      disabled={!complete}
                      onChange={(event) =>
                        updateShippingTier(index, {
                          confirmed: event.target.checked,
                        })
                      }
                    />{" "}
                    Colis et tarif confirmés
                  </span>
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
                  onClick={() => removeShippingTier(index)}
                >
                  Supprimer ce palier
                </button>
              </fieldset>
            );
          })}
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
          disabled={shipping.shippingTiers.length >= 30}
          onClick={addShippingTier}
        >
          Ajouter un palier
        </button>
      </section>
    );
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
                Tarif transporteur / colis (€)
                <input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={((rate.priceCents || 0) / 100).toFixed(2)}
                  onChange={(event) =>
                    updateRate(key, index, {
                      priceCents: Math.round(Number(event.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                Base du tarif transporteur
                <select
                  value={rate.priceBasis}
                  onChange={(event) =>
                    updateRate(key, index, {
                      priceBasis: event.target.value as ShippingRate["priceBasis"],
                    })
                  }
                >
                  <option value="unknown">À confirmer</option>
                  <option value="HT">HT</option>
                  <option value="TTC">TTC</option>
                </select>
              </label>
              <label>
                Prix facturé au client (€)
                <input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={
                    rate.customerPriceCents === null
                      ? ""
                      : (rate.customerPriceCents / 100).toFixed(2)
                  }
                  onChange={(event) =>
                    updateRate(key, index, {
                      customerPriceCents:
                        event.target.value === ""
                          ? null
                          : Math.round(Number(event.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={rate.confirmed}
                    onChange={(event) =>
                      updateRate(key, index, {
                        confirmed: event.target.checked,
                      })
                    }
                  />{" "}
                  Tarif et prix client confirmés
                </span>
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
          <label>Téléphone professionnel (facultatif, publié dans les mentions légales)<input type="tel" value={settings.professional_phone} onChange={(event) => field("professional_phone", event.target.value)} maxLength={30} /></label>
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
          Les clés et identifiants API restent uniquement dans l’environnement
          serveur et ne sont jamais affichés ici. Les coordonnées d’expédition
          non secrètes et les paramètres de contrat sont conservés dans la
          configuration sécurisée de la boutique. Toute autorisation reste à
          confirmer explicitement.
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
          <section style={{ marginTop: 18 }}>
            <h3>Expéditeur et dépôt du colis</h3>
            <p className="admin-muted">
              REL correspond au dépôt du colis en Point Relais ou Locker. Aucun
              enlèvement ni aucune collecte à domicile ne sera planifié. API2
              demande un téléphone et un email de contact pour les notifications.
            </p>
            <div className="admin-form-grid">
              <label>Entreprise<input value={shipping.sender.company} maxLength={120} onChange={(event) => updateSender("company", event.target.value)} /></label>
              <label>Prénom<input value={shipping.sender.firstName} maxLength={80} onChange={(event) => updateSender("firstName", event.target.value)} /></label>
              <label>Nom<input value={shipping.sender.lastName} maxLength={80} onChange={(event) => updateSender("lastName", event.target.value)} /></label>
              <label>Adresse / rue<input value={shipping.sender.street} maxLength={120} onChange={(event) => updateSender("street", event.target.value)} /></label>
              <label>Numéro<input value={shipping.sender.houseNo} maxLength={20} onChange={(event) => updateSender("houseNo", event.target.value)} /></label>
              <label>Code postal<input value={shipping.sender.postalCode} maxLength={12} onChange={(event) => updateSender("postalCode", event.target.value)} /></label>
              <label>Ville<input value={shipping.sender.city} maxLength={80} onChange={(event) => updateSender("city", event.target.value)} /></label>
              <label>Pays (code ISO à deux lettres, FR requis actuellement)<input value={shipping.sender.countryCode} maxLength={2} onChange={(event) => updateSender("countryCode", event.target.value.toUpperCase())} /></label>
              <label>Téléphone de contact requis par API2<input type="tel" value={shipping.sender.phone} maxLength={30} onChange={(event) => updateSender("phone", event.target.value)} /></label>
              <label>Email de contact<input type="email" value={shipping.sender.email} maxLength={254} onChange={(event) => updateSender("email", event.target.value)} /></label>
              <label>
                Mode de dépôt API2
                <input value="REL - dépôt en Point Relais ou Locker" readOnly />
              </label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              <input
                type="checkbox"
                checked={shipping.collectionModeConfirmed}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    collectionModeConfirmed: event.target.checked,
                  }))
                }
              />{" "}
              Je confirme que ce mode de dépôt ou de collecte est autorisé par
              mon contrat.
            </label>
          </section>
          <section style={{ marginTop: 20 }}>
            <h3>Contrat et services autorisés</h3>
            <p className="admin-muted">
              La boutique est configurée en Point Relais uniquement. La recherche
              utilise l’action API1 MED et les expéditions API2 le mode 24R.
            </p>
            <div className="admin-form-grid">
              <label>
                Service utilisé pour la recherche et les expéditions
                <input value="24R/MED - Point Relais" readOnly />
              </label>
              <div>
                <label style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={shipping.allowedServices.includes("24R/MED")}
                    onChange={(event) =>
                      setShipping((current) => ({
                        ...current,
                        allowedServices: event.target.checked
                          ? ["24R/MED"]
                          : [],
                        serviceConfirmed: false,
                      }))
                    }
                  />{" "}
                  24R/MED autorisé par mon contrat
                </label>
              </div>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              <input
                type="checkbox"
                checked={shipping.contractConfirmed}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    contractConfirmed: event.target.checked,
                  }))
                }
              />{" "}
              Je confirme que le contrat de production Mondial Relay est actif
              et que ces paramètres ont été vérifiés auprès du fournisseur.
            </label>
            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={shipping.serviceConfirmed}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    serviceConfirmed: event.target.checked,
                  }))
                }
              />{" "}
              Je confirme la sélection ci-dessus des seuls services autorisés
              par ce contrat.
            </label>
          </section>
          {shippingTierFields()}
          <section style={{ marginTop: 22 }}>
            <h3>Livraison à domicile Mondial Relay</h3>
            <p className="admin-muted">
              API2 utilise le mode HOM et le dépôt REL. Le contrat de production
              doit autoriser HOM. Le mode reste indisponible tant que cette
              autorisation n’est pas confirmée et qu’un palier colis complet
              n’est pas enregistré.
            </p>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={shipping.homeDeliveryContractConfirmed}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    homeDeliveryContractConfirmed: event.target.checked,
                    homeDeliveryEnabled: event.target.checked
                      ? current.homeDeliveryEnabled
                      : false,
                  }))
                }
              />{" "}
              Je confirme que le service API2 HOM est autorisé par mon contrat
              de production.
            </label>
            <label style={{ display: "block", marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={shipping.homeDeliveryEnabled}
                disabled={!shipping.homeDeliveryContractConfirmed}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    homeDeliveryEnabled: event.target.checked,
                  }))
                }
              />{" "}
              Activer la livraison à domicile au checkout
            </label>
            <div className="admin-form-grid" style={{ marginBottom: 14 }}>
              <label>
                Délai de préparation (jours ouvrés)
                <input
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  value={shipping.preparationDays}
                  onChange={(event) =>
                    setShipping((current) => ({
                      ...current,
                      preparationDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {shipping.homeShippingTiers.map((tier, index) => {
                const complete =
                  Boolean(tier.weightGrams) &&
                  Boolean(tier.lengthCm) &&
                  Boolean(tier.widthCm) &&
                  Boolean(tier.depthCm) &&
                  Boolean(tier.customerPriceCents);
                return (
                  <fieldset
                    key={`home-quantity-tier-${index}`}
                    className="admin-form-grid"
                    style={{ alignItems: "end" }}
                  >
                    <legend>
                      Domicile - {tier.quantity} sac
                      {tier.quantity === 1 ? "" : "s"}
                    </legend>
                    <label>
                      Quantité exacte
                      <input
                        type="number"
                        min="1"
                        max="30"
                        step="1"
                        value={tier.quantity}
                        onChange={(event) =>
                          updateHomeShippingTier(index, {
                            quantity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Poids colis (g)
                      <input
                        type="number"
                        min="1"
                        max="30000"
                        step="1"
                        value={tier.weightGrams ?? ""}
                        onChange={(event) =>
                          updateHomeShippingTier(index, {
                            weightGrams:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    {([
                      ["lengthCm", "Longueur (cm)"],
                      ["widthCm", "Largeur (cm)"],
                      ["depthCm", "Hauteur (cm)"],
                    ] as const).map(([fieldName, label]) => (
                      <label key={fieldName}>
                        {label}
                        <input
                          type="number"
                          min="1"
                          max="200"
                          step="1"
                          value={tier[fieldName] ?? ""}
                          onChange={(event) =>
                            updateHomeShippingTier(index, {
                              [fieldName]:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Livraison facturée TTC (€)
                      <input
                        type="number"
                        min="0.01"
                        max="1000"
                        step="0.01"
                        value={
                          tier.customerPriceCents === null
                            ? ""
                            : (tier.customerPriceCents / 100).toFixed(2)
                        }
                        onChange={(event) =>
                          updateHomeShippingTier(index, {
                            customerPriceCents:
                              event.target.value === ""
                                ? null
                                : Math.round(Number(event.target.value) * 100),
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>
                        <input
                          type="checkbox"
                          checked={tier.confirmed}
                          disabled={!complete}
                          onChange={(event) =>
                            updateHomeShippingTier(index, {
                              confirmed: event.target.checked,
                            })
                          }
                        />{" "}
                        Colis et tarif confirmés
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeHomeShippingTier(index)}
                    >
                      Supprimer ce palier
                    </button>
                  </fieldset>
                );
              })}
            </div>
            <button type="button" onClick={addHomeShippingTier}>
              Ajouter un palier domicile
            </button>
          </section>
          <details style={{ marginTop: 18 }}>
            <summary>Paramètres historiques par poids</summary>
            <p className="admin-muted">
              Ces paramètres sont conservés pour compatibilité. Les profils et
              tarifs par quantité ci-dessus sont prioritaires.
            </p>
            {parcelFields(
              "Profil colis historique",
              "contractParcel",
              shipping.contractParcel,
            )}
            {rateFields(
              "Grille tarifaire historique",
              "contractRates",
              shipping.contractRates,
              "Ces tarifs ne sont pas utilisés lorsque des paliers par quantité sont définis.",
            )}
          </details>
          <section style={{ marginTop: 22 }}>
            <h3>Tarif proposé à confirmer</h3>
            <p className="admin-muted">
              Le montant communiqué de 4,51 € est conservé comme proposition
              uniquement. Son poids de référence, sa base HT/TTC et le prix
              facturé au client sont inconnus. Il ne devient jamais un devis
              tant que tous ces éléments et le tarif ne sont pas confirmés.
            </p>
            <div className="admin-form-grid">
              <label>
                Service du tarif proposé
                <input value="24R/MED - Point Relais" readOnly />
              </label>
              <label>
                Poids maximal correspondant (g)
                <input
                  type="number"
                  min="1"
                  max="30000"
                  value={shipping.proposedRate.maxWeightGrams ?? ""}
                  onChange={(event) =>
                    updateProposedRate({
                      maxWeightGrams:
                        event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Tarif transporteur (€)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  value={(shipping.proposedRate.priceCents / 100).toFixed(2)}
                  onChange={(event) =>
                    updateProposedRate({
                      priceCents: Math.round(Number(event.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                Base
                <select
                  value={shipping.proposedRate.priceBasis}
                  onChange={(event) =>
                    updateProposedRate({
                      priceBasis: event.target.value as ProposedShippingRate["priceBasis"],
                    })
                  }
                >
                  <option value="unknown">Inconnue / à confirmer</option>
                  <option value="HT">HT</option>
                  <option value="TTC">TTC</option>
                </select>
              </label>
              <label>
                Prix TTC facturé au client (€)
                <input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={
                    shipping.proposedRate.customerPriceCents === null
                      ? ""
                      : (shipping.proposedRate.customerPriceCents / 100).toFixed(2)
                  }
                  onChange={(event) =>
                    updateProposedRate({
                      customerPriceCents:
                        event.target.value === ""
                          ? null
                          : Math.round(Number(event.target.value) * 100),
                    })
                  }
                />
              </label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              <input
                type="checkbox"
                checked={shipping.proposedRate.confirmed}
                onChange={(event) =>
                  updateProposedRate({ confirmed: event.target.checked })
                }
              />{" "}
              Je confirme ce palier, sa base de prix et le montant facturé au
              client.
            </label>
          </section>
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
