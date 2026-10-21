"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/types";

const empty: UserProfile = { name: "", email: "", phone: "", address: "" };

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(empty);
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  const [credentialsBusy, setCredentialsBusy] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) { window.location.assign("/"); return; }
      setProfile(result.profile); setRole(result.role); setUsername(result.username || "");
    }).catch(() => setError("Data profil tidak dapat dimuat.")).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Profil gagal disimpan.");
      setProfile(result.profile); setMessage("Perubahan profil berhasil disimpan.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  async function saveCredentials(event: FormEvent) {
    event.preventDefault(); setCredentialsBusy(true); setCredentialsError(""); setCredentialsMessage("");
    try {
      const response = await fetch("/api/admin/account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, currentPassword, newPassword, confirmPassword }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kredensial gagal diperbarui.");
      setUsername(result.username); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      if (result.passwordChanged) {
        setCredentialsMessage("Username dan password berhasil diperbarui. Silakan masuk kembali dengan kredensial baru.");
        window.setTimeout(() => window.location.assign("/login"), 1200);
      } else {
        setCredentialsMessage("Username berhasil diperbarui.");
      }
    } catch (reason) { setCredentialsError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setCredentialsBusy(false); }
  }

  if (loading) return <div className="profile-loading">Memuat profil…</div>;
  return <main className="profile-page">
    <header className="profile-header"><Link href={role === "passenger" ? "/" : "/login"} className="profile-back">← Kembali ke dashboard</Link><span>ITS Buggy Car · AKUN</span></header>
    <section className="profile-content"><div className="eyebrow">PENGATURAN AKUN</div><h1>Data diri</h1><p className="profile-lead">Perbarui informasi yang terhubung dengan akun Anda.</p>
      <form className="profile-card" onSubmit={save}><div className="profile-card-head"><div className="profile-large-avatar">{profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U"}</div><div><h2>{profile.name || "Profil pengguna"}</h2><span>{role === "driver" ? "Sopir" : role === "admin" ? "Admin" : "Penumpang"}</span></div></div>
        <div className="profile-fields"><label>Nama lengkap<input required maxLength={100} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })}/></label><label>Email<input type="email" maxLength={200} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="nama@email.com"/></label><label>Nomor telepon<input type="tel" maxLength={40} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="08xxxxxxxxxx"/></label><label>Alamat<textarea rows={3} maxLength={300} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Alamat tempat tinggal"/></label></div>
        {error && <div className="form-error">{error}</div>}{message && <div className="profile-success">{message}</div>}<div className="profile-actions"><Link href={role === "passenger" ? "/" : "/login"}>Batal</Link><button className="primary-button" disabled={busy}>{busy ? "Menyimpan…" : "Simpan perubahan"}</button></div>
      </form>
      <p className="profile-note">Perubahan disimpan pada penyimpanan lokal server untuk akun ini.</p>
      {role === "admin" && <section className="profile-card admin-credentials-card"><div className="profile-card-head"><div><h2>Username dan password admin</h2><span>Konfirmasi dengan password saat ini untuk menyimpan perubahan.</span></div></div>
        <form onSubmit={saveCredentials}>
          <div className="profile-fields"><label>Username<input required minLength={3} maxLength={32} pattern="[a-z0-9._-]+" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Password saat ini<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Password baru <span className="profile-optional">(opsional)</span><input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Kosongkan jika tidak ingin mengganti" /></label><label>Konfirmasi password baru<input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div>
          {credentialsError && <div className="form-error">{credentialsError}</div>}{credentialsMessage && <div className="profile-success">{credentialsMessage}</div>}
          <div className="profile-actions"><button className="primary-button" disabled={credentialsBusy}>{credentialsBusy ? "Menyimpan…" : "Simpan username/password"}</button></div>
        </form>
      </section>}
    </section>
  </main>;
}
