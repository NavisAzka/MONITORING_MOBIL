"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { initials, liveState, randomPassword, type AdminDriver } from "@/lib/driverMonitoring";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/drivers", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Daftar sopir tidak dapat dimuat.");
    setDrivers(result.drivers);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    fetch("/api/session", { cache: "no-store" }).then((response) => response.json()).then(async (session) => {
      if (!session.user) { window.location.assign("/"); return; }
      if (session.user.role !== "admin") { if (alive) setError("Halaman ini hanya tersedia untuk admin."); return; }
      await refresh();
      if (alive) timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 10000);
    }).catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; if (timer) window.clearInterval(timer); };
  }, [refresh]);

  async function createDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true); setFormError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), username: data.get("username"), password: data.get("password"), phone: data.get("phone") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Akun sopir gagal dibuat.");
      setNotice(`Akun ${result.driver.name} dibuat. Sopir masuk dengan username "${result.driver.username}" dan kata sandi yang Anda tetapkan.`);
      form.reset(); setPassword(""); setFormOpen(false);
      await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="profile-loading">Memuat daftar sopir…</div>;
  return <main className="profile-page"><header className="profile-header"><Link href="/login" className="profile-back">← Kembali ke dashboard</Link><span>ITS Buggy Car · ADMIN</span></header><section className="admin-drivers-content">
    <div className="eyebrow">PENGELOLAAN ARMADA</div><h1>Daftar sopir</h1><p className="profile-lead">Lihat data diri, status kendaraan, dan kirim pesan kepada sopir terdaftar.</p>
    {error ? <div className="form-error">{error}</div> : <>
      <div className="driver-create-bar">
        {notice && <div className="fleet-success">{notice}</div>}
        {!formOpen && <button className="primary-button driver-create-toggle" onClick={() => { setFormOpen(true); setNotice(""); }}>+ Tambah akun sopir</button>}
      </div>
      {formOpen && <form className="fleet-manage-card driver-create-form" onSubmit={createDriver}>
        <div className="fleet-manage-heading"><span className="fleet-car-symbol">+</span><div><strong>Akun sopir baru</strong><small>Hanya admin yang dapat membuat akun sopir. Berikan username dan kata sandi kepada sopir.</small></div></div>
        <div className="fleet-form-fields">
          <label>Nama lengkap<input name="name" required minLength={2} maxLength={80} placeholder="mis. Budi Santoso"/></label>
          <label>Username<input name="username" required minLength={3} maxLength={32} pattern="[a-z0-9._\-]+" autoCapitalize="none" autoComplete="off" placeholder="mis. budi.s"/></label>
          <label>Kata sandi<span className="password-field"><input name="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter"/><button type="button" onClick={() => setPassword(randomPassword())}>Buat acak</button></span></label>
          <label>Nomor HP (opsional)<input name="phone" type="tel" maxLength={40} placeholder="08xxxxxxxxxx"/></label>
          {formError && <div className="form-error">{formError}</div>}
          <div className="driver-create-actions"><button type="button" className="roster-profile-button" onClick={() => { setFormOpen(false); setFormError(""); setPassword(""); }}>Batal</button><button disabled={saving}>{saving ? "Menyimpan…" : "Buat akun"}</button></div>
        </div>
      </form>}
      {drivers.length === 0 ? <div className="empty-state">Belum ada akun sopir yang terdaftar.</div> : <div className="admin-drivers-layout">
        <nav className="driver-roster" aria-label="Daftar sopir">{drivers.map((driver) => {
          const state = liveState(driver.vehicle);
          return <article key={driver.id} className="driver-roster-card"><div className="driver-roster-summary"><span className="profile-large-avatar">{initials(driver.name)}</span><span className="driver-roster-copy"><strong>{driver.name}</strong><small>{driver.vehicle ? `${state.label} · ${driver.vehicle.name}` : state.label}</small></span><i className={`roster-status ${state.key}`}/></div><div className="driver-roster-actions"><Link className="roster-profile-button" href={`/admin/drivers/${encodeURIComponent(driver.id)}`} target="_blank" rel="noreferrer">Cek profil</Link><Link className="roster-message-button" href={`/admin/drivers/${encodeURIComponent(driver.id)}/chat`} target="_blank" rel="noreferrer">Kirim Pesan</Link></div></article>;
        })}</nav>
      </div>}
    </>}
  </section></main>;
}
