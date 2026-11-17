"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Message = { role: "user" | "assistant"; text: string };
type AiStatus = {
  enabled: boolean;
  provider: "gemini" | "groq" | null;
  model: string | null;
  fallbackEnabled: boolean;
};

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
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "État IA indisponible.");
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Miroir AI n’a pas pu répondre.");
      setMessages((items) => [...items, {
        role: "assistant",
        text: `${data.reply}${data.fallbackUsed ? "\n\nGemini indisponible : réponse fournie par Groq." : ""}${data.createdDraft ? "\n\nBrouillon créé — aucune campagne envoyée ni programmée." : ""}`,
      }]);
      if (data.draftId) setMessages((items) => [...items, {
        role: "assistant",
        text: "Le brouillon est disponible dans la page Campagnes.",
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
          <p className="admin-muted">Assistante marketing Maison Miroir — elle peut proposer et créer des brouillons, jamais envoyer ou programmer une campagne.</p>
        </div>
      </header>
      <section className="admin-card">
        <p role="status">
          {status?.enabled
            ? `${status.provider === "gemini" ? "Gemini" : "Groq"} actif : ${status.model}${status.fallbackEnabled ? " — Groq est prêt à prendre le relais automatiquement." : status.provider === "gemini" ? " — le relais Groq n’est pas configuré." : ""}`
            : status ? "Aucune clé Gemini ou Groq n’est configurée. L’assistant est désactivé." : "Vérification de la configuration…"}
        </p>
        <p className="admin-muted">Les requêtes sont limitées. Seules des statistiques agrégées lui sont transmises ; n’incluez aucune donnée personnelle, adresse e-mail ni secret.</p>
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
              <div className="admin-chat-message" data-role={message.role}>{message.text}</div>
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
