"use client";
import { useRouter } from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { getProductById } from "@/lib/products";
import type { RelayPoint } from "@/lib/mondialRelayTypes";
import { useCart } from "@/components/CartProvider";

type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  country?: string;
};

type ProductInfo = {
  id: string;
  name: string;
  category: string;
  categoryLabel?: string;
  unitPrice: number;
  quantity: number;
};

type OrderPayload = {
  product: ProductInfo;
  customValues?: Record<string, string>;
  shipping: {
    id: string;
    label: string;
    shortLabel: string;
    carrier: string;
    price: number;
    estimatedDelay: string;
  };
  relayPoint?: RelayPoint;
  promotionCode?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    base64: string;
  }>;
  customer: CustomerInfo;
};

export default function PayPalButton({
  amount = 1,
  order,
}: {
  amount?: number;
  order: OrderPayload;
}) {
  const router = useRouter();
  const { isProductAvailable, cgvVersion } = useCart();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const product = getProductById(order.product.id);
  const isAvailable = product
    ? isProductAvailable(product.id, product.availableForSale === true)
    : false;
  const checkoutOrder = {
    acceptTerms,
    cgvVersion,
    product: order.product,
    items: [order.product],
    customer: order.customer,
    shippingMethodId: order.shipping.id,
    relayPoint: order.relayPoint,
    attachments: order.attachments,
    customValues: order.customValues || {},
    promotionCode: order.promotionCode,
  };

  const safeAmount = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Invalid amount");
    return amount;
  }, [amount]);
  const displayAmount = useMemo(() => safeAmount.toFixed(2), [safeAmount]);

  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentConfigLoaded, setPaymentConfigLoaded] = useState(false);
  const [clientId, setClientId] = useState("");
  const checkoutProofRef = useRef("");

  useEffect(() => {
    let active = true;
    fetch("/api/shipping/config", { cache: "no-store" })
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok) throw new Error("PAYMENT_CONFIG_UNAVAILABLE");
        if (active)
          setPaymentEnabled(
            config.shopOpen === true && config.paymentsEnabled === true,
          );
        if (active && typeof config.paypalClientId === "string")
          setClientId(config.paypalClientId);
      })
      .catch(() => {
        if (active) setPaymentEnabled(false);
      })
      .finally(() => {
        if (active) setPaymentConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!product) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Cette collection n’est pas disponible.
      </p>
    );
  }
  if (!isAvailable) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Victime de son succès
      </p>
    );
  }

  if (!paymentConfigLoaded || !paymentEnabled) {
    return (
      <p role="status" style={{ fontSize: 13, lineHeight: 1.7 }}>
        Les commandes et les paiements sont désactivés. Aucune commande ne sera
        créée depuis cette page.
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
        La configuration PayPal de production n’est pas encore prête.
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "flex", gap: 8, marginBottom: 16, fontSize: 12 }}>
        <input type="checkbox" required checked={acceptTerms}
          onChange={event => setAcceptTerms(event.target.checked)} />
        <span>J&apos;ai lu et j&apos;accepte les <a href="/conditions-de-vente" target="_blank" rel="noopener noreferrer">Conditions g&#233;n&#233;rales de vente</a>.</span>
      </label>
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
          disabled={status === "processing" || !acceptTerms || !cgvVersion}
          forceReRender={[acceptTerms, cgvVersion, order.shipping.id, order.product.quantity]}
          createOrder={async () => {
            if (!acceptTerms || !cgvVersion) throw new Error("CGV_ACCEPTANCE_REQUIRED");
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

            // Anti-duplicate submission (client-side)
            const sentKey = `mm:orderSent:${data.orderID}`;
            const alreadySent =
              typeof window !== "undefined" &&
              sessionStorage.getItem(sentKey) === "1";

            if (alreadySent) {
              router.push("/success");
              return;
            }

            if (!alreadySent) {
              try {
                const unitPrice = order.product.unitPrice;
                const quantity = order.product.quantity;
                if (!Number.isFinite(unitPrice) || unitPrice <= 0)
                  throw new Error("Invalid unitPrice");
                if (!Number.isFinite(quantity) || quantity <= 0)
                  throw new Error("Invalid quantity");

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
                };

                const orderId = apiData.orderId || "";
                const total = apiData.total || displayAmount;
                const subtotal =
                  apiData.subtotal ||
                  (order.product.unitPrice * order.product.quantity).toFixed(
                    2,
                  );
                const shippingTotal =
                  apiData.shipping || order.shipping.price.toFixed(2);
                const paymentMethod = apiData.paymentMethod || "PAYPAL";

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
                        paymentMethod,
                        product: {
                          id: order.product.id,
                          name: order.product.name,
                          categoryLabel: order.product.categoryLabel,
                          unitPrice: unitPrice.toFixed(2),
                          quantity,
                          subtotal,
                          shipping: shippingTotal,
                          total,
                        },
                        shipping: order.shipping,
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
                    : `La confirmation du paiement a échoué${error instanceof Error ? ` (${error.message})` : ""}. Ne relancez pas le paiement et contactez MAISON MIROIR.`,
                );
                return;
              }
            }

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
