import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { updateManagedVehicle } from "@/lib/fleet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Akses khusus admin." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawCapacity = body?.passengerCapacity;
  const capacity = rawCapacity === "" || rawCapacity == null ? null : Number(rawCapacity);
  const rawCurrent = body?.currentPassengers;
  const current = rawCurrent === "" || rawCurrent == null ? null : Number(rawCurrent);
  if (!name || name.length > 80) return NextResponse.json({ error: "Nama armada wajib diisi (maksimal 80 karakter)." }, { status: 400 });
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) return NextResponse.json({ error: "Kapasitas penumpang harus 1–100 orang." }, { status: 400 });
  if (current !== null && (!Number.isInteger(current) || current < 0 || current > 100 || (capacity !== null && current > capacity))) return NextResponse.json({ error: "Jumlah penumpang harus 0 atau lebih dan tidak boleh melebihi kapasitas." }, { status: 400 });
  const updated = await updateManagedVehicle(params.id, name, capacity, current);
  if (!updated) return NextResponse.json({ error: "Kendaraan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
