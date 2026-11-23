"use client";
import Image from "next/image";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { getCartItemSubtotal, getCartSubtotal, getCartTotal } from "@/lib/cart";
import { SHIPPING_METHODS } from "@/lib/shipping";
import { fonts, theme } from "@/lib/uiStyles";

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.5 11h10.5l2-8H6.2" />
    </svg>
  );
}

export default function CartDrawer() {
  const isNewsletterPage = usePathname() === "/newsletter";
  const drawerTheme = isNewsletterPage
    ? {
        ...theme,
        gold: "#6b3e2a",
        goldLight: "#e5cdb5",
        goldDark: "#4f3012",
        cream: "#f3e4d1",
        creamDark: "#d8b99a",
        textDark: "#4f3012",
        textMid: "#6b513c",
      }
    : theme;
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    flashMessage,
    itemCount,
    shippingMethodId,
    selectedShippingPrice,
    updateItemQuantity,
    removeItem,
  } = useCart();

  const shippingLabel = useMemo(
    () =>
      SHIPPING_METHODS.find((method) => method.id === shippingMethodId)
        ?.shortLabel || "Livraison non choisie",
    [shippingMethodId],
  );

  const subtotal = getCartSubtotal(items);
  const total = getCartTotal(items, shippingMethodId);
  const shippingPrice = items.length > 0 ? selectedShippingPrice : 0;

  return (
    <div
      aria-hidden={!isDrawerOpen}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: isDrawerOpen ? "auto" : "none",
        zIndex: 70,
      }}
    >
      <div
        onClick={closeDrawer}
        style={{
          position: "absolute",
          inset: 0,
          background: isDrawerOpen ? "rgba(16, 12, 4, 0.45)" : "transparent",
          opacity: isDrawerOpen ? 1 : 0,
          transition: "opacity 180ms ease",
        }}
      />

      <aside
        className={`mm-drawer-panel${isNewsletterPage ? " mm-drawer-panel--launch" : ""}`}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "min(100vw, 420px)",
          height: "100%",
          background: isNewsletterPage
            ? "linear-gradient(120deg, #f3e4d1, #ead3b9 48%, #f3e4d1)"
            : "#fffdfa",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          transform: isDrawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: `1px solid ${drawerTheme.creamDark}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: drawerTheme.gold,
              }}
            >
              Panier
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 18,
                color: drawerTheme.textDark,
                marginTop: 4,
              }}
            >
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Fermer le panier"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 26,
              color: drawerTheme.textMid,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {flashMessage && (
          <div
            style={{
              margin: "14px 18px 0",
              padding: "10px 12px",
              border: `1px solid ${drawerTheme.gold}`,
              color: drawerTheme.goldDark,
              background: isNewsletterPage ? "#f5e6d4" : "#fff8e8",
              fontFamily: fonts.body,
              fontSize: 12,
            }}
          >
            {flashMessage}
          </div>
        )}

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {items.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                color: drawerTheme.textMid,
              }}
            >
              <div>
                <div
                  style={{
                    margin: "0 auto 12px",
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    border: `1px solid ${drawerTheme.creamDark}`,
                    display: "grid",
                    placeItems: "center",
                    color: drawerTheme.gold,
                  }}
                >
                  <CartIcon />
                </div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 18,
                    color: drawerTheme.textDark,
                  }}
                >
                  Votre panier est vide
                </div>
                <p
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    lineHeight: 1.7,
                    marginTop: 8,
                  }}
                >
                  Ajoutez un produit pour le retrouver ici.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {items.map((item) => {
                const subtotalLine = getCartItemSubtotal(item);
                return (
                  <div
                    key={item.key}
                    className="mm-drawer-item"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px 1fr",
                      gap: 12,
                      paddingBottom: 14,
                      borderBottom: `1px solid ${drawerTheme.creamDark}`,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 72,
                        height: 72,
                        overflow: "hidden",
                        background: drawerTheme.cream,
                        border: `1px solid ${drawerTheme.creamDark}`,
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
                            color: drawerTheme.gold,
                          }}
                        >
                          ◈
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: fonts.display,
                              fontSize: 15,
                              color: drawerTheme.textDark,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.name}
                          </div>
                          {item.variantLabel && (
                            <div
                              style={{
                                fontFamily: fonts.body,
                                fontSize: 11,
                                color: drawerTheme.textMid,
                                letterSpacing: "0.04em",
                                marginTop: 4,
                              }}
                            >
                              {item.variantLabel}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            border: `1px solid ${drawerTheme.creamDark}`,
                            padding: "6px 8px",
                          }}
                        >
                          <button
                            onClick={() => {
                              if (item.quantity <= 1) {
                                removeItem(item.key);
                                return;
                              }
                              updateItemQuantity(item.key, item.quantity - 1);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              width: 22,
                              height: 22,
                              color: drawerTheme.textDark,
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              minWidth: 20,
                              textAlign: "center",
                              fontFamily: fonts.body,
                              fontSize: 13,
                              color: drawerTheme.textDark,
                            }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              updateItemQuantity(item.key, item.quantity + 1);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              width: 22,
                              height: 22,
                              color: drawerTheme.textDark,
                            }}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.key)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: drawerTheme.textMid,
                            fontFamily: fonts.body,
                            fontSize: 12,
                          }}
                        >
                          Supprimer
                        </button>
                        <div
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            color: drawerTheme.textDark,
                          }}
                        >
                          {subtotalLine.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="mm-drawer-summary"
          style={{
            borderTop: `1px solid ${drawerTheme.creamDark}`,
            padding: 18,
            background: isNewsletterPage ? "#f3e4d1" : "#fff",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
              marginBottom: 16,
              fontFamily: fonts.body,
              fontSize: 13,
              color: drawerTheme.textMid,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Sous-total</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Livraison</span>
              <span>{shippingPrice.toFixed(2)} €</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: fonts.display,
                fontSize: 16,
                color: drawerTheme.textDark,
              }}
            >
              <span>Total</span>
              <span>{total.toFixed(2)} €</span>
            </div>
            {items.length > 0 && (
              <div style={{ fontSize: 11, letterSpacing: "0.08em" }}>
                Mode: {shippingLabel}
              </div>
            )}
          </div>

          <div
            className="mm-drawer-footer-actions"
            style={{ display: "grid", gap: 10 }}
          >
            <Link
              href="/panier"
              onClick={closeDrawer}
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
                border: `1px solid ${drawerTheme.gold}`,
                padding: "12px 14px",
                color: drawerTheme.goldDark,
                fontFamily: fonts.body,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Voir le panier
            </Link>
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="btn-gold"
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
                color: isNewsletterPage ? "#f3ece1" : "#fff",
                background: isNewsletterPage
                  ? "linear-gradient(110deg, #542806, #472106)"
                  : undefined,
              }}
            >
              Passer au paiement
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
