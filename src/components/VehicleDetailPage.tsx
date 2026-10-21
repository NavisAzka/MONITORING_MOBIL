"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Role, VehicleDetails } from "@/lib/types";
import { formatSpeed } from "@/lib/driverMonitoring";
import { formatLocationTimestamp } from "@/lib/driverMonitoring";

const VehicleLocationMap = dynamic(() => import("@/components/VehicleLocationMap"), {
  ssr: false,
  loading: () => <div className="detail-map-placeholder">Memuat peta lokasi…</div>,
});

type DetailResponse = VehicleDetails & {
  viewer: { role: Role; selectedVehicleId: string | null };
  error?: string;
};

async function fetchVehicleDetail(imei: string): Promise<DetailResponse> {
  const response = await fetch(`/api/vehicles/${encodeURIComponent(imei)}`, { cache: "no-store" });
  const result: DetailResponse = await response.json();
  if (!response.ok) throw new Error(result.error || "Detail kendaraan tidak dapat dimuat.");
  return result;
}

function DetailIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    back: <><path d="m15 18-6-6 6-6"/><path d="M20 12H9"/></>,
    car: <><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.8L19 11"/><path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    signal: <><path d="M2 20h.01M7 20v-4m5 4v-8m5 8V8m5 12V4"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    battery: <><rect x="3" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M7 10v4m4-4v4"/></>,
    fuel: <><path d="M3 22V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v17M3 12h13M6 7h7"/><path d="M16 8h2l3 3v7a2 2 0 0 1-4 0v-4"/></>,
    door: <><path d="M5 21V4l14-2v19M3 21h18M15 12h.01"/></>,
    compass: <><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.8 5.6-5.6 2.8 2.8-5.6 5.6-2.8Z"/></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.car}</svg>;
}

