"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { fonts, pageMaxWidth, theme } from "@/lib/uiStyles";
import type {
  OrderRecord,
  OrderReturnStatus,
  OrderStatus,
} from "@/lib/orderTypes";
import {
  MONDIAL_RELAY_HOME_ID,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";

type AdminOrderRecord = OrderRecord & {
  paymentStatus?: string;
  shipmentStatus?: string;
  refundedCents?: number;
  discountCents?: number;
  totalCents?: number;
  returnStatus?: OrderReturnStatus;
  returnUpdatedAt?: string | null;
  withdrawalRequestedAt?: string | null;
  refundEligible?: boolean;
  refundAttempt?: null | { idempotencyKey: string; amountCents: number; status: string };
  refundHistory?: Array<{ refundId: string; amountCents: number; status: string; reason: string; createdAt: string; completedAt: string | null }>;
  shipmentJobStatus?: string | null;
  shipmentJobError?: string | null;
  newsletterConsent?: null | {
    status: string; consentAt: string | null; confirmedAt: string | null;
    consentVersion: string | null; lastEvent: string | null; lastEventAt: string | null;
  };
};
type AdminItem = OrderRecord["items"][number] & {
  catalogName?: string; catalogImage?: string | null; catalogColor?: string | null;
};

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "En attente", label: "En attente" },
  { value: "En preparation", label: "En préparation" },
  { value: "Prete a expedier", label: "Prête à expédier" },
  { value: "Deposee chez Mondial Relay", label: "Déposée chez Mondial Relay" },
  { value: "En transit", label: "En transit" },
  { value: "Disponible en Point Relais", label: "Disponible en Point Relais" },
  { value: "Expediee", label: "Expédiée" },
  { value: "Livree", label: "Livrée" },
  { value: "Retournee", label: "Retournée" },
  { value: "Annulee", label: "Annulée" },
];

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  unfulfilled: "En attente d’expédition",
  "En attente": "En attente d’expédition",
  Payee: "En attente d’expédition",
  preparing: "En préparation",
  "En preparation": "En préparation",
  ready: "Prête à expédier",
  "Prete a expedier": "Prête à expédier",
  shipped: "Expédiée",
  Expediee: "Expédiée",
  delivered: "Livrée",
  Livree: "Livrée",
  returned: "Retournée",
  Retournee: "Retournée",
  cancelled: "Annulée",
  Annulee: "Annulée",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string>("");
  const [shipmentMessages, setShipmentMessages] = useState<
    Record<string, string>
  >({});
  const [productionShipmentReady, setProductionShipmentReady] =
    useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<
    "manual_connect" | "api2"
  >("manual_connect");
  const [manualConnectReady, setManualConnectReady] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [shipmentFilter, setShipmentFilter] = useState("");
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [refundMessages, setRefundMessages] = useState<Record<string, string>>({});
  const [refundKeys, setRefundKeys] = useState<Record<string, string>>({});
  const [selectedLabelOrderIds, setSelectedLabelOrderIds] = useState<string[]>([]);

  const returnLabels: Record<OrderReturnStatus, string> = {
    none: "Aucun retour",
    requested: "Retour demandé",
    accepted: "Retour accepté",
    awaiting_receipt: "En attente de réception",
    received: "Retour réceptionné",
    refund_in_progress: "Remboursement en cours",
    refunded: "Remboursé",
  };
  type ManualReturnStatus = Exclude<
    OrderReturnStatus,
    "none" | "refund_in_progress" | "refunded"
  >;
  const nextReturnStatus: Partial<
    Record<OrderReturnStatus, { value: ManualReturnStatus; label: string }>
  > = {
    none: { value: "requested", label: "Enregistrer la demande de retour" },
    requested: { value: "accepted", label: "Accepter le retour" },
    accepted: {
      value: "awaiting_receipt",
      label: "Confirmer l’attente du colis",
    },
    awaiting_receipt: {
      value: "received",
      label: "Confirmer la réception du retour",
    },
  };

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const extended = order as AdminOrderRecord;
    const term = search.trim().toLowerCase();
    return (!term || [order.orderId, order.customer.email, order.customer.firstName, order.customer.lastName, order.customer.phone]
      .some((value) => String(value || "").toLowerCase().includes(term))) &&
      (!paymentFilter || extended.paymentStatus === paymentFilter) &&
      (!shipmentFilter || extended.shipmentStatus === shipmentFilter);
  }), [orders, search, paymentFilter, shipmentFilter]);
  const hasOrders = visibleOrders.length > 0;

  useEffect(() => {
    let active = true;
    const initialSearch = new URLSearchParams(window.location.search).get("search") || "";
    setSearch(initialSearch);
    fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (active) setOrders(Array.isArray(d.orders) ? d.orders : []);
      })
      .catch(() => {
        if (active) setError("Impossible de charger les commandes admin.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/shipping-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chargement impossible.");
        if (active) {
          setProductionShipmentReady(
            data.readiness?.shipmentCreationEnabled === true,
          );
          setFulfillmentMode(
            data.settings?.fulfillmentMode === "api2"
              ? "api2"
              : "manual_connect",
          );
          setManualConnectReady(data.manualShippingReady === true);
        }
      })
      .catch(() => {
        if (active) setProductionShipmentReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateOrder = async (
    orderId: string,
    patch: {
      status?: OrderStatus;
      trackingNumber?: string;
      returnStatus?: ManualReturnStatus;
    },
  ) => {
    setPending(orderId);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        order?: OrderRecord;
        returnStatus?: OrderReturnStatus;
        error?: string;
      };
      if (!res.ok || !data.order)
        throw new Error(data.error || "Mise a jour impossible");

      setOrders((prev) =>
        prev.map((item) =>
          item.orderId === data.order?.orderId
            ? {
                ...item,
                ...data.order,
                ...(patch.returnStatus
                  ? { returnStatus: data.returnStatus || patch.returnStatus }
                  : {}),
              }
            : item,
        ),
      );
    } catch {
      setError("La mise a jour a echoue.");
    } finally {
      setPending("");
    }
  };

  const refreshOrders = async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!response.ok) throw new Error("Impossible de recharger les commandes.");
    const data = await response.json();
    setOrders(Array.isArray(data.orders) ? data.orders : []);
  };

  const submitRefund = async (
    order: AdminOrderRecord,
    retry?: AdminOrderRecord["refundAttempt"],
  ) => {
    const remaining = Math.max(0, (order.totalCents ?? Math.round(order.total * 100)) - (order.refundedCents || 0));
    const amountCents = retry?.amountCents ?? Math.round(Number((refundAmounts[order.orderId] ?? (remaining / 100).toFixed(2)).replace(",", ".")) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > remaining) {
      setRefundMessages((items) => ({ ...items, [order.orderId]: "Montant invalide ou supérieur au solde remboursable." }));
      return;
    }
    const reason = retry ? "Reprise idempotente du remboursement" : (refundReasons[order.orderId] || "").trim();
    if (!retry && reason.length < 3) {
      setRefundMessages((items) => ({ ...items, [order.orderId]: "Indiquez le motif du remboursement." }));
      return;
    }
    const idempotencyKey = retry?.idempotencyKey || refundKeys[order.orderId] || crypto.randomUUID();
    const confirmation = window.confirm(
      `CONFIRMATION PAYPAL LIVE\nRembourser ${(amountCents / 100).toFixed(2)} € sur la commande ${order.orderId} ?\nCette action appelle PayPal réellement et ne restocke aucun article.`,
    );
    if (!confirmation) return;
    setRefundKeys((items) => ({ ...items, [order.orderId]: idempotencyKey }));
    setPending(order.orderId);
    setRefundMessages((items) => ({ ...items, [order.orderId]: "Demande PayPal en cours…" }));
    try {
      const response = await fetch(`/api/admin/orders/${order.orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents, reason, confirmation: true, idempotencyKey,
        }),
      });
      const result = await response.json();
      if (!response.ok && response.status !== 202) {
        if (result.retrySameKey === false || response.status < 500)
          setRefundKeys((items) => { const next = { ...items }; delete next[order.orderId]; return next; });
        throw new Error(result.error || "Remboursement impossible.");
      }
      if (result.refund?.status === "completed") {
        setRefundMessages((items) => ({ ...items, [order.orderId]: `Remboursement confirmé : ${(amountCents / 100).toFixed(2)} €.` }));
        setRefundKeys((items) => { const next = { ...items }; delete next[order.orderId]; return next; });
        setRefundAmounts((items) => ({ ...items, [order.orderId]: (Math.max(0, remaining - amountCents) / 100).toFixed(2) }));
      } else {
        setRefundMessages((items) => ({ ...items, [order.orderId]: "PayPal traite encore l’opération. Utilisez « Vérifier le même remboursement »; ne créez pas une nouvelle demande." }));
      }
      await refreshOrders();
    } catch (refundError) {
      setRefundMessages((items) => ({
        ...items,
        [order.orderId]: refundError instanceof Error ? refundError.message : "Remboursement impossible.",
      }));
    } finally { setPending(""); }
  };

  const createShipment = async (orderId: string) => {
    if (
      !window.confirm(
        "Créer une expédition Mondial Relay réelle et une étiquette facturable pour cette commande ? Cette action est irréversible.",
      )
    )
      return;
    setPending(orderId);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/mondial-relay/create`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Création de l’expédition impossible.");
      setShipmentMessages((current) => ({
        ...current,
        [orderId]: "Expédition créée. L’étiquette est disponible.",
      }));
      await refreshOrders();
    } catch (shipmentError) {
      const message =
        shipmentError instanceof Error
          ? shipmentError.message
          : "Création de l’expédition impossible.";
      setShipmentMessages((current) => ({ ...current, [orderId]: message }));
    } finally {
      setPending("");
    }
  };

  const retrieveShipmentLabel = async (orderId: string) => {
    setPending(orderId);
    setShipmentMessages((current) => ({ ...current, [orderId]: "" }));
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/mondial-relay/create`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok)
        throw new Error(data.message || data.error || "Étiquette indisponible.");
      await refreshOrders();
      setShipmentMessages((current) => ({
        ...current,
        [orderId]: "L’étiquette officielle a été récupérée.",
      }));
    } catch (labelError) {
      setShipmentMessages((current) => ({
        ...current,
        [orderId]:
          labelError instanceof Error
            ? labelError.message
            : "Étiquette indisponible.",
      }));
    } finally {
      setPending("");
    }
  };

  const registerManualShipment = async (
    orderId: string,
    shipmentNumber: string,
  ) => {
    setPending(orderId);
    setShipmentMessages((current) => ({ ...current, [orderId]: "" }));
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/mondial-relay/manual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shipmentNumber }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Enregistrement de l’expédition impossible.");
      await refreshOrders();
      setShipmentMessages((current) => ({
        ...current,
        [orderId]:
          "Expédition Connect enregistrée. L’étiquette reste à télécharger et imprimer depuis Connect.",
      }));
    } catch (manualError) {
      setShipmentMessages((current) => ({
        ...current,
        [orderId]:
          manualError instanceof Error
            ? manualError.message
            : "Enregistrement de l’expédition impossible.",
      }));
    } finally {
      setPending("");
    }
  };

  const downloadSelectedLabels = async () => {
    if (selectedLabelOrderIds.length < 2 || selectedLabelOrderIds.length > 10) {
      setError("Sélectionnez entre 2 et 10 commandes avec une étiquette disponible.");
      return;
    }
    setPending("bulk-labels");
    setError("");
    try {
      const response = await fetch("/api/admin/orders/mondial-relay/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedLabelOrderIds }),
      });
      if (!response.ok)
        throw new Error("Impossible de télécharger les étiquettes sélectionnées.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Etiquettes-Maison-Miroir.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Impossible de télécharger les étiquettes sélectionnées.",
      );
    } finally {
      setPending("");
    }
  };

  const refreshTracking = async (orderId: string) => {
    setPending(orderId);
    setShipmentMessages((current) => ({ ...current, [orderId]: "" }));
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/mondial-relay/tracking`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Suivi Mondial Relay indisponible.");
      await refreshOrders();
      setShipmentMessages((current) => ({
        ...current,
        [orderId]: "Suivi mis à jour.",
      }));
    } catch (trackingError) {
      setShipmentMessages((current) => ({
        ...current,
        [orderId]:
          trackingError instanceof Error
            ? trackingError.message
            : "Suivi Mondial Relay indisponible.",
      }));
    } finally {
      setPending("");
    }
  };

  return (
    <div
      style={{ paddingTop: 88, minHeight: "100vh", background: theme.marble }}
    >
      <div
        style={{
          maxWidth: pageMaxWidth,
          margin: "0 auto",
          padding: "40px 24px 72px",
        }}
      >
        <h1
          style={{
            fontFamily: fonts.display,
            fontSize: "clamp(2rem, 4vw, 2.6rem)",
            fontWeight: 300,
            color: theme.textDark,
            marginBottom: 8,
          }}
        >
          Admin commandes
        </h1>
        <a href="/77774555474447777554555" style={{ color: theme.goldDark }}>
          Administration de la newsletter →
        </a>
        <p
          style={{
            margin: "0 0 24px",
            fontFamily: fonts.body,
            color: theme.textMid,
            letterSpacing: "0.04em",
          }}
        >
          Suivi des commandes, statut et numero de suivi.
        </p>

        {loading && (
          <p style={{ fontFamily: fonts.body, color: theme.textMid }}>
            Chargement...
          </p>
        )}
        {error && (
          <p style={{ color: "#dc2626", fontFamily: fonts.body }}>{error}</p>
        )}

        <form className="admin-actions" onSubmit={(event) => event.preventDefault()} style={{ marginBottom: 18 }}>
          <label style={{ flex: "1 1 240px" }}>Recherche commande, nom, email ou téléphone
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label style={{ flex: "0 1 190px" }}>Paiement
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="">Tous</option><option value="pending">En attente</option><option value="paid">Payé</option>
              <option value="failed">Échoué</option><option value="cancelled">Annulé</option><option value="refunded">Remboursé</option><option value="partially_refunded">Partiellement remboursé</option>
            </select>
          </label>
          <label style={{ flex: "0 1 190px" }}>Expédition
            <select value={shipmentFilter} onChange={(event) => setShipmentFilter(event.target.value)}>
              <option value="">Toutes</option><option value="unfulfilled">Non préparée</option><option value="preparing">En préparation</option>
              <option value="ready">Prête</option><option value="shipped">Expédiée</option><option value="delivered">Livrée</option><option value="returned">Retournée</option><option value="cancelled">Annulée</option>
            </select>
          </label>
          <a className="admin-button" href={`/api/admin/orders/export?${new URLSearchParams({ search, payment: paymentFilter, shipment: shipmentFilter })}`}>Exporter CSV</a>
        </form>
        <div className="admin-actions" style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => void downloadSelectedLabels()}
            disabled={
              pending === "bulk-labels" ||
              selectedLabelOrderIds.length < 2 ||
              selectedLabelOrderIds.length > 10
            }
          >
            {pending === "bulk-labels"
              ? "Préparation du PDF…"
              : "Télécharger les étiquettes sélectionnées"}
          </button>
          <span className="admin-muted">
            {selectedLabelOrderIds.length} commande(s) sélectionnée(s)
          </span>
        </div>

        {!loading && !hasOrders && (
          <div
            style={{
              background: "white",
              border: `1px solid ${theme.creamDark}`,
              padding: 20,
              fontFamily: fonts.body,
              color: theme.textMid,
            }}
          >
            Aucune commande pour le moment.
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {visibleOrders.map((order) => {
            const currentReturnStatus = order.returnStatus || "none";
            const nextReturn = nextReturnStatus[currentReturnStatus];
            return (
            <div
              key={order.orderId}
              style={{
                background: "white",
                border: `1px solid ${theme.creamDark}`,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: fonts.body,
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: theme.gold,
                    }}
                  >
                    Commande #{order.orderId}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontFamily: fonts.body,
                      color: theme.textMid,
                      fontSize: 12,
                    }}
                  >
                    {new Date(order.orderDate).toLocaleString("fr-FR")}
                  </p>
                  {order.preparationDeadline && (
                    <p
                      className={
                        order.preparationDeadline <
                          new Date().toLocaleDateString("en-CA", {
                            timeZone: "Europe/Paris",
                          }) &&
                        !["Expediee", "Livree", "Annulee"].includes(order.status)
                          ? "admin-error"
                          : "admin-muted"
                      }
                      role="status"
                    >
                      À préparer avant le{" "}
                      {new Date(
                        `${order.preparationDeadline}T12:00:00+01:00`,
                      ).toLocaleDateString("fr-FR")}
                      {order.preparationDeadline <
                        new Date().toLocaleDateString("en-CA", {
                          timeZone: "Europe/Paris",
                        }) &&
                      !["Expediee", "Livree", "Annulee"].includes(order.status)
                        ? " - Délai dépassé"
                        : ""}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: fonts.body,
                    color: theme.textDark,
                    fontSize: 13,
                  }}
                >
                  Total: {order.total.toFixed(2)} EUR
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    color: theme.textMid,
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong style={{ color: theme.textDark }}>Client:</strong>{" "}
                    {order.customer.firstName} {order.customer.lastName}
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>Email:</strong>{" "}
                    {order.customer.email}
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Telephone:
                    </strong>{" "}
                    {order.customer.phone}
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>Adresse client (checkout):</strong>{" "}
                    {order.customer.street}, {order.customer.zip}{" "}
                    {order.customer.city}, {order.customer.country || "France"}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    color: theme.textMid,
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Mode de livraison:
                    </strong>{" "}
                    {order.shipping.label}
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Prix livraison:
                    </strong>{" "}
                    {order.shipping.price.toFixed(2)} EUR
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Delai estime:
                    </strong>{" "}
                    {order.shipping.estimatedDelay}
                  </div>
                  {order.shipping.relayPoint && (
                    <div>
                      <strong style={{ color: theme.textDark }}>
                        Point Relais (adresse de livraison):
                      </strong>{" "}
                      {order.shipping.relayPoint.id} -{" "}
                      {order.shipping.relayPoint.label},{" "}
                      {order.shipping.relayPoint.address.join(", ")},{" "}
                      {order.shipping.relayPoint.postalCode}{" "}
                      {order.shipping.relayPoint.city}
                    </div>
                  )}
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Sous-total:
                    </strong>{" "}
                    {order.subtotal.toFixed(2)} EUR
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>
                      Statut de paiement:
                    </strong>{" "}
                    {(order as OrderRecord & { paymentStatus?: string }).paymentStatus || (order.status === "Payee" ? "paid" : "pending")}
                  </div>
                  <div>
                    <strong style={{ color: theme.textDark }}>Statut d’expédition:</strong>{" "}
                    {order.paymentStatus === "refunded"
                      ? "Remboursée"
                      : SHIPMENT_STATUS_LABELS[
                          (order as AdminOrderRecord).shipmentStatus || ""
                        ] || order.status}
                  </div>
                  {order.legalAcceptance && (
                    <div>
                      <strong style={{ color: theme.textDark }}>
                        Acceptation des CGV:
                      </strong>{" "}
                      version {order.legalAcceptance.version}, le{" "}
                      {new Date(
                        order.legalAcceptance.acceptedAt,
                      ).toLocaleString("fr-FR")}
                    </div>
                  )}
                  <div>
                    <strong style={{ color: theme.textDark }}>Réduction / remboursé:</strong>{" "}
                    {(((order as OrderRecord & { discountCents?: number }).discountCents || 0) / 100).toFixed(2)} € / {(((order as OrderRecord & { refundedCents?: number }).refundedCents || 0) / 100).toFixed(2)} €
                  </div>
                </div>
              </div>

              <section className="admin-card" style={{ marginBottom: 14, padding: 14 }}>
                <h3>Articles de la commande</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {order.items.map((rawItem, index) => {
                    const item = rawItem as AdminItem;
                    return <div key={`${item.id}-${index}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {item.catalogImage && <Image src={item.catalogImage} alt={item.catalogName || item.name} width={64} height={64} style={{ objectFit: "cover", borderRadius: 4 }} />}
                      <div><strong>{item.catalogName || item.name}</strong>
                        {item.catalogColor && <span> · Couleur : {item.catalogColor}</span>}
                        <div>Quantité : {item.quantity} · Prix unitaire : {item.unitPrice.toFixed(2)} €</div>
                      </div>
                    </div>;
                  })}
                </div>
                <div style={{ marginTop: 12 }}>
                  <strong>Consentement newsletter déjà enregistré :</strong>{" "}
                  {order.newsletterConsent
                    ? `${order.newsletterConsent.status}${order.newsletterConsent.lastEvent ? ` · dernier événement : ${order.newsletterConsent.lastEvent}` : ""}${order.newsletterConsent.consentAt ? ` · consentement ${new Date(order.newsletterConsent.consentAt).toLocaleDateString("fr-FR")}` : ""}`
                    : "aucun enregistrement trouvé; aucun abonnement n’a été créé."}
                </div>
              </section>

              <section className="admin-card" style={{ marginBottom: 14, padding: 14 }}>
                <h3>Retour et remboursement</h3>
                {order.withdrawalRequestedAt && (
                  <p role="status" className="admin-success">
                    Demande de rétractation en ligne reçue le{" "}
                    {new Date(order.withdrawalRequestedAt).toLocaleString("fr-FR")}.
                  </p>
                )}
                <p className="admin-muted">
                  Statut : {returnLabels[currentReturnStatus]}
                  {order.returnUpdatedAt
                    ? ` - mis à jour le ${new Date(order.returnUpdatedAt).toLocaleString("fr-FR")}`
                    : ""}
                </p>
                <p className="admin-muted">
                  Vérifiez l’état du colis reçu avant de modifier le stock dans
                  l’onglet Stocks. Le retour ne déclenche aucun remboursement
                  automatique.
                </p>
                {nextReturn && (
                  <button
                    type="button"
                    disabled={pending === order.orderId}
                    onClick={() =>
                      updateOrder(order.orderId, {
                        returnStatus: nextReturn.value,
                      })
                    }
                  >
                    {nextReturn.label}
                  </button>
                )}
              </section>

              <section className="admin-card" style={{ marginBottom: 14, padding: 14 }}>
                <h3>Remboursement PayPal Live</h3>
                <p className="admin-muted">Le remboursement ne modifie pas le stock. Un retour confirmé doit être enregistré séparément avant toute remise en stock.</p>
                {order.refundAttempt ? (
                  <div className="admin-actions">
                    <span>Remboursement {order.refundAttempt.status} · {(order.refundAttempt.amountCents / 100).toFixed(2)} €</span>
                    <button type="button" disabled={pending === order.orderId} onClick={() => void submitRefund(order, order.refundAttempt)}>
                      {pending === order.orderId ? "Vérification…" : "Vérifier le même remboursement"}
                    </button>
                  </div>
                ) : order.refundEligible && currentReturnStatus === "received" ? (
                  <div className="admin-form-grid">
                    <label>Montant (€), maximum {(Math.max(0, (order.totalCents ?? Math.round(order.total * 100)) - (order.refundedCents || 0)) / 100).toFixed(2)}
                      <input type="number" min="0.01" step="0.01" max={(Math.max(0, (order.totalCents ?? Math.round(order.total * 100)) - (order.refundedCents || 0)) / 100).toFixed(2)}
                        value={refundAmounts[order.orderId] ?? (Math.max(0, (order.totalCents ?? Math.round(order.total * 100)) - (order.refundedCents || 0)) / 100).toFixed(2)}
                        disabled={Boolean(refundKeys[order.orderId])}
                        onChange={(event) => setRefundAmounts((items) => ({ ...items, [order.orderId]: event.target.value }))} />
                    </label>
                    <label>Motif requis
                      <input maxLength={240} value={refundReasons[order.orderId] || ""} disabled={Boolean(refundKeys[order.orderId])} onChange={(event) => setRefundReasons((items) => ({ ...items, [order.orderId]: event.target.value }))} />
                    </label>
                    <button type="button" disabled={pending === order.orderId} onClick={() => void submitRefund(order)}>
                      {pending === order.orderId ? "Remboursement…" : refundKeys[order.orderId] ? "Réessayer la même demande" : "Rembourser via PayPal"}
                    </button>
                  </div>
                ) : order.refundEligible ? (
                  <p>Le remboursement manuel sera disponible après réception du colis retourné.</p>
                ) : <p>Aucun solde actuellement remboursable ou capture PayPal vérifiée manquante.</p>}
                {!!order.refundHistory?.length && <ul aria-label="Historique des remboursements">
                  {order.refundHistory.map((refund) => <li key={refund.refundId}>
                    {refund.status} · {(refund.amountCents / 100).toFixed(2)} € · {refund.reason} · {new Date(refund.createdAt).toLocaleString("fr-FR")}
                  </li>)}
                </ul>}
                {refundMessages[order.orderId] && <p role="status">{refundMessages[order.orderId]}</p>}
              </section>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: fonts.body,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: theme.textMid,
                      marginBottom: 6,
                    }}
                  >
                    Changer statut
                  </label>
                  <select
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      border: `1px solid ${theme.creamDark}`,
                      background: "#fff",
                    }}
                    value={STATUS_OPTIONS.some((option) => option.value === order.status) ? order.status : ""}
                    onChange={(e) =>
                      updateOrder(order.orderId, {
                        status: e.target.value as OrderStatus,
                      })
                    }
                    disabled={pending === order.orderId}
                  >
                    {order.status === "Payee" && <option value="" disabled>Choisir une étape d’expédition</option>}
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <TrackingEditor
                  key={order.orderId + ":" + (order.trackingNumber || "")}
                  order={order}
                  pending={pending === order.orderId}
                  onSave={(trackingNumber) =>
                    updateOrder(order.orderId, { trackingNumber })
                  }
                />
              </div>
              {((order.shipping.id === MONDIAL_RELAY_POINT_RELAIS_ID &&
                order.shipping.relayPoint) ||
                order.shipping.id === MONDIAL_RELAY_HOME_ID) && (
                  <section
                    className="admin-card"
                    style={{ marginTop: 16, padding: 16 }}
                  >
                    <h3>Expédition Mondial Relay</h3>
                    <p className="admin-muted">
                      La création contacte l’API2 de production et peut facturer
                      une étiquette. Vérifiez la commande et l’adresse avant de
                      confirmer.
                    </p>
                    {order.shipping.mondialRelayShipment?.shipmentNumber ? (
                      <div>
                        <p role="status">
                          Numéro d’expédition :{" "}
                          {order.shipping.mondialRelayShipment.shipmentNumber}
                        </p>
                        {order.shipping.mondialRelayShipment.labelAvailable && (
                          <div className="admin-actions">
                            <label>
                              <input
                                type="checkbox"
                                checked={selectedLabelOrderIds.includes(order.orderId)}
                                onChange={(event) =>
                                  setSelectedLabelOrderIds((current) =>
                                    event.target.checked
                                      ? [...current, order.orderId]
                                      : current.filter((id) => id !== order.orderId),
                                  )
                                }
                              />
                              Inclure dans le PDF groupé
                            </label>
                            <a
                              href={`/api/admin/orders/${order.orderId}/mondial-relay/label`}
                            >
                              Télécharger l’étiquette PDF
                            </a>
                            <a
                              href={`/api/admin/orders/${order.orderId}/mondial-relay/label?print=1`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Imprimer l’étiquette
                            </a>
                          </div>
                        )}
                        {order.shipping.mondialRelayShipment.source ===
                          "connect_manual" && (
                          <p className="admin-muted">
                            Étiquette créée dans Mondial Relay Connect. Elle
                            n’est pas stockée dans cette administration.
                          </p>
                        )}
                        {!order.shipping.mondialRelayShipment.labelAvailable &&
                          order.shipping.mondialRelayShipment.source !==
                            "connect_manual" && (
                          <button
                            type="button"
                            onClick={() => void retrieveShipmentLabel(order.orderId)}
                            disabled={pending === order.orderId}
                          >
                            {pending === order.orderId
                              ? "Récupération…"
                              : "Récupérer l’étiquette officielle"}
                          </button>
                        )}
                        {order.paymentStatus === "paid" && (
                          <p>
                            <a
                              href={`/api/admin/orders/${order.orderId}/preparation-sheet`}
                            >
                              Télécharger la fiche de préparation PDF
                            </a>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => refreshTracking(order.orderId)}
                          disabled={pending === order.orderId}
                          style={{ marginLeft: 12 }}
                        >
                          {pending === order.orderId
                            ? "Recherche du suivi…"
                            : "Actualiser le suivi"}
                        </button>
                        {order.shipping.mondialRelayShipment.trackingSummary && (
                          <p>
                            Suivi :{" "}
                            {order.shipping.mondialRelayShipment.trackingSummary}
                          </p>
                        )}
                        {order.shipping.mondialRelayShipment.trackingEvents?.map(
                          (event, index) => (
                            <p key={`${event.date}-${event.time}-${index}`}>
                              {event.date} {event.time} - {event.label}
                              {event.location ? ` (${event.location})` : ""}
                            </p>
                          ),
                        )}
                      </div>
                    ) : fulfillmentMode === "manual_connect" ? (
                      manualConnectReady && order.paymentStatus === "paid" ? (
                        <>
                          <p className="admin-muted">
                            Créez et payez l’étiquette dans Connect, puis
                            enregistrez son numéro ici. Cette étape n’appelle
                            pas l’API2 et ne crée pas une seconde étiquette.
                          </p>
                          <ManualShipmentEditor
                            orderId={order.orderId}
                            pending={pending === order.orderId}
                            onSave={(shipmentNumber) =>
                              registerManualShipment(
                                order.orderId,
                                shipmentNumber,
                              )
                            }
                          />
                        </>
                      ) : (
                        <p className="admin-error" role="status">
                          {order.paymentStatus !== "paid"
                            ? "Le paiement doit être confirmé avant d’enregistrer une expédition."
                            : "Le mode manuel est sélectionné, mais l’accès à Connect n’a pas été confirmé dans les paramètres de livraison."}
                        </p>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => createShipment(order.orderId)}
                        disabled={
                          pending === order.orderId ||
                          !productionShipmentReady ||
                          Boolean(
                            order.shipping.mondialRelayShipment?.status &&
                              order.shipping.mondialRelayShipment.status !== "failed",
                          ) ||
                          ["processing", "unknown", "completed"].includes(
                            order.shipmentJobStatus || "",
                          )
                        }
                      >
                        {pending === order.orderId
                          ? "Création de l’expédition…"
                          : order.shipping.mondialRelayShipment?.status ===
                              "unknown"
                            ? "Vérification manuelle requise"
                            : order.shipping.mondialRelayShipment?.status ===
                                "failed" || order.shipmentJobStatus === "failed"
                              ? "Relancer la génération"
                              : "Créer l’expédition réelle"}
                      </button>
                    )}
                    {["queued", "processing"].includes(
                      order.shipmentJobStatus || "",
                    ) && (
                      <p role="status">
                        Étiquette en cours de génération après confirmation du paiement.
                      </p>
                    )}
                    {order.shipmentJobStatus === "completed" &&
                      !order.shipping.mondialRelayShipment?.labelAvailable && (
                        <p role="status">
                          Expédition créée. L’étiquette officielle sera disponible dès son téléchargement depuis Mondial Relay.
                        </p>
                      )}
                    {order.shipmentJobStatus === "failed" && (
                      <p className="admin-error" role="alert">
                        {order.shipping.mondialRelayShipment?.status === "created"
                          ? "L’expédition est créée, mais le téléchargement de l’étiquette a échoué. Réessayez de la récupérer."
                          : "La génération a échoué sans confirmation de création."}
                        {order.shipmentJobError
                          ? ` Détail : ${order.shipmentJobError}.`
                          : ""}
                      </p>
                    )}
                    {order.shipmentJobStatus === "unknown" &&
                      order.shipping.mondialRelayShipment?.status !==
                        "created" && (
                        <p className="admin-error" role="alert">
                          Le résultat de création est incertain. Vérifiez le compte Mondial Relay avant toute nouvelle tentative.
                        </p>
                      )}
                    {!productionShipmentReady &&
                      fulfillmentMode === "api2" &&
                      !order.shipping.mondialRelayShipment && (
                        <p className="admin-muted" role="status">
                          La configuration de production n’est pas encore prête.
                        </p>
                      )}
                    {order.shipping.mondialRelayShipment?.status ===
                      "unknown" && (
                      <p className="admin-error" role="alert">
                        L’état de création est incertain. Vérifiez-le dans
                        Mondial Relay avant toute action. Le système bloque un
                        nouvel envoi pour éviter un doublon.
                      </p>
                    )}
                    {shipmentMessages[order.orderId] && (
                      <p className="admin-muted" role="status">
                        {shipmentMessages[order.orderId]}
                      </p>
                    )}
                  </section>
                )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrackingEditor({
  order,
  pending,
  onSave,
}: {
  order: OrderRecord;
  pending: boolean;
  onSave: (tracking: string) => void;
}) {
  const [tracking, setTracking] = useState(order.trackingNumber || "");

  return (
    <div>
      <label
        style={{
          display: "block",
          fontFamily: fonts.body,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.textMid,
          marginBottom: 6,
        }}
      >
        Numero de suivi
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Ex: 8X12345678901"
          style={{
            flex: 1,
            padding: "11px 12px",
            border: `1px solid ${theme.creamDark}`,
          }}
          disabled={pending}
        />
        <button
          onClick={() => onSave(tracking)}
          disabled={pending || tracking.trim().length < 4}
          style={{
            border: `1px solid ${theme.gold}`,
            color: pending ? "#8f8f8f" : theme.goldDark,
            background: "white",
            padding: "11px 14px",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          Enregistrer
        </button>
      </div>
      {order.trackingUrl && (
        <a
          href={order.trackingUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: fonts.body,
            fontSize: 12,
            color: theme.goldDark,
            marginTop: 8,
            display: "inline-block",
          }}
        >
          Ouvrir le lien de suivi
        </a>
      )}
    </div>
  );
}

function ManualShipmentEditor({
  orderId,
  pending,
  onSave,
}: {
  orderId: string;
  pending: boolean;
  onSave: (shipmentNumber: string) => void;
}) {
  const [shipmentNumber, setShipmentNumber] = useState("");

  return (
    <div>
      <p>
        <a
          href="https://connect.mondialrelay.com"
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir Mondial Relay Connect
        </a>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(shipmentNumber.trim());
        }}
      >
        <label>
          Numéro de l’expédition créée dans Connect
          <input
            value={shipmentNumber}
            onChange={(event) => setShipmentNumber(event.target.value)}
            autoComplete="off"
            maxLength={40}
            required
            pattern="[A-Za-z0-9-]{4,40}"
            disabled={pending}
          />
        </label>
        <button
          type="submit"
          disabled={pending || shipmentNumber.trim().length < 4}
        >
          {pending ? "Enregistrement…" : "Enregistrer l’expédition Connect"}
        </button>
      </form>
      <p className="admin-muted">
        Commande {orderId}. Le statut reste « Prête à expédier » jusqu’à son
        dépôt effectif chez Mondial Relay.
      </p>
    </div>
  );
}
