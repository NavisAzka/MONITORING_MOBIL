"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { formatAgo, formatDuration, formatSpeed, formatWibDateTime, formatWibTime, initials, liveState, randomPassword, type AdminDriver } from "@/lib/driverMonitoring";
import type { SessionUser } from "@/lib/types";

type Driver = AdminDriver;
type Period = "today" | "7d" | "30d";
const PERIODS: { key: Period; label: string }[] = [{ key: "today", label: "Hari ini" }, { key: "7d", label: "7 hari" }, { key: "30d", label: "30 hari" }];

type SessionRow = { id: string; vehicleName: string; startedAt: number; endedAt: number | null; durationSeconds: number; activeSeconds: number; distanceKm: number | null };
type Stats = { totals: { sessions: number; activeSeconds: number; distanceKm: number; distanceComplete: boolean }; sessions: SessionRow[] };

const km = (value: number) => `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} km`;

// Realtime values come from the current GPS snapshot; period totals come from recorded sessions (assignments).
// Driving/idle time and top speed need per-point GPS history, which is not stored yet.
function DriverMonitoring({ driver }: { driver: Driver }) {
  const [period, setPeriod] = useState<Period>("today");
  const [now, setNow] = useState(() => Date.now());
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  const sessionKey = driver.vehicle?.startedAt ?? 0;
  useEffect(() => {
    let active = true;
    const load = () => fetch(`/api/admin/drivers/${encodeURIComponent(driver.id)}/stats?period=${period}`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Rekap tidak dapat dimuat."); if (active) { setStats(result); setStatsError(""); } })
      .catch((reason) => { if (active) setStatsError(reason instanceof Error ? reason.message : "Rekap tidak dapat dimuat."); });
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [driver.id, period, sessionKey]);
  const vehicle = driver.vehicle;
  const state = liveState(vehicle, now);
  const needsHistory = <span className="monitor-pending">Perlu riwayat GPS</span>;
  const loadingValue = <span className="monitor-pending">Memuat…</span>;
  return <section className="driver-monitor-card">
    <div className="driver-monitor-heading"><div><h2>Pemantauan sopir</h2><p>Status realtime dari GPS kendaraan yang sedang dipakai.</p></div><span className={`driver-status-chip ${state.key === "driving" ? "driving" : "idle"} live-${state.key}`}>{state.label}</span></div>
    <div className="monitor-grid">
      <div className="monitor-tile"><span>Kendaraan</span><strong>{vehicle?.name ?? "—"}</strong></div>
      <div className="monitor-tile"><span>Kecepatan</span><strong>{vehicle ? formatSpeed(vehicle.speed, vehicle.speedAvailable) : "—"}</strong></div>
      <div className="monitor-tile"><span>Mesin</span><strong>{vehicle?.engine ?? "—"}</strong></div>
      <div className="monitor-tile"><span>Lama sesi berjalan</span><strong>{vehicle?.startedAt ? formatDuration(now - vehicle.startedAt) : "—"}</strong>{vehicle?.startedAt ? <small>sejak {`${formatWibTime(vehicle.startedAt)} WIB`}</small> : vehicle ? <small>Belum tercatat</small> : null}</div>
      <div className="monitor-tile"><span>Posisi terakhir</span><strong>{vehicle?.latitude != null && vehicle.longitude != null ? `${vehicle.latitude.toFixed(5)}, ${vehicle.longitude.toFixed(5)}` : "—"}</strong>{vehicle && <small>GPS {formatAgo(vehicle.locationTime, now, vehicle.demo)}</small>}</div>
      <div className="monitor-tile"><span>Jarak sesi ini</span><strong>{!vehicle ? "—" : vehicle.sessionDistanceKm !== null ? km(vehicle.sessionDistanceKm) : "Tidak tersedia"}</strong><small>{vehicle && vehicle.sessionDistanceKm === null ? "Odometer awal/terkini tidak tercatat" : "Selisih odometer sejak mulai sesi"}</small></div>
    </div>
    <div className="driver-monitor-heading monitor-range-heading"><div><h2>Rekap rentang waktu</h2><p>Akumulasi dari sesi pemakaian mobil pada periode tertentu.</p></div><div className="monitor-periods" role="tablist">{PERIODS.map((item) => <button key={item.key} role="tab" aria-selected={period === item.key} className={period === item.key ? "active" : ""} onClick={() => { setPeriod(item.key); setStats(null); }}>{item.label}</button>)}</div></div>
    {statsError && <div className="form-error">{statsError}</div>}
    <div className="monitor-grid">
      <div className="monitor-tile"><span>Total jarak tempuh</span><strong>{stats ? km(stats.totals.distanceKm) : loadingValue}</strong><small>{stats && !stats.totals.distanceComplete ? "Sebagian sesi tanpa data odometer" : "dari odometer tiap sesi"}</small></div>
      <div className="monitor-tile"><span>Waktu aktif</span><strong>{stats ? formatDuration(stats.totals.activeSeconds * 1000) : loadingValue}</strong><small>total lama memakai mobil</small></div>
      <div className="monitor-tile"><span>Jumlah sesi</span><strong>{stats ? `${stats.totals.sessions} sesi` : loadingValue}</strong><small>pemilihan mobil</small></div>
      <div className="monitor-tile"><span>Durasi mengemudi</span><strong>{needsHistory}</strong><small>mesin hidup &amp; bergerak</small></div>
      <div className="monitor-tile"><span>Durasi idle</span><strong>{needsHistory}</strong><small>mesin hidup, berhenti</small></div>
      <div className="monitor-tile"><span>Kecepatan maksimum</span><strong>{needsHistory}</strong><small>km/jam</small></div>
    </div>
    <div className="monitor-history"><strong>Riwayat sesi</strong>{!stats ? <div className="empty-state">Memuat riwayat sesi…</div> : stats.sessions.length === 0 ? <div className="empty-state">Belum ada sesi pada periode ini.</div> : <div className="monitor-table-wrap"><table className="monitor-table">
      <thead><tr><th>Kendaraan</th><th>Mulai</th><th>Selesai</th><th>Durasi</th><th>Jarak</th></tr></thead>
      <tbody>{stats.sessions.map((item) => <tr key={item.id}><td>{item.vehicleName}</td><td>{`${formatWibDateTime(item.startedAt)} WIB`}</td><td>{item.endedAt ? `${formatWibDateTime(item.endedAt)} WIB` : <span className="driver-status-chip driving">Berjalan</span>}</td><td>{formatDuration(item.durationSeconds * 1000)}</td><td>{item.distanceKm !== null ? km(item.distanceKm) : "—"}</td></tr>)}</tbody>
    </table></div>}</div>
    <p className="monitor-footnote">Durasi mengemudi, durasi idle, dan kecepatan maksimum membutuhkan riwayat titik GPS per waktu (time-series), yang akan ditambahkan pada tahap berikutnya.</p>
  </section>;
}

function DriverAccountActions({ driver }: { driver: Driver }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"" | "password" | "delete">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password"); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/drivers/${encodeURIComponent(driver.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kata sandi gagal diganti.");
      setPassword("");
      setNotice("Kata sandi berhasil diganti. Sesi login sopir yang lama otomatis keluar; berikan kata sandi baru kepada sopir.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setBusy(""); }
  }

  async function deleteAccount() {
    if (!window.confirm(`Hapus akun ${driver.name} (@${driver.username})?\n\nSopir langsung keluar, mobil yang sedang dipakai dilepas, dan akun tidak dapat dipulihkan.`)) return;
    setBusy("delete"); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/drivers/${encodeURIComponent(driver.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Akun gagal dihapus.");
      window.location.assign("/admin/drivers");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); setBusy(""); }
  }

  return <section className="driver-monitor-card driver-account-card">
    <div className="driver-monitor-heading"><div><h2>Kelola akun</h2><p>Username login: <strong>@{driver.username}</strong></p></div></div>
    {notice && <div className="fleet-success">{notice}</div>}
    {error && <div className="form-error">{error}</div>}
    <form className="fleet-form-fields driver-password-form" onSubmit={changePassword}>
      <label>Kata sandi baru<span className="password-field"><input name="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter"/><button type="button" onClick={() => setPassword(randomPassword())}>Buat acak</button></span></label>
      <button disabled={busy !== ""}>{busy === "password" ? "Menyimpan…" : "Ganti kata sandi"}</button>
    </form>
    <div className="driver-danger-zone"><div><strong>Hapus akun sopir</strong><small>Sopir tidak dapat masuk lagi. Riwayat chat tetap tersimpan.</small></div><button type="button" className="danger-button" disabled={busy !== ""} onClick={deleteAccount}>{busy === "delete" ? "Menghapus…" : "Hapus akun"}</button></div>
  </section>;
}

export default function AdminDriverWorkspace({ driverId, mode }: { driverId: string; mode: "profile" | "chat" }) {
  const [admin, setAdmin] = useState<SessionUser | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer = 0;
    void (async () => {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        const session = await sessionResponse.json();
        if (!session.user) { window.location.assign("/"); return; }
        if (session.user.role !== "admin") { setError("Halaman ini hanya tersedia untuk admin."); return; }
        setAdmin(session.user);
        const response = await fetch("/api/admin/drivers", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Data sopir tidak dapat dimuat.");
        const current = result.drivers.find((item: Driver) => item.id === driverId);
        if (!current) throw new Error("Sopir tidak ditemukan.");
        if (active) setDriver(current);
        // Keep realtime monitoring fresh on the profile page.
        if (active && mode === "profile") timer = window.setInterval(() => {
          void fetch("/api/admin/drivers", { cache: "no-store" }).then((next) => next.json()).then((next) => {
            const updated = next.drivers?.find((item: Driver) => item.id === driverId);
            if (active && updated) setDriver(updated);
          }).catch(() => undefined);
        }, 10000);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Data sopir tidak dapat dimuat.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [driverId, mode]);

  if (loading) return <div className="profile-loading">Memuat {mode === "profile" ? "profil sopir" : "percakapan"}…</div>;
  return <main className="profile-page"><header className="profile-header"><Link href="/admin/drivers" className="profile-back">← Kembali ke daftar sopir</Link><span>ITS Buggy Car · ADMIN</span></header><section className="admin-driver-workspace">
    {error ? <div className="form-error">{error}</div> : driver && <>
      <div className="eyebrow">{mode === "profile" ? "PROFIL SOPIR" : "PESAN LANGSUNG"}</div>
      <h1>{mode === "profile" ? driver.name : `Chat dengan ${driver.name}`}</h1>
      {mode === "profile" ? <><p className="profile-lead">Informasi diri dan status kendaraan sopir.</p><section className="driver-profile-card"><div className="driver-profile-heading"><span className="profile-large-avatar">{initials(driver.name)}</span><div><h2>{driver.name}</h2><span>Sopir terdaftar{driver.username ? ` · @${driver.username}` : ""}</span></div></div><dl className="driver-profile-fields"><div><dt>Status kendaraan</dt><dd>{driver.vehicle ? <><span className="driver-status-chip driving">Aktif</span><strong>{driver.vehicle.name}</strong></> : <span className="driver-status-chip idle">Tidak aktif</span>}</dd></div><div><dt>Nomor HP</dt><dd>{driver.phone ? <a href={`tel:${driver.phone}`}>{driver.phone}</a> : "Belum dicantumkan"}</dd></div><div><dt>Email</dt><dd>{driver.email || "Belum dicantumkan"}</dd></div><div><dt>Alamat</dt><dd>{driver.address || "Belum dicantumkan"}</dd></div></dl></section><DriverMonitoring driver={driver}/><DriverAccountActions driver={driver}/></> : <><p className="profile-lead">Kirim pesan langsung kepada sopir.</p>{admin && <ChatPanel key={driver.id} driverId={driver.id} currentUserId={admin.id} isAdmin driverName={driver.name} showHeader={false} showEmptyState={false}/>}</>}
    </>}
  </section></main>;
}