function Field({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return <div className="detail-field"><span>{label}</span><strong>{value || "Tidak tersedia"}{unit && value ? <small> {unit}</small> : null}</strong></div>;
}

export default function VehicleDetailPage({ imei }: { imei: string }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    fetchVehicleDetail(imei)
      .then((result) => { if (active) setDetail(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); })
      .finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => {
      fetchVehicleDetail(imei).then((result) => { if (active) setDetail(result); }).catch(() => undefined);
    }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [imei]);

  async function chooseThisVehicle() {
    setSelecting(true);
    setActionError("");
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: imei }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Mobil gagal dipilih.");
      setDetail(await fetchVehicleDetail(imei));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Mobil gagal dipilih.");
    } finally {
      setSelecting(false);
    }
  }

  if (loading) return <main className="detail-state"><div className="loader-mark"><DetailIcon name="car"/></div>Memuat detail mobil…</main>;
  if (error || !detail) return <main className="detail-state"><div className="detail-error-card"><div className="eyebrow">DETAIL KENDARAAN</div><h1>{error || "Kendaraan tidak ditemukan"}</h1><p>Pastikan Anda sudah masuk di dashboard, lalu buka kembali tautan detail kendaraan.</p><Link href="/" className="detail-back-button"><DetailIcon name="back"/> Kembali ke dashboard</Link></div></main>;

  const { vehicle } = detail;
  const dashboardHref = detail.viewer.role === "passenger" ? "/" : "/login";
  const gpsPositioned = detail.gpsPositioned === "1" ? "Terkunci" : detail.gpsPositioned === "0" ? "Belum terkunci" : detail.gpsPositioned;

  return <main className="detail-shell">
    <header className="detail-topbar"><Link href={dashboardHref} className="detail-back-link"><DetailIcon name="back"/> Dashboard</Link><span className="detail-top-label">ITS Buggy Car <i>•</i> DETAIL ARMADA</span></header>
    <div className="detail-content">
      {vehicle.demo && <div className="notice notice-demo"><span className="notice-symbol">i</span><span>Menampilkan detail data contoh untuk pratinjau.</span><span className="notice-label">DATA CONTOH</span></div>}
      <div className="detail-heading"><div><div className="eyebrow">KAMPUS ITS SUKOLILO · SURABAYA</div><h1>Detail kendaraan<span className="heading-period">.</span></h1><p>Informasi kendaraan dan pembacaan perangkat GPS.</p></div><span className={`vehicle-status detail-status ${vehicle.status === "in_use" ? "status-occupied" : "status-available"}`}><i/>{status}</span></div>
      <section className="detail-hero"><div className="detail-car-icon"><DetailIcon name="car"/></div><div className="detail-hero-title"><h2>{vehicle.name}</h2><div className="detail-driver">{vehicle.driver ? `Sopir: ${vehicle.driver}` : "Belum dipilih oleh sopir"}</div></div><div className="detail-hero-actions">{detail.viewer.role === "driver" && detail.viewer.selectedVehicleId === null && vehicle.status === "available" && <button className="detail-select-button" onClick={chooseThisVehicle} disabled={selecting}>{selecting ? "Memilih…" : "Pilih mobil"}</button>}{detail.viewer.role === "driver" && detail.viewer.selectedVehicleId === vehicle.id && <span className="detail-selected-label">Mobil pilihan Anda</span>}{detail.viewer.role === "driver" && detail.viewer.selectedVehicleId && detail.viewer.selectedVehicleId !== vehicle.id && <span className="detail-other-selection">Anda sudah memilih mobil lain. <Link href={dashboardHref}>Lihat dashboard</Link></span>}</div><div className="detail-last-seen"><span><DetailIcon name="clock"/> GPS terakhir</span><strong>{formatLocationTimestamp(vehicle.locationTime, vehicle.demo)}</strong></div></section>

      {actionError && <div className="action-error detail-action-error">{actionError}<button onClick={() => setActionError("")}>Tutup</button></div>}

      <section className="detail-map-card"><div className="detail-map-heading"><div><h3>Lokasi mobil</h3><p>Posisi terkini kendaraan</p></div><span><DetailIcon name="pin"/> KAMPUS ITS</span></div>{vehicle.latitude !== null && vehicle.longitude !== null ? <div className="detail-map-frame"><VehicleLocationMap latitude={vehicle.latitude} longitude={vehicle.longitude} label={vehicle.name}/></div> : <div className="detail-map-placeholder">Koordinat lokasi mobil belum tersedia.</div>}</section>

      <div className="detail-grid">
        <section className="detail-card"><div className="detail-card-heading"><span className="detail-heading-icon icon-blue"><DetailIcon name="car"/></span><div><h3>Status kendaraan</h3><p>Status penggunaan dan mesin</p></div></div><div className="detail-fields"><Field label="Penumpang saat ini" value={vehicle.currentPassengers ?? "Belum diperbarui"} unit={vehicle.currentPassengers !== null ? "orang" : undefined}/><Field label="Kapasitas penumpang" value={vehicle.passengerCapacity ?? "Belum diatur"} unit={vehicle.passengerCapacity ? "orang" : undefined}/><Field label="Status mobil" value={detail.deviceStatus}/><Field label="Mesin" value={vehicle.engine}/><Field label="Kecepatan" value={formatSpeed(vehicle.speed, vehicle.speedAvailable)}/><Field label="Odometer" value={detail.odometer} unit={detail.odometer === "Tidak tersedia" ? undefined : "km"}/></div></section>
        <section className="detail-card"><div className="detail-card-heading"><span className="detail-heading-icon icon-green"><DetailIcon name="pin"/></span><div><h3>Lokasi & GPS</h3><p>Posisi dan kualitas sinyal</p></div></div><div className="detail-fields"><Field label="Lintang" value={vehicle.latitude ?? "Tidak tersedia"}/><Field label="Bujur" value={vehicle.longitude ?? "Tidak tersedia"}/><Field label="Sinyal GPS" value={vehicle.gpsSignal}/><Field label="Status posisi" value={gpsPositioned}/><Field label="Satelit" value={detail.satellites}/><Field label="Panjang GPS" value={detail.gpsAccuracy} unit={detail.gpsAccuracy === "Tidak tersedia" ? undefined : "m"}/></div>{vehicle.latitude !== null && vehicle.longitude !== null && <a className="map-link" href={`https://www.openstreetmap.org/?mlat=${vehicle.latitude}&mlon=${vehicle.longitude}#map=18/${vehicle.latitude}/${vehicle.longitude}`} target="_blank" rel="noreferrer"><DetailIcon name="pin"/> Buka lokasi di OpenStreetMap</a>}</section>
        <section className="detail-card"><div className="detail-card-heading"><span className="detail-heading-icon icon-amber"><DetailIcon name="battery"/></span><div><h3>Kondisi kendaraan</h3><p>Baterai dan indikator kendaraan</p></div></div><div className="detail-fields"><Field label="Baterai" value={detail.battery}/><Field label="Pengisian" value={detail.charging}/><Field label="Tegangan" value={detail.voltage} unit={detail.voltage === "Tidak tersedia" ? undefined : "V"}/><Field label="Bahan bakar" value={detail.fuel} unit={detail.fuel === "Tidak tersedia" ? undefined : "%"}/><Field label="Pintu" value={detail.door}/><Field label="Oli" value={detail.oil}/><Field label="Sinyal GSM" value={detail.gsmSignal}/></div></section>
      </div>
      <footer className="detail-footer"><span>ITS Buggy Car <i>•</i> DATA BERASAL DARI MAXTRACKER</span><span>Pembaruan mengikuti perangkat GPS</span></footer>
    </div>
  </main>;
}
