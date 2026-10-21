"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, KeyboardEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser, Vehicle } from "@/lib/types";
import { formatAgo, isLocationStale } from "@/lib/driverMonitoring";
import PassengerHome from "@/components/PassengerHome";

const VehicleMap = dynamic(() => import("@/components/VehicleMap"), { ssr: false, loading: () => <div className="map-loading">Memuat peta…</div> });

type FleetResponse = { vehicles: Vehicle[]; demo: boolean; unavailable: boolean };

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
    car: <><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.8L19 11"/><path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Tidak dapat masuk.");
      onLogin(result.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  return <main className="login-shell">
    <section className="login-aside">
      <div className="brand brand-light"><Image className="login-brand-logo" src="/its-logo.png" alt="Logo ITS" width={44} height={44} priority/><span>ITS Buggy Car</span></div>
      <div className="login-copy"><div className="eyebrow light-eyebrow"><span className="live-dot"/> SISTEM MONITORING ARMADA</div><h1>Perjalanan yang<br/><em>terpantau.</em></h1><p>Lokasi armada, status kendaraan, dan informasi sopir dalam satu tampilan.</p></div>
      <div className="login-foot"><span>01</span><span className="foot-line"/><span>MONITORING MOBIL PENUMPANG</span></div>
      <div className="decor-ring ring-one"/><div className="decor-ring ring-two"/>
    </section>
    <section className="login-panel"><div className="login-form-wrap">
      <div className="mobile-brand brand"><Image className="login-brand-logo" src="/its-logo.png" alt="Logo ITS" width={40} height={40} priority/><span>ITS Buggy Car</span></div>
      <div className="eyebrow">SELAMAT DATANG</div><h2>Masuk ke akun</h2><p className="form-intro">Masuk menggunakan akun admin atau sopir.</p>
      <form onSubmit={submit} className="login-form">
        <label>Nama pengguna<input autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Nama pengguna admin atau sopir"/></label>
        <label>Kata sandi<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi"/></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button login-button" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}<Icon name="arrow" size={17}/></button>
      </form>
      <div className="login-help"><span className="help-icon">i</span><span>Gunakan akun yang diberikan oleh pengelola armada.</span></div>
    </div><div className="login-panel-foot">© {new Date().getFullYear()} ITS Buggy Car <span>•</span> Monitoring armada penumpang</div></section>
  </main>;
}

