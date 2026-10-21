"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import type { SessionUser } from "@/lib/types";

export default function MessagesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (!result.user) window.location.assign("/");
      else setUser(result.user);
    }).catch(() => window.location.assign("/")).finally(() => setLoading(false));
  }, []);

  if (loading || !user) return <div className="profile-loading">Menyiapkan pesan…</div>;
  return <main className="profile-page"><header className="profile-header"><Link href="/login" className="profile-back">← Kembali ke dashboard</Link><span>ITS Buggy Car · PESAN</span></header><section className="messages-content">
    {user.role === "driver" ? <ChatPanel driverId={user.id} currentUserId={user.id} isAdmin={false} driverName={user.name}/> : <div className="messages-notice"><h1>Pesan admin ke sopir</h1><p>Admin dapat melihat daftar sopir dan memulai percakapan dari halaman khusus.</p><Link href="/admin/drivers">Buka daftar sopir</Link></div>}
  </section></main>;
}
