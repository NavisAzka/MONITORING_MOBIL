"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Vehicle } from "@/lib/types";

export default function AdminFleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/vehicles", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Daftar armada tidak dapat dimuat.");
    setVehicles(result.vehicles);
  }

  useEffect(() => { load().catch((reason) => setError(reason.message)); }, []);

  async function saveVehicle(event: FormEvent<HTMLFormElement>, vehicle: Vehicle) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(vehicle.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/vehicles/${encodeURIComponent(vehicle.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), passengerCapacity: data.get("capacity") || null, currentPassengers: data.get("currentPassengers") || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Perubahan gagal disimpan.");
      setNotice(`Informasi ${String(data.get("name"))} berhasil disimpan.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setBusy(""); }
  }

  return <main className="admin-fleet-page">
    <header className="admin-fleet-header"><Link href="/login">← Kembali ke dashboard</Link><span>ADMIN · PENGELOLAAN ARMADA</span></header>
    <div className="admin-fleet-content"><div className="eyebrow">PENGELOLAAN ARMADA</div><h1>Kelola armada</h1><p className="profile-lead">Armada dimuat otomatis dari API. Anda dapat mengubah nama dan informasi kapasitas penumpang.</p>
      {error && <div className="action-error">{error}<button onClick={() => setError("")}>Tutup</button></div>}{notice && <div className="fleet-success">{notice}</div>}
      <section className="fleet-manage-list"><h2>Armada terdaftar <span>{vehicles.length}</span></h2>{vehicles.map((vehicle) => <form className="fleet-manage-card" key={vehicle.id} onSubmit={(event) => saveVehicle(event, vehicle)}><div className="fleet-manage-heading"><span className="fleet-car-symbol">▣</span><div><strong>{vehicle.name}</strong><small>{vehicle.manual ? "Kendaraan manual · tanpa GPS" : "Kendaraan terhubung GPS"}{vehicle.status === "in_use" ? ` · Aktif, dikendarai ${vehicle.driver || "sopir"}` : " · Tidak aktif"}</small></div></div><div className="fleet-form-fields"><label>Nama armada<input name="name" required maxLength={80} defaultValue={vehicle.name}/></label><label>Kapasitas penumpang<input name="capacity" type="number" min="1" max="100" defaultValue={vehicle.passengerCapacity ?? ""} placeholder="Belum diatur"/></label><label>Penumpang saat ini<input name="currentPassengers" type="number" min="0" max={vehicle.passengerCapacity ?? 100} defaultValue={vehicle.currentPassengers ?? ""} placeholder="Belum diperbarui"/></label><button disabled={busy !== ""}>{busy === vehicle.id ? "Menyimpan…" : "Simpan perubahan"}</button></div></form>)}</section>
    </div>
  </main>;
}