export default function Dashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [demo, setDemo] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [busyVehicle, setBusyVehicle] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [driverInfo, setDriverInfo] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [driverInfoLoading, setDriverInfoLoading] = useState(false);
  const [driverInfoError, setDriverInfoError] = useState("");
  const [focusVehicleId, setFocusVehicleId] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/vehicles", { cache: "no-store" });
    if (response.status === 401) { setUser(null); return; }
    const result: FleetResponse = await response.json();
    if (!response.ok) throw new Error("Data armada tidak dapat dimuat.");
    setVehicles(result.vehicles); setDemo(result.demo); setUnavailable(result.unavailable); setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetch("/api/session").then((response) => response.json()).then((result) => {
      if (result.user) { setUser(result.user); return result.user.role === "passenger" ? undefined : refresh(); }
    }).catch(() => undefined).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!user || user.role === "passenger") return;
    const timer = window.setInterval(() => refresh().catch(() => undefined), 10000);
    return () => window.clearInterval(timer);
  }, [user, refresh]);

  const counts = useMemo(() => ({
    total: vehicles.length,
    active: vehicles.filter((vehicle) => vehicle.status === "in_use").length,
    available: vehicles.filter((vehicle) => vehicle.status === "available").length,
  }), [vehicles]);
  const ownVehicle = vehicles.find((vehicle) => vehicle.driver && user && vehicle.driver === user.name);

  async function chooseVehicle(vehicleId: string | null) {
    setBusyVehicle(vehicleId ?? "release"); setActionError("");
    try {
      const response = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vehicleId ? { vehicleId } : { action: "release" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pilihan mobil gagal diperbarui.");
      await refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); await refresh().catch(() => undefined); }
    finally { setBusyVehicle(""); }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null); setVehicles([]);
  }

  // Cards with a GPS position act as a button that scrolls to the map and centres it on that vehicle.
  function focusProps(vehicle: Vehicle) {
    if (vehicle.latitude === null || vehicle.longitude === null) return {};
    const focus = () => {
      setFocusVehicleId(vehicle.id);
      setFocusRequest((value) => value + 1);
      document.getElementById("vehicle-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return {
      role: "button",
      tabIndex: 0,
      title: `Tampilkan ${vehicle.name} di peta`,
      "data-focusable": "true",
      // Inner links and buttons (Detail, Pilih mobil, Detail sopir) keep their own behaviour.
      onClick: (event: MouseEvent<HTMLElement>) => { if (!(event.target as HTMLElement).closest("a,button")) focus(); },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focus(); } },
    };
  }

  async function showDriver(driverId: string) {
    setDriverInfo(null); setDriverInfoError(""); setDriverInfoLoading(true);
    try {
      const response = await fetch(`/api/drivers/${encodeURIComponent(driverId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Informasi sopir tidak dapat dimuat.");
      setDriverInfo(result.driver);
    } catch (reason) { setDriverInfoError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setDriverInfoLoading(false); }
  }

  if (loading) return <div className="app-loading"><div className="loader-mark"><Icon name="pin" size={21}/></div>Menyiapkan ITS Buggy Car…</div>;
  if (!user) return <Login onLogin={(nextUser) => { setUser(nextUser); if (nextUser.role !== "passenger") refresh().catch(() => undefined); }}/>
  if (user.role === "passenger") return <PassengerHome user={user}/>;

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"/>}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-icon"><Icon name="pin" size={20}/></span><span>ITS Buggy Car</span></div>
      <div className="nav-label">MENU UTAMA</div>
      <nav className="side-nav"><a className="nav-item active" href="#overview"><Icon name="grid"/><span>Ringkasan armada</span><span className="nav-active-dot"/></a><a className="nav-item" href="#vehicles"><Icon name="car"/><span>Daftar kendaraan</span><span className="nav-count">{counts.total}</span></a>{user.role === "admin" && <><Link className="nav-item" href="/admin/fleet"><Icon name="car"/><span>Kelola armada</span></Link><Link className="nav-item" href="/admin/drivers"><Icon name="user"/><span>Daftar sopir & chat</span></Link></>}{user.role === "driver" && <Link className="nav-item" href="/messages"><Icon name="user"/><span>Pesan admin</span></Link>}</nav>
      <div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="profile-text"><strong>{user.name}</strong><span>{user.role === "driver" ? "Sopir" : user.role === "admin" ? "Admin" : "Penumpang"}</span><Link className="profile-link" href="/profile">Data diri</Link></div><button className="icon-button" aria-label="Keluar" onClick={logout}><Icon name="logout" size={17}/></button></div></div>
    </aside>

    <main className="main-area" id="overview">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Buka menu">☰</button><div className="breadcrumb"><strong>Tipe akun: {user.role === "admin" ? "Admin" : user.role === "driver" ? "Sopir" : "Penumpang"}</strong></div></div><div className="topbar-right"><div className="system-status"><span className="live-dot"/>Sistem aktif</div><div className="topbar-divider"/><div className="date-chip"><Icon name="clock" size={16}/><span>{new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date())}</span></div><div className="topbar-user">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">DASHBOARD OPERASIONAL</div><h1>Ringkasan armada<span className="heading-period">.</span></h1><p>Pantau posisi dan kesiapan kendaraan dalam satu layar.</p></div></div>
        {(demo || unavailable) && <div className={`notice ${unavailable ? "notice-warning" : "notice-demo"}`}><span className="notice-symbol">{unavailable ? "!" : "i"}</span><span>{unavailable ? "GPS Maxtracker tidak terjangkau. Menampilkan data contoh sementara." : "Mode pratinjau: posisi pada peta menggunakan data contoh."}</span><span className="notice-label">{unavailable ? "KONEKSI TERGANGGU" : "DATA CONTOH"}</span></div>}
        {actionError && <div className="action-error">{actionError}<button onClick={() => setActionError("")}>Tutup</button></div>}
        <section className="map-card" id="vehicle-map"><div className="section-heading map-heading"><div><div className="section-title-row"><h2>Lokasi kendaraan</h2><span className="live-pill"><span className="live-dot"/>LANGSUNG</span></div><p>Kampus ITS Sukolilo · Surabaya</p></div><div className="map-legend"><span><i className="legend-dot legend-active"/>Aktif</span><span><i className="legend-dot legend-free"/>Tidak aktif</span></div></div><div className="map-frame"><VehicleMap vehicles={vehicles} focusVehicleId={focusVehicleId} focusRequest={focusRequest}/>{vehicles.length === 0 && <div className="map-empty">Belum ada data kendaraan dari GPS.</div>}</div><div className="map-bottom"><span><span className="status-pulse"/>Pembaruan otomatis tiap 10 detik</span><span>Terakhir diperbarui {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(lastRefresh)}</span></div></section>

        {user.role === "driver" && <section className="driver-section" id="vehicles"><div className="section-heading driver-heading"><div><div className="eyebrow">AKSES SOPIR</div><h2>Pilih kendaraan</h2><p>Pilih satu mobil untuk mengubah statusnya menjadi aktif.</p></div>{ownVehicle && <div className="current-selection"><span className="live-dot"/><span>Sedang menggunakan <strong>{ownVehicle.name}</strong></span><button disabled={busyVehicle !== ""} onClick={() => chooseVehicle(null)}>Lepas mobil</button></div>}</div>
          {vehicles.length === 0 ? <div className="empty-state">Belum ada kendaraan yang terdaftar pada GPS Maxtracker.</div> : <div className="vehicle-grid">{vehicles.map((vehicle) => {
            const mine = vehicle.driver === user.name;
            const unavailableToMe = vehicle.status === "in_use" && !mine;
            const stale = isLocationStale(vehicle.locationTime, Date.now(), vehicle.demo);
            return <article className={`vehicle-card ${mine ? "vehicle-card-mine" : ""}`} key={vehicle.id} {...focusProps(vehicle)}><div className="vehicle-card-top"><div className={`vehicle-thumb ${vehicle.status === "in_use" ? "thumb-active" : ""}`}><Icon name="car" size={25}/></div><span className={`vehicle-status ${vehicle.status === "in_use" ? "status-occupied" : "status-available"}`}><i/>{vehicle.status === "in_use" ? "Aktif" : "Tidak aktif"}</span></div><div className="vehicle-title"><h3>{vehicle.name}<Link className="vehicle-detail-link" href={`/vehicles/${encodeURIComponent(vehicle.id)}`} target="_blank" rel="noreferrer">Detail <Icon name="arrow" size={12}/></Link></h3></div><div className="vehicle-capacity">Penumpang saat ini: <strong>{vehicle.currentPassengers === null ? "Belum diperbarui" : `${vehicle.currentPassengers} orang`}</strong><span className="capacity-secondary">Kapasitas: {vehicle.passengerCapacity ? `${vehicle.passengerCapacity} orang` : "Belum diatur"}</span></div><div className="vehicle-meta"><span><Icon name="pin" size={14}/>{vehicle.latitude === null ? "Lokasi tidak tersedia" : `${vehicle.latitude.toFixed(4)}, ${vehicle.longitude?.toFixed(4)}`}</span><span><Icon name="clock" size={14}/>{stale ? `GPS ${formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}` : `Diperbarui ${formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}`}</span></div>{vehicle.status === "in_use" && <div className="driver-tag"><span className="mini-avatar">{vehicle.driver?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "S"}</span><span className="driver-tag-copy">Dikendarai oleh<strong>{vehicle.driver || "Belum diketahui"}</strong></span>{vehicle.driverId && <button className="driver-detail-button" onClick={() => showDriver(vehicle.driverId!)}>Detail sopir</button>}</div>}<button className={`vehicle-action ${mine ? "action-selected" : ""}`} disabled={unavailableToMe || busyVehicle !== ""} onClick={() => chooseVehicle(mine ? null : vehicle.id)}>{busyVehicle === vehicle.id ? "Memproses…" : mine ? <><Icon name="check" size={15}/> Mobil pilihan Anda</> : unavailableToMe ? "Aktif · dipakai sopir lain" : "Pilih mobil"}{!mine && !unavailableToMe && <Icon name="arrow" size={15}/>}</button></article>;
          })}</div>}
        </section>}
        {user.role !== "driver" && <section className="passenger-fleet" id="vehicles"><div className="section-heading passenger-heading"><div><div className="eyebrow">{user.role === "admin" ? "RINGKASAN ADMIN" : "INFORMASI PENUMPANG"}</div><h2>Status seluruh kendaraan</h2><p>Lokasi, status penggunaan, dan sopir yang sedang bertugas.</p></div><div className="fleet-total">{counts.total} kendaraan</div></div>{vehicles.length === 0 ? <div className="empty-state">Belum ada data kendaraan yang tersedia.</div> : <div className="vehicle-grid passenger-grid">{vehicles.map((vehicle) => {
          const stale = isLocationStale(vehicle.locationTime, Date.now(), vehicle.demo);
          return <article className="vehicle-card passenger-vehicle-card" key={vehicle.id} {...focusProps(vehicle)}><div className="vehicle-card-top"><div className={`vehicle-thumb ${vehicle.status === "in_use" ? "thumb-active" : ""}`}><Icon name="car" size={25}/></div><span className={`vehicle-status ${vehicle.status === "in_use" ? "status-occupied" : "status-available"}`}><i/>{vehicle.status === "in_use" ? "Aktif" : "Tidak aktif"}</span></div><div className="vehicle-title"><h3>{vehicle.name}<Link className="vehicle-detail-link" href={`/vehicles/${encodeURIComponent(vehicle.id)}`} target="_blank" rel="noreferrer">Detail <Icon name="arrow" size={12}/></Link></h3></div><div className="vehicle-capacity">Penumpang saat ini: <strong>{vehicle.currentPassengers === null ? "Belum diperbarui" : `${vehicle.currentPassengers} orang`}</strong><span className="capacity-secondary">Kapasitas: {vehicle.passengerCapacity ? `${vehicle.passengerCapacity} orang` : "Belum diatur"}</span></div><div className="vehicle-meta"><span><Icon name="pin" size={14}/>{vehicle.latitude === null ? "Lokasi tidak tersedia" : `${vehicle.latitude.toFixed(4)}, ${vehicle.longitude?.toFixed(4)}`}</span><span><Icon name="clock" size={14}/>{stale ? `GPS ${formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}` : `Diperbarui ${formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}`}</span></div><div className="passenger-driver">{vehicle.status === "in_use" ? <><span className="mini-avatar">{vehicle.driver?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "S"}</span><span className="passenger-driver-label">Sopir</span><strong>{vehicle.driver || "Belum diketahui"}</strong>{vehicle.driverId && <button className="driver-detail-button" onClick={() => showDriver(vehicle.driverId!)}>Detail sopir</button>}</> : <><span className="mini-avatar avatar-muted"><Icon name="user" size={12}/></span><span>Sopir</span><strong className="no-driver">Belum memilih mobil</strong></>}</div></article>;
        })}</div>}</section>}
        <footer className="page-footer"><span>ITS Buggy Car <i>•</i> SISTEM MONITORING ARMADA</span><span>Lokasi GPS diperbarui otomatis</span></footer>
      </div>
    </main>
    {(driverInfoLoading || driverInfoError || driverInfo) && <div className="driver-modal-backdrop" role="presentation" onClick={() => { if (!driverInfoLoading) { setDriverInfo(null); setDriverInfoError(""); } }}><section className="driver-modal" role="dialog" aria-modal="true" aria-labelledby="driver-modal-title" onClick={(event) => event.stopPropagation()}><button className="driver-modal-close" onClick={() => { setDriverInfo(null); setDriverInfoError(""); }} aria-label="Tutup">×</button><div className="eyebrow">INFORMASI KONTAK</div><h2 id="driver-modal-title">Detail sopir</h2>{driverInfoLoading ? <p>Memuat informasi sopir…</p> : driverInfoError ? <p className="driver-modal-error">{driverInfoError}</p> : driverInfo && <><div className="driver-modal-person"><span className="profile-large-avatar">{driverInfo.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{driverInfo.name}</strong><span>Sopir kendaraan</span></div></div><div className="driver-phone-row"><span>Nomor HP</span>{driverInfo.phone ? <a href={`tel:${driverInfo.phone}`}>{driverInfo.phone}</a> : <strong>Belum dicantumkan</strong>}</div>{user.role === "admin" && <Link className="driver-chat-link" href={`/admin/drivers/${encodeURIComponent(driverInfo.id)}/chat`}>Buka chat sopir <Icon name="arrow" size={15}/></Link>}</>}</section></div>}
  </div>;
}
