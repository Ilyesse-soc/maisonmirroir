"use client";

import Link from "next/link";
import { useState } from "react";
import CartReminderConsent from "@/components/CartReminderConsent";
import CartCheckoutButton from "@/components/CartCheckoutButton";
import { useCart } from "@/components/CartProvider";
import {
  MONDIAL_RELAY_POINT_RELAIS_ID,
  SHIPPING_METHODS,
  formatEuro,
  relaySearchErrorMessage,
} from "@/lib/shipping";
import { getCartSubtotal } from "@/lib/cart";
import type { RelayPoint } from "@/lib/mondialRelayTypes";
import {
  buttonOutlineGoldStyle,
  dividerStyle,
  fonts,
  pageMaxWidth,
  theme,
} from "@/lib/uiStyles";

export default function CheckoutPage() {
  const {
    items,
    itemCount,
    shippingMethodId,
    setShippingMethodId,
    relayPoint,
    setRelayPoint,
    checkoutEnabled,
    getShippingPriceQuote,
    availableShippingMethodIds,
    shippingConfigurationError,
    shippingConfigurationLoaded,
    preparationDays,
    cgvVersion,
    retryShippingConfiguration,
  } = useCart();
  const [relayPoints, setRelayPoints] = useState<RelayPoint[]>([]);
  const [relaySearchError, setRelaySearchError] = useState("");
  const [relaySearchMessage, setRelaySearchMessage] = useState("");
  const [relaySearchBusy, setRelaySearchBusy] = useState(false);
  const [promotionInput, setPromotionInput] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionDiscountCents, setPromotionDiscountCents] = useState(0);
  const [promotionCartKey, setPromotionCartKey] = useState("");
  const [promotionMessage, setPromotionMessage] = useState("");
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [address, setAddress] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    zip: "",
    country: "France",
  });

  const availableShippingMethods = SHIPPING_METHODS.filter((method) => {
    const quote = getShippingPriceQuote(method.id, itemCount);
    return (
      availableShippingMethodIds.includes(method.id) && quote.price !== null
    );
  });
  const selectedShipping =
    availableShippingMethods.find((method) => method.id === shippingMethodId) ||
    null;
  const selectedShippingQuote = selectedShipping
    ? getShippingPriceQuote(selectedShipping.id, itemCount)
    : { price: null, label: "À calculer" };
  const selectedShippingPrice = selectedShippingQuote.price;
  const selectedShippingPriceLabel = selectedShippingQuote.label;

  const subtotal = getCartSubtotal(items);
  const currentCartKey = items
    .map((item) => `${item.productId}:${item.quantity}:${item.unitPrice}`)
    .join("|");
  const currentPromotionDiscount =
    promotionCartKey === currentCartKey ? promotionDiscountCents : 0;
  const currentPromotionCode =
    promotionCartKey === currentCartKey ? promotionCode : "";
  const total =
    subtotal -
    currentPromotionDiscount / 100 +
    (selectedShippingPrice ?? 0);

  async function applyPromotion() {
    setPromotionBusy(true);
    setPromotionMessage("");
    try {
      const response = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          code: promotionInput.trim(),
          items: items.map((item) => ({
            id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        code?: string;
        discountCents?: number;
        message?: string;
        error?: string;
      };
      if (!response.ok || typeof data.discountCents !== "number")
        throw new Error(
          data.message ||
            (data.error === "FIRSTPRINCESS1_EXHAUSTED"
              ? "Cette offre a atteint sa limite d’utilisation."
              : "Ce code promotionnel est invalide."),
        );
      setPromotionCode(data.code || promotionInput.trim().toUpperCase());
      setPromotionDiscountCents(data.discountCents);
      setPromotionCartKey(currentCartKey);
      setPromotionMessage("Code promotionnel appliqué.");
    } catch (error) {
      setPromotionCode("");
      setPromotionDiscountCents(0);
      setPromotionCartKey("");
      setPromotionMessage(
        error instanceof Error
          ? error.message
          : "Ce code promotionnel est invalide.",
      );
    } finally {
      setPromotionBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          paddingTop: 110,
          background: theme.marble,
        }}
      >
        <div
          style={{
            maxWidth: pageMaxWidth,
            margin: "0 auto",
            padding: "48px 24px 80px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontFamily: fonts.display,
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              fontWeight: 300,
              color: theme.textDark,
            }}
          >
            Votre panier est vide
          </h1>
          <p
            style={{
              fontFamily: fonts.body,
              color: theme.textMid,
              lineHeight: 1.8,
            }}
          >
            Ajoutez au moins un produit avant de passer au paiement.
          </p>
          <Link
            href="/catalogue"
            className="btn-gold"
            style={{
              ...buttonOutlineGoldStyle({ fullWidth: false }),
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (field: keyof typeof address, value: string) => {
    setAddress((previous) => ({ ...previous, [field]: value }));
    if (field === "zip" || field === "city") {
      setRelayPoint(null);
      setRelayPoints([]);
      setRelaySearchMessage("");
    }
  };

  async function searchRelayPoints() {
    setRelaySearchBusy(true);
    setRelaySearchError("");
    setRelaySearchMessage("");
    setRelayPoints([]);
    setRelayPoint(null);
    try {
      const query = new URLSearchParams({ quantity: String(itemCount) });
      if (/^[0-9]{5}$/.test(address.zip.trim()))
        query.set("postalCode", address.zip.trim());
      if (address.city.trim().length >= 2)
        query.set("city", address.city.trim());
      if (
        /^[0-9]{5}$/.test(address.zip.trim()) ||
        address.city.trim().length >= 2
      )
        query.set(
          "address",
          [address.street, address.zip, address.city]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(", "),
        );
      const response = await fetch(
        `/api/shipping/mondial-relay/points?${query.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        source?: "production";
        points?: RelayPoint[];
        message?: string;
      };
      if (!response.ok) {
        setRelaySearchError(relaySearchErrorMessage(response.status));
        return;
      }
      const points = Array.isArray(data.points) ? data.points : [];
      setRelayPoints(points);
      setRelaySearchMessage(
        data.message ||
          "Résultats de la recherche Mondial Relay.",
      );
    } catch {
      setRelaySearchError(relaySearchErrorMessage(0));
    } finally {
      setRelaySearchBusy(false);
    }
  }

  return (
    <div
      className="mm-checkout-shell"
      style={{ paddingTop: 88, background: theme.marble }}
    >
      <div
        style={{
          maxWidth: pageMaxWidth,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: theme.gold,
              marginBottom: 8,
            }}
          >
            Checkout
          </p>
          <h1
            className="mm-checkout-title"
            style={{
              fontFamily: fonts.display,
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              fontWeight: 300,
              color: theme.textDark,
              margin: 0,
            }}
          >
            Finaliser votre commande
          </h1>
        </div>

        <div
          className="mm-checkout-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            gap: 28,
          }}
        >
          <section
            className="mm-checkout-stack"
            style={{ display: "grid", gap: 18 }}
          >
            <div
              className="mm-checkout-card"
              style={{
                background: "white",
                border: `1px solid ${theme.creamDark}`,
                padding: 20,
              }}
            >
              <h2
                style={{
                  fontFamily: fonts.display,
                  fontSize: 22,
                  fontWeight: 300,
                  margin: 0,
                  color: theme.textDark,
                }}
              >
                Informations client
              </h2>
              <div style={{ ...dividerStyle(80), margin: "16px 0 18px" }} />
              <div style={{ display: "grid", gap: 14 }}>
                <Field
                  label="Prénom *"
                  value={address.firstName}
                  onChange={(value) => handleChange("firstName", value)}
                />
                <Field
                  label="Nom *"
                  value={address.lastName}
                  onChange={(value) => handleChange("lastName", value)}
                />
                <Field
                  label="Email *"
                  value={address.email}
                  type="email"
                  onChange={(value) => handleChange("email", value)}
                />
                <Field
                  label="Téléphone *"
                  value={address.phone}
                  type="tel"
                  onChange={(value) => handleChange("phone", value)}
                />
                <Field
                  label="Adresse *"
                  value={address.street}
                  onChange={(value) => handleChange("street", value)}
                />
                <p role="note" style={{ margin: "-4px 0 0", fontSize: 12 }}>
                  Indiquez le numéro avant le nom de la rue.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 14,
                  }}
                >
                  <Field
                    label="Ville *"
                    value={address.city}
                    onChange={(value) => handleChange("city", value)}
                  />
                  <Field
                    label="Code postal *"
                    value={address.zip}
                    onChange={(value) => handleChange("zip", value)}
                  />
                </div>
                <Field
                  label="Pays"
                  value={address.country}
                  onChange={(value) => handleChange("country", value)}
                />
              </div>
            </div>

            <div
              className="mm-checkout-card"
              style={{
                background: "white",
                border: `1px solid ${theme.creamDark}`,
                padding: 20,
              }}
            >
              <h2
                style={{
                  fontFamily: fonts.display,
                  fontSize: 22,
                  fontWeight: 300,
                  margin: 0,
                  color: theme.textDark,
                }}
              >
                Livraison
              </h2>
              <div style={{ ...dividerStyle(80), margin: "16px 0 18px" }} />
              <div style={{ display: "grid", gap: 10 }}>
                {availableShippingMethods.map((method) => {
                  const checked = shippingMethodId === method.id;
                  const quote = getShippingPriceQuote(method.id, itemCount);
                  return (
                    <div key={method.id}>
                      <label
                        style={{
                          border: `1px solid ${checked ? theme.gold : theme.creamDark}`,
                          background: checked ? "#fffaf0" : "white",
                          padding: "12px 14px",
                          cursor: "pointer",
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <input
                            type="radio"
                            checked={checked}
                            onChange={() => setShippingMethodId(method.id)}
                          />
                          <span
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 13,
                              color: theme.textDark,
                            }}
                          >
                            {method.shortLabel}
                          </span>
                          <strong
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 13,
                              color: theme.textDark,
                            }}
                          >
                            {quote.label}
                          </strong>
                        </div>
                        <span
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 11,
                            color: theme.textMid,
                            marginLeft: 24,
                          }}
                        >
                          Délai estimé: {method.estimatedDelay}
                        </span>
                      </label>
                      {checked && method.id === MONDIAL_RELAY_POINT_RELAIS_ID && (
                        <div
                          style={{
                            border: `1px solid ${theme.creamDark}`,
                            borderTop: 0,
                            padding: 14,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <p
                            role="note"
                            style={{
                              margin: 0,
                              color: theme.textMid,
                              fontSize: 12,
                              lineHeight: 1.6,
                            }}
                          >
                            {selectedShippingPrice === null
                              ? "Aucune livraison n’est disponible pour cette commande."
                              : checkoutEnabled
                                ? "Le paiement PayPal sécurisé est proposé à l’étape suivante."
                                : "Les commandes et paiements ne sont pas encore ouverts."}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: theme.textMid }}>
                            La recherche peut utiliser le code postal, la ville
                            ou les éléments géographiques de l’adresse de livraison.
                          </p>
                          <button
                            type="button"
                            onClick={searchRelayPoints}
                            disabled={
                              relaySearchBusy ||
                              (!/^[0-9]{5}$/.test(address.zip.trim()) &&
                                address.city.trim().length < 2)
                            }
                          >
                            {relaySearchBusy
                              ? "Recherche…"
                              : "Rechercher un Point Relais"}
                          </button>
                          {relaySearchMessage && (
                            <p role="status" style={{ margin: 0, fontSize: 12 }}>
                              {relaySearchMessage}
                            </p>
                          )}
                          {relaySearchError && (
                            <p role="alert" style={{ margin: 0, color: "#b42318", fontSize: 12 }}>
                              {relaySearchError}
                            </p>
                          )}
                          {relayPoints.map((point) => (
                            <label
                              key={`${point.source}:${point.id}`}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "auto 1fr",
                                gap: 10,
                                padding: 12,
                                border: `1px solid ${relayPoint?.id === point.id ? theme.gold : theme.creamDark}`,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="radio"
                                name="mondial-relay-point"
                                checked={relayPoint?.id === point.id}
                                onChange={() => setRelayPoint(point)}
                              />
                              <span style={{ display: "grid", gap: 4 }}>
                                <strong>{point.label}</strong>
                                <span>
                                  {point.address.join(", ")} - {point.postalCode}{" "}
                                  {point.city}
                                </span>
                                {point.distanceKm !== undefined && (
                                  <span>{point.distanceKm} km</span>
                                )}
                                {point.openingHours?.length ? (
                                  <span>
                                    Horaires :{" "}
                                    {point.openingHours
                                      .map(
                                        (entry) =>
                                          `${entry.day} ${entry.periods.join(", ")}`,
                                      )
                                      .join(" ; ")}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                          {relayPoint && (
                            <p role="status" style={{ margin: 0, fontSize: 12 }}>
                              Point sélectionné : {relayPoint.label} -{" "}
                              {relayPoint.location}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {availableShippingMethods.length === 0 && (
                  <div role="status" style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                      {!shippingConfigurationLoaded
                        ? "Chargement des options de livraison…"
                        : shippingConfigurationError
                          ? "Les options de livraison sont momentanément indisponibles. Réessayez dans un instant."
                          : "Aucune option de livraison n’est disponible pour cette quantité. Modifiez le panier ou réessayez."}
                    </p>
                    <button
                      type="button"
                      onClick={retryShippingConfiguration}
                      disabled={!shippingConfigurationLoaded}
                      style={buttonOutlineGoldStyle({ fullWidth: false })}
                    >
                      Réessayer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside
            className="mm-checkout-aside"
            style={{
              background: "white",
              border: `1px solid ${theme.creamDark}`,
              padding: 20,
              height: "fit-content",
              position: "sticky",
              top: 108,
            }}
          >
            <h2
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: 300,
                margin: 0,
                color: theme.textDark,
              }}
            >
              Récapitulatif
            </h2>
            <div style={{ ...dividerStyle(80), margin: "16px 0 18px" }} />

            <div
              className="mm-checkout-stack"
              style={{ display: "grid", gap: 12, marginBottom: 18 }}
            >
              {items.map((item) => (
                <div
                  key={item.key}
                  className="mm-checkout-summary-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    color: theme.textMid,
                  }}
                >
                  <div>
                    <div style={{ color: theme.textDark }}>{item.name}</div>
                    {item.variantLabel && (
                      <div style={{ fontSize: 11, marginTop: 3 }}>
                        {item.variantLabel}
                      </div>
                    )}
                    <div style={{ fontSize: 11, marginTop: 3 }}>
                      x{item.quantity}
                    </div>
                  </div>
                  <div style={{ color: theme.textDark }}>
                    {formatEuro(item.unitPrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
              <label
                htmlFor="checkout-promotion-code"
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: theme.textMid,
                }}
              >
                Code promotionnel
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="checkout-promotion-code"
                  value={promotionInput}
                  onChange={(event) => {
                    setPromotionInput(event.target.value);
                    setPromotionCode("");
                    setPromotionDiscountCents(0);
                    setPromotionCartKey("");
                    setPromotionMessage("");
                  }}
                  maxLength={80}
                  style={{ ...buttonOutlineGoldStyle(), minWidth: 0, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={applyPromotion}
                  disabled={promotionBusy || !promotionInput.trim()}
                  style={buttonOutlineGoldStyle({ fullWidth: false })}
                >
                  {promotionBusy ? "Vérification…" : "Appliquer"}
                </button>
              </div>
              {promotionMessage && (
                <p role="status" style={{ margin: 0, fontSize: 12 }}>
                  {promotionMessage}
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                fontFamily: fonts.body,
                fontSize: 13,
                color: theme.textMid,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Sous-total produits</span>
                <span>{formatEuro(subtotal)}</span>
              </div>
              {currentPromotionDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Réduction {currentPromotionCode}</span>
                  <span>-{formatEuro(currentPromotionDiscount / 100)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Livraison</span>
                <span>
                  {items.length === 0
                    ? "À calculer"
                    : selectedShippingPriceLabel}
                </span>
              </div>
              {relayPoint && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Point Relais sélectionné</span>
                  <span style={{ textAlign: "right" }}>
                    {relayPoint.label}, {relayPoint.postalCode} {relayPoint.city}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.display,
                  fontSize: 18,
                  color: theme.textDark,
                }}
              >
                <span>Total TTC</span>
                <span>
                  {selectedShippingPrice === null
                    ? "À calculer"
                    : formatEuro(total)}
                </span>
              </div>
            </div>

            <div style={{ ...dividerStyle(100), margin: "18px 0" }} />

            <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.7 }}>
              <strong>Préparation :</strong> {preparationDays} jours ouvrés après
              confirmation du paiement.
              <br />
              <strong>Acheminement :</strong> 3 à 5 jours ouvrés en moyenne
              après prise en charge par Mondial Relay.
              {" "}
              <Link href="/livraison">Consulter la politique de livraison</Link>.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                marginBottom: 14,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                J’ai lu et j’accepte les{" "}
                <Link href="/conditions-de-vente" target="_blank">
                  Conditions générales de vente
                </Link>
                . Cette case n’est pas précochée.
              </span>
            </label>

            <div className="mm-checkout-actions">
              <CartReminderConsent email={address.email} />
              <CartCheckoutButton
                items={items}
                customer={address}
                shippingMethod={selectedShipping}
                relayPoint={relayPoint}
                shippingPrice={selectedShippingPrice}
                checkoutEnabled={checkoutEnabled}
                promotionCode={currentPromotionCode || undefined}
                acceptTerms={termsAccepted}
                cgvVersion={cgvVersion}
              />
            </div>

            <div className="mm-checkout-actions" style={{ marginTop: 16 }}>
              <Link
                href="/panier"
                style={{
                  ...buttonOutlineGoldStyle({ fullWidth: true }),
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                Retour au panier
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span
        style={{
          fontFamily: fonts.body,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.textMid,
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          padding: "12px 14px",
          border: `1px solid ${theme.creamDark}`,
          background: "white",
          fontFamily: fonts.body,
        }}
      />
    </label>
  );
}
