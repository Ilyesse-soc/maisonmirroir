"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  type MondialRelaySettings,
  type MondialRelaySender,
  type ParcelProfile,
  type ProposedShippingRate,
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
            <h3>Expéditeur et collecte</h3>
            <p className="admin-muted">
              Saisissez les coordonnées d’expédition communiquées par votre
              entreprise. Aucun mode ni pays n’est pré-sélectionné comme
              autorisé. Le mode de collecte doit correspondre à votre contrat.
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
              <label>Téléphone<input type="tel" value={shipping.sender.phone} maxLength={30} onChange={(event) => updateSender("phone", event.target.value)} /></label>
              <label>Email<input type="email" value={shipping.sender.email} maxLength={254} onChange={(event) => updateSender("email", event.target.value)} /></label>
              <label>Mode de collecte fourni par Mondial Relay<input value={shipping.collectionMode} maxLength={20} onChange={(event) => setShipping((current) => ({ ...current, collectionMode: event.target.value, collectionModeConfirmed: false }))} placeholder="À renseigner après confirmation" /></label>
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
              Je confirme que ce mode de collecte est autorisé par mon contrat.
            </label>
          </section>
          <section style={{ marginTop: 20 }}>
            <h3>Contrat et services autorisés</h3>
            <p className="admin-muted">
              Seuls 24R/MED (Point Relais) et 24R/APM (Locker) sont pris en
              charge par l’intégration actuelle. Leur présence ici ne signifie
              pas qu’ils sont inclus dans votre contrat. Laissez les services
              décochés jusqu’à confirmation écrite de Mondial Relay.
            </p>
            <div className="admin-form-grid">
              <label>
                Service utilisé pour la recherche et les expéditions
                <select
                  value={shipping.serviceCode}
                  onChange={(event) =>
                    setShipping((current) => ({
                      ...current,
                      serviceCode: event.target.value as ShippingRate["serviceCode"],
                      serviceConfirmed: false,
                    }))
                  }
                >
                  <option value="24R/MED">24R/MED - Point Relais</option>
                  <option value="24R/APM">24R/APM - Locker</option>
                </select>
              </label>
              <div>
                {(["24R/MED", "24R/APM"] as const).map((service) => (
                  <label key={service} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={shipping.allowedServices.includes(service)}
                      onChange={(event) =>
                        setShipping((current) => ({
                          ...current,
                          allowedServices: event.target.checked
                            ? [...new Set([...current.allowedServices, service])]
                            : current.allowedServices.filter((item) => item !== service),
                          serviceConfirmed: false,
                        }))
                      }
                    />{" "}
                    {service} autorisé par mon contrat
                  </label>
                ))}
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
          {parcelFields(
            "Profil colis contractuel",
            "contractParcel",
            shipping.contractParcel,
          )}
          <p className="admin-muted">
            Le poids et les dimensions doivent décrire le colis réellement
            emballé. « Articles par colis » fixe la limite d’articles couverts
            par ce profil.
          </p>
          {rateFields(
            "Grille tarifaire par poids",
            "contractRates",
            shipping.contractRates,
            "Pour chaque palier, saisissez le coût transporteur et précisez s’il est HT ou TTC, puis le prix TTC facturé au client. Un palier n’est utilisable qu’après confirmation explicite et avec tous ses paramètres renseignés.",
          )}
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
                <select
                  value={shipping.proposedRate.serviceCode}
                  onChange={(event) =>
                    updateProposedRate({
                      serviceCode: event.target.value as ProposedShippingRate["serviceCode"],
                      confirmed: false,
                    })
                  }
                >
                  <option value="24R/MED">24R/MED - Point Relais</option>
                  <option value="24R/APM">24R/APM - Locker</option>
                </select>
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
