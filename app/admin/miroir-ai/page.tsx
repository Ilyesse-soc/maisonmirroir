"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Message = { role: "user" | "assistant"; text: string; draftId?: string };
type ProviderHealth = {
  configured: boolean;
  verified: boolean;
  available: boolean;
  model: string | null;
  status:
    | "unconfigured"
    | "checking"
    | "available"
    | "credentials_invalid"
    | "model_unavailable"
    | "unavailable"
    | "circuit_open";
  circuitOpen: boolean;
};
type AiStatus = {
  enabled: boolean;
  provider: "gemini" | "groq" | null;
  model: string | null;
  fallbackEnabled: boolean;
  providers: { gemini: ProviderHealth; groq: ProviderHealth };
};

function healthLabel(name: string, health?: ProviderHealth) {
  if (!health || !health.configured) return `${name} : non configuré`;
  if (health.circuitOpen && health.status === "available")
    return `${name} : temporairement suspendu après des échecs récents`;
  switch (health.status) {
    case "available":
      return `${name} : modèle ${health.model} vérifié`;
    case "circuit_open":
      return `${name} : temporairement suspendu après des échecs récents`;
    case "credentials_invalid":
      return `${name} : clé ou autorisations invalides`;
    case "model_unavailable":
      return `${name} : modèle configuré introuvable ou inaccessible`;
    default:
      return `${name} : vérification indisponible`;
  }
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function MiroirAiPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/miroir-ai", { cache: "no-store" })
      .then(async (response) => {
        const data = await responseJson(response);
        if (!response.ok) throw new Error(data?.error || "État IA indisponible.");
        if (!data) throw new Error("Le service a renvoyé un état illisible.");
        if (active) setStatus(data);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "État IA indisponible.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event?: FormEvent<HTMLFormElement>, prompt = input) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !status?.enabled) return;
    setMessages((items) => [...items, { role: "user", text }]);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/miroir-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        const timeoutMessage =
          response.status === 504
            ? "Miroir AI met trop de temps à répondre. Réessayez dans quelques instants."
            : "Miroir AI est momentanément indisponible. Réessayez.";
        throw new Error(data?.error || timeoutMessage);
      }
      if (!data || typeof data.reply !== "string")
        throw new Error("Miroir AI a renvoyé une réponse illisible. Réessayez.");
      setMessages((items) => [...items, {
        role: "assistant",
        text: `${data.reply}${data.fallbackUsed ? "\n\nGemini indisponible : réponse fournie par Groq." : ""}${data.createdDraft ? "\n\nBrouillon créé - aucune campagne envoyée ni programmée." : ""}`,
        draftId: data.draftId,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Miroir AI n’a pas pu répondre.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-page">
      <header className="miroir-ai-intro">
        <Image
          className="miroir-ai-avatar"
          src="/images/miroir-ai-avatar.png"
          alt="Avatar de Miroir AI"
          width={104}
          height={104}
          priority
        />
        <div>
          <h1>Miroir AI</h1>
          <p className="admin-muted">Assistante marketing MAISON MIROIR - elle peut préparer des brouillons avec les produits du catalogue. Vous gardez la main sur leur vérification et leur validation, aucun envoi ni programmation n’est automatique.</p>
        </div>
      </header>
      <section className="admin-card">
        {!status ? (
          <p role="status">Vérification des fournisseurs IA…</p>
        ) : (
          <>
            <p role="status">{healthLabel("Gemini", status.providers?.gemini)}</p>
            <p role="status">{healthLabel("Groq", status.providers?.groq)}</p>
            <p className="admin-muted">
              {status.provider === "gemini"
                ? `Gemini est le fournisseur principal${status.fallbackEnabled ? " ; Groq est également vérifié et prêt à prendre le relais." : "."}`
                : status.provider === "groq"
                  ? "Gemini n’est pas disponible actuellement ; Groq est vérifié et utilisé automatiquement."
                  : status.enabled
                    ? "Aucun fournisseur n’est vérifié pour le moment. Vous pouvez réessayer ; les clés ne sont jamais affichées."
                    : "Aucune clé fournisseur n’est configurée. L’assistant est désactivé."}
            </p>
          </>
        )}
        <p className="admin-muted">Les requêtes sont limitées. Miroir AI reçoit des statistiques agrégées et, pour les brouillons, des informations sur les produits publics. Aucune donnée personnelle n’est transmise ; n’incluez pas d’adresse e-mail ni de secret.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-chat" ref={chatRef} aria-live="polite">
          {!messages.length && <p className="admin-muted">Vous pourrez demander des idées de campagne, des objets d’e-mail ou des statistiques agrégées.</p>}
          {messages.map((message, index) => (
            <div className="admin-chat-row" data-role={message.role} key={`${message.role}-${index}`}>
              {message.role === "assistant" && (
                <Image
                  className="miroir-ai-chat-avatar"
                  src="/images/miroir-ai-avatar.png"
                  alt=""
                  width={36}
                  height={36}
                />
              )}
              <div className="admin-chat-message" data-role={message.role}>
                {message.text}
                {message.draftId && (
                  <p>
                    <a className="admin-button" href={`/admin/newsletter?draft=${encodeURIComponent(message.draftId)}`}>
                      Relire et modifier le brouillon
                    </a>
                  </p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="admin-chat-row" data-role="assistant">
              <Image
                className="miroir-ai-chat-avatar"
                src="/images/miroir-ai-avatar.png"
                alt=""
                width={36}
                height={36}
              />
              <p role="status">Miroir AI réfléchit…</p>
            </div>
          )}
        </div>
        <div className="admin-actions" style={{ margin: "12px 0" }}>
          {[
            "Propose-moi trois objets d’email élégants.",
            "Combien de nouvelles abonnées avons-nous cette semaine ?",
            "Prépare une campagne de lancement pour notre collection.",
            "Crée un brouillon de campagne Modest Era et sélectionne le produit.",
            "Prépare une campagne avec Paradise Way en précisant que les commandes ne sont pas encore ouvertes.",
            "Rédige une newsletter professionnelle.",
            "Crée un brouillon de campagne marketing.",
          ].map((prompt) => <button key={prompt} disabled={!status?.enabled || busy} type="button" onClick={() => void send(undefined, prompt)}>{prompt}</button>)}
        </div>
        <form className="admin-actions" onSubmit={(event) => void send(event)}>
          <label style={{ flex: 1, minWidth: 250 }}>Votre demande
            <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} rows={3} disabled={!status?.enabled || busy} />
          </label>
          <button disabled={!status?.enabled || busy || !input.trim()}>{busy ? "Envoi…" : "Envoyer"}</button>
        </form>
      </section>
    </main>
  );
}
