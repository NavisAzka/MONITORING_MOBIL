"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatWibTime } from "@/lib/driverMonitoring";

type Message = { id: string; senderId: string; senderName: string; senderRole: "admin" | "driver"; text: string; createdAt: number };

export default function ChatPanel({ driverId, currentUserId, isAdmin, driverName, showHeader = true, showEmptyState = true }: { driverId: string; currentUserId: string; isAdmin: boolean; driverName: string; showHeader?: boolean; showEmptyState?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const query = isAdmin ? `?driverId=${encodeURIComponent(driverId)}` : "";
    const response = await fetch(`/api/messages${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Pesan tidak dapat dimuat.");
    setMessages(result.messages);
  }, [driverId, isAdmin]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { await refresh(); if (alive) setError(""); }
      catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : "Pesan tidak dapat dimuat."); }
      finally { if (alive) setLoading(false); }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => { void load(); }, 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(isAdmin ? { driverId } : {}), text: message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pesan gagal dikirim.");
      setText("");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesan gagal dikirim."); }
    finally { setSending(false); }
  }

  return <section className="chat-card">
    {showHeader && <header className="chat-header"><div className="chat-avatar">{driverName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div><h2>{isAdmin ? `Chat dengan ${driverName}` : "Pesan dari admin"}</h2><p>{isAdmin ? "Percakapan langsung dengan sopir" : "Balas pesan untuk berkomunikasi dengan admin"}</p></div><span className="chat-live"><i/>Aktif</span></header>}
    <div className="chat-messages" aria-live="polite">
      {showEmptyState && loading && messages.length === 0 ? <p className="chat-empty">Memuat percakapan…</p> : showEmptyState && messages.length === 0 ? <p className="chat-empty">Belum ada pesan. Mulai percakapan di sini.</p> : messages.map((message) => {
        const mine = message.senderId === currentUserId;
        return <article key={message.id} className={`chat-message ${mine ? "chat-message-mine" : ""}`}><span className="chat-sender">{mine ? "Anda" : message.senderName}</span><p>{message.text}</p><time>{`${formatWibTime(message.createdAt)} WIB`}</time></article>;
      })}
      <div ref={endRef}/>
    </div>
    {error && <div className="chat-error">{error}</div>}
    <form className="chat-compose" onSubmit={send}><textarea aria-label="Tulis pesan" rows={2} maxLength={2000} placeholder="Tulis pesan…" value={text} onChange={(event) => setText(event.target.value)}/><button type="submit" disabled={!text.trim() || sending}>{sending ? "Mengirim…" : "Kirim"}<span aria-hidden="true">➤</span></button></form>
  </section>;
}
