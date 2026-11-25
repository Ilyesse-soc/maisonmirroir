"use client";
import { useRouter } from "next/navigation";

import { useMemo, useRef, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { CartAttachment, CartItem } from "@/lib/cart";
import type { CustomerInfo } from "@/lib/orderTypes";
import type { ShippingMethod } from "@/lib/shipping";
import type { RelayPoint } from "@/lib/mondialRelayTypes";
import { useCart } from "@/components/CartProvider";

export default function CartCheckoutButton({
  items,
  customer,
  shippingMethod,
  relayPoint,
  shippingPrice,
  checkoutEnabled,
  promotionCode,
  acceptTerms,
  cgvVersion,
  attachments = [],
  onSuccess,
}: {
  items: CartItem[];
  customer: CustomerInfo;
  shippingMethod: ShippingMethod | null;
  relayPoint: RelayPoint | null;
  shippingPrice: number | null;
  checkoutEnabled: boolean;
  promotionCode?: string;
  acceptTerms: boolean;
  cgvVersion: string;
  attachments?: CartAttachment[];
  onSuccess?: (orderId: string) => void;
}) {
  const router = useRouter();
  const {
    paypalClientId: clientId,
    isProductAvailable,
  } = useCart();
  const checkoutProofRef = useRef("");
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const subtotal = useMemo(
    () =>
      items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [items],
  );
  const resolvedShippingPrice = shippingPrice ?? 0;
  const total = subtotal + resolvedShippingPrice;
  const unavailableItems = items.filter(
    (item) => !isProductAvailable(item.productId, true),
  );
  const checkoutOrder = {
    items: items.map((item) => ({
      id: item.productId,
      name: item.variantLabel
        ? `${item.name} - ${item.variantLabel}`
        : item.name,
      category: item.category,
      categoryLabel: item.categoryLabel,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      variantLabel: item.variantLabel,
    })),
    product: {
      id: items[0]?.productId || "",
      name: items[0]?.name || "",
      category: items[0]?.category || "",
      categoryLabel: items[0]?.categoryLabel,
      unitPrice: items[0]?.unitPrice || 0,
      quantity: items[0]?.quantity || 0,
      variantLabel: items[0]?.variantLabel,
    },
    shippingMethodId: shippingMethod?.id || "",
    relayPoint: relayPoint || undefined,
    attachments,
    promotionCode,
    acceptTerms,
    cgvVersion,
    customer,
  };

  if (unavailableItems.length > 0) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Un ou plusieurs articles du panier ne sont pas encore disponibles à la
        commande. Retirez-les pour continuer.
      </p>
    );
  }

  if (!checkoutEnabled) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Les commandes et les paiements sont désactivés. Aucune commande ni
        expédition ne sera créée depuis cette page.
      </p>
    );
  }

  if (!acceptTerms || !cgvVersion) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Veuillez lire et accepter les Conditions générales de vente avant le
        paiement.
      </p>
    );
  }

  if (!shippingMethod || shippingPrice === null) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Les options de livraison ne sont pas disponibles pour cette commande.
        Le paiement reste indisponible.
      </p>
    );
  }

  if (!clientId) {
    return (
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          opacity: 0.8,
          lineHeight: 1.7,
        }}
      >
        Le paiement est momentanément indisponible. Réessayez plus tard.
      </div>
    );
  }

  return (
    <div>
      <PayPalScriptProvider
        options={{
          clientId,
          currency: "EUR",
          intent: "capture",
          components: "buttons",
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical" }}
          disabled={status === "processing" || items.length === 0}
          createOrder={async () => {
            checkoutProofRef.current = "";
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order: checkoutOrder }),
            });
            const data = (await response.json()) as {
              id?: string;
              checkoutProof?: string;
              error?: string;
            };
            if (
              !response.ok ||
              typeof data.id !== "string" ||
              typeof data.checkoutProof !== "string"
            )
              throw new Error(data.error || "PAYMENT_ORDER_CREATION_FAILED");
            checkoutProofRef.current = data.checkoutProof;
            return data.id;
          }}
          onApprove={async (data) => {
            if (status === "processing") return;
            if (!checkoutProofRef.current) {
              setStatus("error");
              setErrorMessage(
                "La vérification du montant a expiré. Recommencez le paiement.",
              );
              return;
            }
            setStatus("processing");
            setErrorMessage("");

            const sentKey = `mm:orderSent:${data.orderID}`;
            const alreadySent =
              typeof window !== "undefined" &&
              sessionStorage.getItem(sentKey) === "1";

            if (alreadySent) {
              router.push("/success");
              return;
            }

            try {
              const payload = {
                paymentMethod: "PAYPAL",
                paypalOrderId: data.orderID,
                checkoutProof: checkoutProofRef.current,
                order: checkoutOrder,
              };

              const res = await fetch("/api/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              if (!res.ok) {
                const errorData = (await res.json().catch(() => ({}))) as {
                  error?: string;
                };
                throw new Error(
                  errorData.error || `ORDER_API_FAILED_${res.status}`,
                );
              }
              const apiData = (await res.json()) as {
                orderId?: string;
                total?: string;
                paymentMethod?: string;
                subtotal?: string;
                shipping?: string;
                shippingMethod?: string;
                shippingDelay?: string;
                emailWarnings?: string[];
              };

              const orderId = apiData.orderId || "";
              if (!orderId) throw new Error("Missing orderId from API");

              try {
                if (typeof window !== "undefined")
                  sessionStorage.setItem(sentKey, "1");
              } catch {
                // ignore
              }

              try {
                if (typeof window !== "undefined") {
                  sessionStorage.setItem(
                    "mm:lastOrder",
                    JSON.stringify({
                      orderId,
                      paymentMethod: apiData.paymentMethod || "PAYPAL",
                      product: {
                        id: items[0].productId,
                        name: items[0].name,
                        categoryLabel: items[0].categoryLabel,
                        unitPrice: items[0].unitPrice.toFixed(2),
                        quantity: items[0].quantity,
                        subtotal: apiData.subtotal || subtotal.toFixed(2),
                        shipping:
                          apiData.shipping || resolvedShippingPrice.toFixed(2),
                        total: apiData.total || total.toFixed(2),
                      },
                      items: items.map((item) => ({
                        id: item.productId,
                        name: item.variantLabel
                          ? `${item.name} - ${item.variantLabel}`
                          : item.name,
                        categoryLabel: item.categoryLabel,
                        unitPrice: item.unitPrice.toFixed(2),
                        quantity: item.quantity,
                        subtotal: (item.unitPrice * item.quantity).toFixed(2),
                      })),
                      shipping: {
                        id: shippingMethod.id,
                        label: shippingMethod.label,
                        shortLabel: shippingMethod.shortLabel,
                        carrier: shippingMethod.carrier,
                        price: resolvedShippingPrice,
                        estimatedDelay: shippingMethod.estimatedDelay,
                        ...(relayPoint ? { relayPoint } : {}),
                      },
                    }),
                  );
                }
              } catch {
                // ignore
              }
            } catch (error) {
              console.error(
                "[checkout] order confirmation failed after PayPal capture",
                { paypalOrderId: data.orderID },
              );
              setStatus("error");
              setErrorMessage(
                error instanceof Error &&
                  error.message.includes("PAYMENT_CAPTURE")
                  ? "Le paiement n’a pas pu être confirmé. Vérifiez votre compte PayPal avant de réessayer."
                  : "La confirmation du paiement a échoué. Ne relancez pas le paiement et contactez MAISON MIROIR.",
              );
              return;
            }

            onSuccess?.(data.orderID);
            router.push("/success");
          }}
          onError={(error) => {
            setStatus("error");
            const message =
              error instanceof Error ? error.message : "PAYMENT_FAILED";
            setErrorMessage(
              message.includes("FIRSTPRINCESS1_EXHAUSTED")
                ? "Cette offre a atteint sa limite d’utilisation."
                : message.includes("FIRSTPRINCESS1_INVALID")
                  ? "Ce code promotionnel est invalide."
                  : message.includes("INVENTORY_UNAVAILABLE")
                    ? "Victime de son succès"
                    : `Erreur de paiement (${message}). Veuillez réessayer.`,
            );
          }}
          onCancel={() => {
            setStatus("idle");
          }}
        />
      </PayPalScriptProvider>

      {status === "processing" && (
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 12,
            opacity: 0.85,
            lineHeight: 1.7,
          }}
        >
          Traitement du paiement…
        </div>
      )}
      {status === "error" && errorMessage && (
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 12,
            color: "#ef4444",
            lineHeight: 1.7,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
