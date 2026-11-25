"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { getCartItemSubtotal, getCartSubtotal } from "@/lib/cart";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

function ShoppingBagIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 17h30l2 25H7l2-25Z" />
      <path d="M17 18v-5a7 7 0 0 1 14 0v5" />
    </svg>
  );
}

export default function CartDrawer() {
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    itemCount,
    updateItemQuantity,
    removeItem,
    isProductAvailable,
  } = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const subtotal = getCartSubtotal(items);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const activeElement = document.activeElement;
    const navigationFallback = document.querySelector<HTMLElement>(
      "#mm-navbar .mm-navbar-menu, #mm-navbar .mm-navbar-cart",
    );
    returnFocusRef.current =
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      activeElement.isConnected
        ? activeElement
        : navigationFallback;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };

    if (!dialog.open) dialog.showModal();
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.width = previousBodyStyles.width;
      body.style.overflow = previousBodyStyles.overflow;
      html.style.overflow = previousBodyStyles.htmlOverflow;
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        if (returnFocusRef.current?.isConnected) {
          returnFocusRef.current.focus();
          return;
        }
        document
          .querySelector<HTMLElement>(
            "#mm-navbar .mm-navbar-menu, #mm-navbar .mm-navbar-cart",
          )
          ?.focus();
      });
    };
  }, [isDrawerOpen]);

  const updateQuantity = (key: string, name: string, quantity: number) => {
    updateItemQuantity(key, quantity);
    setAnnouncement(`${name}, quantité ${quantity}.`);
  };

  const removeProduct = (key: string, name: string) => {
    removeItem(key);
    setAnnouncement(`${name} a été retiré du panier.`);
  };

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <dialog
        ref={dialogRef}
        className="mm-cart-modal"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <section className="mm-cart-panel" aria-label="Contenu du panier">
          <header className="mm-cart-header">
            <div>
              <h2 id="cart-drawer-title">PANIER</h2>
              <p>
                {itemCount} article{itemCount > 1 ? "s" : ""}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="mm-cart-close"
              onClick={closeDrawer}
              aria-label="Fermer le panier"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </header>

          <div className="mm-cart-content">
            {items.length === 0 ? (
              <div className="mm-cart-empty">
                <ShoppingBagIcon />
                <h3>Votre panier est vide</h3>
                <span className="mm-cart-empty-divider" aria-hidden="true" />
                <p>Ajoutez un produit pour le retrouver ici.</p>
              </div>
            ) : (
              <ul className="mm-cart-items" aria-label="Articles du panier">
                {items.map((item) => {
                  const hasConfiguredPrice =
                    Number.isFinite(item.unitPrice) && item.unitPrice > 0;
                  const lineTotal = hasConfiguredPrice
                    ? getCartItemSubtotal(item)
                    : null;
                  return (
                    <li key={item.key} className="mm-cart-item">
                      <div className="mm-cart-item-image">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={120}
                            height={120}
                          />
                        ) : (
                          <span aria-hidden="true">
                            <ShoppingBagIcon />
                          </span>
                        )}
                      </div>
                      <div className="mm-cart-item-info">
                        <div className="mm-cart-item-heading">
                          <div>
                            <h3>{item.name}</h3>
                            {item.variantLabel && <p>{item.variantLabel}</p>}
                            <p>
                              {hasConfiguredPrice
                                ? `${euro.format(item.unitPrice)} l’unité`
                                : "Prix à confirmer"}
                            </p>
                            <p className="storefront-status" role="status">
                              {isProductAvailable(item.productId, true)
                                ? "Disponible"
                                : "Victime de son succès"}
                            </p>
                          </div>
                          <span className="mm-cart-item-total">
                            <span className="sr-only">Total de la ligne : </span>
                            {lineTotal === null
                              ? "À confirmer"
                              : euro.format(lineTotal)}
                          </span>
                        </div>
                        <div className="mm-cart-item-controls">
                          <div
                            className="mm-cart-quantity"
                            aria-label={`Quantité de ${item.name}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  removeProduct(item.key, item.name);
                                  return;
                                }
                                updateQuantity(
                                  item.key,
                                  item.name,
                                  item.quantity - 1,
                                );
                              }}
                              aria-label={
                                item.quantity <= 1
                                  ? `Retirer ${item.name}`
                                  : `Diminuer la quantité de ${item.name}`
                              }
                            >
                              -
                            </button>
                            <span aria-live="off">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.name,
                                  item.quantity + 1,
                                )
                              }
                              aria-label={`Augmenter la quantité de ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="mm-cart-remove"
                            onClick={() => removeProduct(item.key, item.name)}
                            aria-label={`Supprimer ${item.name} du panier`}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="mm-cart-footer">
            <dl className="mm-cart-totals">
              <div>
                <dt>Sous-total</dt>
                <dd>{euro.format(subtotal)}</dd>
              </div>
              <div>
                <dt>Livraison</dt>
                <dd>À calculer</dd>
              </div>
              <div className="mm-cart-grand-total">
                <dt>Total</dt>
                <dd>
                  {items.length === 0 ? euro.format(0) : "À calculer"}
                </dd>
              </div>
            </dl>
            <div className="mm-cart-footer-actions">
              <Link
                href="/panier"
                className="mm-cart-view"
                onClick={closeDrawer}
              >
                VOIR LE PANIER
              </Link>
              <button
                type="button"
                className="mm-cart-checkout"
                disabled
                aria-describedby="cart-orders-notice"
              >
                PASSER AU PAIEMENT
              </button>
              <p id="cart-orders-notice">
                Les commandes ouvriront prochainement.
              </p>
            </div>
          </footer>
        </section>
      </dialog>
    </>
  );
}
