"use client";
import Image from "next/image";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import {
  MONDIAL_RELAY_POINT_RELAIS_ID,
  SHIPPING_METHODS,
} from "@/lib/shipping";
import { getCartItemSubtotal, getCartSubtotal } from "@/lib/cart";
import {
  buttonGoldStyle,
  buttonOutlineGoldStyle,
  dividerStyle,
  fonts,
  pageMaxWidth,
  theme,
} from "@/lib/uiStyles";

export default function CartPage() {
  const {
    items,
    shippingMethodId,
    setShippingMethodId,
    selectedShippingPrice,
    selectedShippingPriceLabel,
    relayPoint,
    updateItemQuantity,
    removeItem,
    itemCount,
    isProductAvailable,
    availableShippingMethodIds,
    getShippingPriceQuote,
    preparationDays,
  } = useCart();
  const unavailableItems = items.filter(
    (item) => !isProductAvailable(item.productId, true),
  );

  const availableShippingMethods = SHIPPING_METHODS.filter(method =>
    availableShippingMethodIds.includes(method.id) && getShippingPriceQuote(method.id, itemCount).price !== null,
  );
  const selectedShipping = availableShippingMethods.find(method => method.id === shippingMethodId) || null;

  const subtotal = getCartSubtotal(items);
  const shippingPrice = items.length > 0 ? selectedShippingPrice : 0;
  const total = shippingPrice === null ? null : subtotal + shippingPrice;

  return (
    <div
      className="mm-cart-shell"
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
            Panier
          </p>
          <h1
            className="mm-cart-title"
            style={{
              fontFamily: fonts.display,
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              fontWeight: 300,
              color: theme.textDark,
              margin: 0,
            }}
          >
            Votre panier ({itemCount})
          </h1>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              background: "white",
              border: `1px solid ${theme.creamDark}`,
              padding: 24,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: theme.textMid,
                lineHeight: 1.8,
              }}
            >
              Votre panier est vide.
            </p>
            <Link href="/catalogue" style={buttonGoldStyle()}>
              Découvrir le catalogue
            </Link>
          </div>
        ) : (
          <div
            className="mm-cart-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)",
              gap: 28,
            }}
          >
            <div className="mm-cart-stack" style={{ display: "grid", gap: 16 }}>
              {items.map((item) => {
                const lineSubtotal = getCartItemSubtotal(item);
                return (
                  <article
                    key={item.key}
                    className="mm-cart-card"
                    style={{
                      background: "white",
                      border: `1px solid ${theme.creamDark}`,
                      padding: 18,
                      display: "grid",
                      gridTemplateColumns: "96px 1fr",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        overflow: "hidden",
                        border: `1px solid ${theme.creamDark}`,
                      }}
                    >
                      {item.image ? (
                        <Image
                          width={96}
                          height={96}
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: theme.gold,
                          }}
                        >
                          ◈
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        className="mm-cart-summary-row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                        }}
                      >
                        <div>
                          <h2
                            style={{
                              fontFamily: fonts.display,
                              fontSize: 20,
                              fontWeight: 300,
                              color: theme.textDark,
                              margin: 0,
                            }}
                          >
                            {item.name}
                          </h2>
                          {item.variantLabel && (
                            <p
                              style={{
                                fontFamily: fonts.body,
                                fontSize: 12,
                                letterSpacing: "0.04em",
                                color: theme.textMid,
                                margin: "6px 0 0",
                              }}
                            >
                              {item.variantLabel}
                            </p>
                          )}
                          <p
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 12,
                              color: theme.textMid,
                              margin: "8px 0 0",
                            }}
                          >
                            Prix unitaire: {item.unitPrice.toFixed(2)} €
                          </p>
                          {!isProductAvailable(item.productId, true) && (
                            <p className="storefront-status" role="status">
                              Victime de son succès
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.key)}
                          style={{
                            border: `1px solid ${theme.creamDark}`,
                            background: "white",
                            padding: "8px 10px",
                            cursor: "pointer",
                            color: theme.textMid,
                          }}
                        >
                          Supprimer
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          marginTop: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            border: `1px solid ${theme.creamDark}`,
                            padding: "8px 10px",
                          }}
                        >
                          <button
                            onClick={() =>
                              updateItemQuantity(item.key, item.quantity - 1)
                            }
                            aria-label="Diminuer la quantité"
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 18,
                              color: theme.textDark,
                              width: 26,
                              height: 26,
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              minWidth: 20,
                              textAlign: "center",
                              fontFamily: fonts.body,
                              color: theme.textDark,
                            }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateItemQuantity(item.key, item.quantity + 1)
                            }
                            aria-label="Augmenter la quantité"
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 18,
                              color: theme.textDark,
                              width: 26,
                              height: 26,
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 11,
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              color: theme.textMid,
                            }}
                          >
                            Sous-total ligne
                          </div>
                          <div
                            style={{
                              fontFamily: fonts.display,
                              fontSize: 22,
                              color: theme.goldDark,
                            }}
                          >
                            {lineSubtotal.toFixed(2)} €
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside
              className="mm-cart-aside"
              style={{
                background: "white",
                border: `1px solid ${theme.creamDark}`,
                padding: 20,
                height: "fit-content",
                position: "sticky",
                top: 108,
              }}
            >
              <p
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: theme.gold,
                  marginBottom: 10,
                }}
              >
                Récapitulatif
              </p>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  fontFamily: fonts.body,
                  fontSize: 13,
                  color: theme.textMid,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Sous-total produits</span>
                  <span>{subtotal.toFixed(2)} €</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Livraison</span>
                  <span>
                    {shippingPrice === null
                      ? "À confirmer"
                      : selectedShipping?.id === MONDIAL_RELAY_POINT_RELAIS_ID
                        ? selectedShippingPriceLabel
                        : `${shippingPrice.toFixed(2)} €`}
                  </span>
                </div>
                {relayPoint && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
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
                  <span>{total === null ? "À confirmer" : `${total.toFixed(2)} €`}</span>
                </div>
              </div>

              <div style={{ ...dividerStyle(100), margin: "18px 0" }} />

              <div
                className="mm-cart-actions"
                style={{ display: "grid", gap: 10 }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: fonts.body,
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: theme.textMid,
                  }}
                >
                  Choisissez votre mode de livraison
                </p>
                {availableShippingMethods.map((method) => {
                  const checked = shippingMethodId === method.id;
                  const quote = getShippingPriceQuote(method.id, itemCount);
                  const modeAvailable =
                    availableShippingMethodIds.includes(method.id) &&
                    quote.price !== null;
                  return (
                    <label
                      key={method.id}
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
                          disabled={!modeAvailable}
                          onChange={() => setShippingMethodId(method.id)}
                        />
                        <span
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            color: theme.textDark,
                          }}
                        >
                          {method.shortLabel} -{" "}
                          {quote.label}
                        </span>
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
                  );
                })}
                {availableShippingMethods.length === 0 && <p role="status">Aucune livraison validée n’est disponible pour cette quantité.</p>}
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
                  Préparation sous {preparationDays} jours ouvrés après paiement.
                  {" "}
                  <Link href="/livraison">Consulter la politique de livraison</Link>.
                </p>
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                <Link
                  href="/checkout"
                  className="btn-gold"
                  aria-disabled={unavailableItems.length > 0}
                  onClick={(event) => {
                    if (unavailableItems.length > 0) event.preventDefault();
                  }}
                  style={{
                    ...buttonGoldStyle({ fullWidth: true }),
                    textAlign: "center",
                    textDecoration: "none",
                    ...(unavailableItems.length > 0
                      ? { opacity: 0.5, cursor: "not-allowed" }
                      : {}),
                  }}
                >
                  Passer au paiement
                </Link>
                {unavailableItems.length > 0 && (
                  <p role="status" style={{ fontSize: 12, lineHeight: 1.6 }}>
                    Retirez les articles indisponibles pour continuer.
                  </p>
                )}
                <Link
                  href="/catalogue"
                  style={{
                    ...buttonOutlineGoldStyle({ fullWidth: true }),
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Continuer mes achats
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
