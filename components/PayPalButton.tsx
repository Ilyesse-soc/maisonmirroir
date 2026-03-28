"use client";

import { useMemo, useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";

type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
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
  customer: CustomerInfo;
};

export default function PayPalButton({
  amount = 1,
  order,
}: {
  amount?: number;
  order: OrderPayload;
}) {
  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();

  const safeAmount = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    return amount;
  }, [amount]);
  const displayAmount = useMemo(() => safeAmount.toFixed(2), [safeAmount]);

  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  if (!clientId) {
    return (
      <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8, lineHeight: 1.7 }}>
        Configuration requise : définis NEXT_PUBLIC_PAYPAL_CLIENT_ID dans .env.local.
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
          disabled={status === "processing"}
          createOrder={(_data, actions) => {
            const value = safeAmount.toFixed(2);
            return actions.order.create({
              intent: "CAPTURE",
              purchase_units: [
                {
                  amount: {
                    currency_code: "EUR",
                    value,
                  },
                },
              ],
            });
          }}
          onApprove={async (data, actions) => {
            if (status === "processing") return;
            setStatus("processing");
            setErrorMessage("");

            let capture: unknown = null;
            try {
              if (actions.order) {
                capture = await actions.order.capture();
              } else {
                throw new Error("PayPal capture unavailable");
              }
            } catch (e) {
              setStatus("error");
              setErrorMessage("Le paiement n'a pas pu être capturé. Veuillez réessayer.");
              return;
            }

            // Anti-duplicate submission (client-side)
            const sentKey = `mm:orderSent:${data.orderID}`;
            const alreadySent = typeof window !== "undefined" && sessionStorage.getItem(sentKey) === "1";

            if (!alreadySent) {
              try {
                const unitPrice = order.product.unitPrice;
                const quantity = order.product.quantity;
                if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("Invalid unitPrice");
                if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");

                const payload = {
                  paymentMethod: "PAYPAL",
                  paypalOrderId: data.orderID,
                  paypalCapture: capture,
                  order: {
                    ...order,
                    product: {
                      ...order.product,
                      unitPrice,
                      quantity,
                    },
                  },
                };

                const res = await fetch("/api/order", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                if (!res.ok) {
                  const msg = "Paiement confirmé, mais l'envoi d'email a échoué.";
                  setStatus("error");
                  setErrorMessage(msg);
                  try {
                    if (typeof window !== "undefined") sessionStorage.setItem("mm:orderEmailError", msg);
                  } catch {
                    // ignore
                  }
                } else {
                  const apiData = (await res.json().catch(() => null)) as
                    | { orderId?: string; total?: string; paymentMethod?: string }
                    | null;

                  const orderId = apiData?.orderId || "";
                  const total = apiData?.total || displayAmount;
                  const paymentMethod = apiData?.paymentMethod || "PAYPAL";

                  if (!orderId) throw new Error("Missing orderId from API");

                  try {
                    if (typeof window !== "undefined") sessionStorage.setItem(sentKey, "1");
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
                          paypalOrderId: data.orderID,
                          product: {
                            id: order.product.id,
                            name: order.product.name,
                            categoryLabel: order.product.categoryLabel,
                            unitPrice: unitPrice.toFixed(2),
                            quantity,
                            total,
                          },
                          customValues: order.customValues || {},
                          address: order.customer,
                        })
                      );
                    }
                  } catch {
                    // ignore
                  }
                }
              } catch (e) {
                const msg = "Paiement confirmé, mais l'envoi d'email a échoué.";
                setStatus("error");
                setErrorMessage(msg);
                try {
                  if (typeof window !== "undefined") sessionStorage.setItem("mm:orderEmailError", msg);
                } catch {
                  // ignore
                }
              }
            }

            window.location.href = "/success";
          }}
          onError={(err) => {
            setStatus("error");
            setErrorMessage("Erreur PayPal. Veuillez réessayer.");
          }}
          onCancel={(data) => {
            setStatus("idle");
          }}
        />
      </PayPalScriptProvider>

      {status === "processing" && (
        <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, opacity: 0.85, lineHeight: 1.7 }}>
          Traitement du paiement…
        </div>
      )}
      {status === "error" && errorMessage && (
        <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "#ef4444", lineHeight: 1.7 }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
