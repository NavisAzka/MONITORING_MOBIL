"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { formatAgo, formatSpeed, formatWibDate, formatWibShortDate, isLocationStale } from "@/lib/driverMonitoring";
import type { SessionUser, Vehicle } from "@/lib/types";

const PassengerMap = dynamic(() => import("@/components/PassengerMap"), {
  ssr: false,
  loading: () => <div className="passenger-map-loading">Memuat peta…</div>,
});

type FleetResponse = { vehicles: Vehicle[]; demo: boolean; unavailable: boolean };
type Position = { latitude: number; longitude: number };

export default function PassengerHome({ user }: { user?: SessionUser }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsMessage, setGpsMessage] = useState("Tekan Lokasi saya untuk menampilkan posisi Anda.");
  const [gpsError, setGpsError] = useState("");
  const [locationRequest, setLocationRequest] = useState(0);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [mapRequest, setMapRequest] = useState(0);
  const [focusVehicleId, setFocusVehicleId] = useState("");
  const [vehicleFocusRequest, setVehicleFocusRequest] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const refresh = useCallback(async () => {
    const response = await fetch("/api/passenger/vehicles", { cache: "no-store" });
    if (response.status === 401) {
      await fetch("/api/logout", { method: "POST" });
      window.location.reload();
      return;
    }
    const result: FleetResponse = await response.json();
    if (!response.ok) throw new Error("Lokasi mobil tidak dapat dimuat.");
    setVehicles(result.vehicles);
    setRefreshError(result.unavailable ? "Koneksi GPS armada sedang terganggu." : "");
  }, []);

  useEffect(() => {
    refresh().catch(() => setRefreshError("Lokasi mobil tidak dapat dimuat."));
    const timer = window.setInterval(() => refresh().catch(() => setRefreshError("Lokasi mobil tidak dapat dimuat.")), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (locationRequest === 0) return;
    if (!navigator.geolocation) {
      setGpsMessage("");
      setGpsError("Perangkat atau browser ini tidak mendukung GPS.");
      return;
    }
    const watcher = navigator.geolocation.watchPosition(
      (current) => {
        setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        setGpsMessage("Lokasi Anda diperbarui langsung dari perangkat.");
        setGpsError("");
      },
      (error) => {
        setGpsMessage("");
        setGpsError(error.code === error.PERMISSION_DENIED
          ? "Izin lokasi ditolak. Aktifkan akses lokasi di pengaturan browser."
          : "Lokasi belum tersedia. Pastikan GPS perangkat aktif.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [locationRequest]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  return <main className="passenger-home">
    <PassengerMap vehicles={vehicles} position={position} locateRequest={mapRequest} focusVehicleId={focusVehicleId} focusRequest={vehicleFocusRequest}/>
    <nav className="passenger-navbar" aria-label="Navigasi utama">
      <Image className="its-logo" src="/its-logo.png" alt="Logo ITS" width={48} height={48} priority />
      <strong>ITS Buggy Car</strong>
      <time className="passenger-datetime" dateTime={currentTime.toISOString()}>
        <span className="passenger-date-full">{formatWibDate(currentTime)}</span>
        <span className="passenger-date-short">{formatWibShortDate(currentTime)}</span>
      </time>
      {user && <button className="passenger-account" onClick={logout} title={`Keluar dari akun ${user.name}`} aria-label={`Keluar dari akun ${user.name}`}>
        <span>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><b>Keluar</b>
      </button>}
    </nav>
    <button className="my-location-button" onClick={() => {
      if (!position) {
        setShowLocationDialog(true);
        return;
      }
      setGpsError("");
      setMapRequest((request) => request + 1);
    }} aria-label="Arahkan peta ke lokasi saya">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.6 2.77-.08-.03a1.7 1.7 0 0 0-1.83.34l-.06.06h-3.2l-.03-.08a1.7 1.7 0 0 0-1.33-1.16 1.7 1.7 0 0 0-1.37.5l-.06.06-2.77-1.6.03-.08a1.7 1.7 0 0 0-.34-1.83l-.06-.06v-3.2l.08-.03a1.7 1.7 0 0 0 .82-2.7l-.06-.06 1.6-2.77.08.03a1.7 1.7 0 0 0 1.83-.34l.06-.06h3.2l.03.08a1.7 1.7 0 0 0 2.7.82l.06-.06 2.77 1.6-.03.08a1.7 1.7 0 0 0 .34 1.83l.06.06v3.2z" transform="translate(-1 -1) scale(1.08)"/></svg>
      <span>Lokasi saya</span>
    </button>
    <div className="passenger-map-status" aria-live="polite">
      {gpsError ? <span className="passenger-status-error">{gpsError}</span> : <span>{gpsMessage || `${vehicles.length} mobil aktif di peta`}</span>}
      {refreshError && <span className="passenger-status-error">{refreshError}</span>}
    </div>
    <section className="passenger-bottom-bar" aria-label="Ringkasan armada">
      <div className="passenger-fleet-summary"><strong>Ringkasan armada</strong><span>{vehicles.length} mobil aktif</span></div>
      <div className="passenger-vehicle-list" aria-label="Daftar mobil aktif">
      {vehicles.length === 0 ? <div className="passenger-no-vehicles">Belum ada mobil aktif</div> : vehicles.map((vehicle) => { const stale = isLocationStale(vehicle.locationTime, Date.now(), vehicle.demo); return <button
        type="button"
        className={`passenger-map-vehicle-card${stale ? " stale" : ""}`}
        key={vehicle.id}
        onClick={() => { setFocusVehicleId(vehicle.id); setVehicleFocusRequest((request) => request + 1); }}
        aria-label={`Arahkan peta ke ${vehicle.name}`}
      >
        <span className="passenger-vehicle-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.8L19 11M3 11h18v7H3zM6 18v2m12-2v2"/></svg></span>
        <span className="passenger-vehicle-card-details"><strong>{vehicle.name}</strong>{stale ? <span><i/>Aktif · lokasi {formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}</span> : <span><i/>Aktif · {formatSpeed(vehicle.speed, vehicle.speedAvailable)}</span>}<small>{vehicle.currentPassengers ?? "—"}/{vehicle.passengerCapacity ?? "—"} penumpang · {vehicle.driver || "Sopir belum diketahui"}</small></span>
        <span className="passenger-vehicle-card-arrow" aria-hidden="true">↗</span>
      </button>; })}
      </div>
    </section>
    {showLocationDialog && <div className="location-dialog-backdrop" role="presentation" onClick={() => setShowLocationDialog(false)}>
      <section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" onClick={(event) => event.stopPropagation()}>
        <span className="location-dialog-icon" aria-hidden="true">⌖</span>
        <h2 id="location-dialog-title">Aktifkan lokasi Anda</h2>
        <p>Lokasi Anda belum tersedia. Izinkan akses lokasi agar peta dapat menunjukkan posisi Anda. Browser akan meminta izin setelah Anda memilih lanjutkan.</p>
        <div className="location-dialog-actions">
          <button className="location-dialog-cancel" onClick={() => setShowLocationDialog(false)}>Nanti</button>
          <button className="location-dialog-confirm" onClick={() => {
            setGpsError("");
            setGpsMessage("Meminta akses lokasi perangkat…");
            setShowLocationDialog(false);
            setLocationRequest((request) => request + 1);
          }}>Lanjutkan</button>
        </div>
      </section>
    </div>}
  </main>;
}
