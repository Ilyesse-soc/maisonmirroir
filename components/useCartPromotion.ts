"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";

async function validate(code: string, signature: string, signal?: AbortSignal) {
  const response = await fetch("/api/promotions/validate", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal,
    body: JSON.stringify({ code, items: (JSON.parse(signature) as { id: string; quantity: number }[]).map(({ id, quantity }) => ({ id, quantity })) }),
  });
  const data = await response.json();
  if (!response.ok || typeof data.code !== "string" || !Number.isInteger(data.discountCents) || data.discountCents < 0)
    throw new Error(data.message || "La vérification de ce code promotionnel a échoué.");
  return { code: String(data.code), discountCents: Number(data.discountCents) };
}

export function useCartPromotion(quoteItems?: { productId: string; quantity: number; unitPrice: number }[]) {
  const { items: cartItems, promotionCode, setPromotionCode } = useCart();
  const items = quoteItems ?? cartItems;
  const [draft, setDraft] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState({ key: "", discountCents: 0, valid: false });
  const signature = JSON.stringify(items.map(item => ({ id: item.productId, quantity: item.quantity, price: item.unitPrice })));
  const key = promotionCode + ":" + signature;

  useEffect(() => {
    if (!promotionCode || !items.length) return;
    const controller = new AbortController();
    void validate(promotionCode, signature, controller.signal).then(data => {
      if (!controller.signal.aborted) setVerified({ key, discountCents: data.discountCents, valid: true });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setVerified({ key, discountCents: 0, valid: false });
      setNotice(error instanceof Error ? error.message : "Code non vérifié.");
    });
    return () => controller.abort();
  }, [promotionCode, signature, key, items.length]);

  async function applyPromotion() {
    const input = (draft ?? promotionCode).trim();
    if (!input || applying) return;
    setApplying(true);
    setNotice("");
    try {
      const data = await validate(input, signature);
      setVerified({ key: data.code + ":" + signature, discountCents: data.discountCents, valid: true });
      setPromotionCode(data.code);
      setDraft(data.code);
      setNotice("Code promotionnel appliqué aux produits uniquement.");
    } catch (error) {
      setPromotionCode("");
      setNotice(error instanceof Error ? error.message : "Code non vérifié.");
    } finally { setApplying(false); }
  }

  return {
    promotionInput: draft ?? promotionCode,
    setPromotionInput(value: string) { setDraft(value); setNotice(""); setPromotionCode(""); },
    applyPromotion,
    promotionBusy: applying || Boolean(promotionCode && verified.key !== key),
    promotionMessage: notice,
    currentPromotionCode: verified.key === key && verified.valid ? promotionCode : "",
    currentPromotionDiscount: verified.key === key && verified.valid ? verified.discountCents : 0,
  };
}
