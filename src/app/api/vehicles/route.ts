import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { assignVehicle, listVehicles, releaseDriverVehicle } from "@/lib/fleet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "Silakan masuk untuk melihat armada." }, { status: 401 });
  if (user.role === "passenger") return NextResponse.json({ error: "Gunakan endpoint armada penumpang." }, { status: 403 });
  const result = await listVehicles();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await sessionFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (user.role !== "driver") return NextResponse.json({ error: "Hanya sopir yang dapat memilih mobil." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "release") {
    await releaseDriverVehicle(user.id);
    return NextResponse.json({ ok: true });
  }
  const vehicleId = String(body?.vehicleId ?? "");
  if (!vehicleId) return NextResponse.json({ error: "Pilih mobil terlebih dahulu." }, { status: 400 });
  const { vehicles } = await listVehicles();
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) {
    return NextResponse.json({ error: "Mobil tidak ditemukan." }, { status: 404 });
  }
  if (!(await assignVehicle(vehicleId, user.id, vehicle.name))) {
    return NextResponse.json({ error: "Mobil baru saja dipilih sopir lain. Silakan pilih mobil yang tidak aktif." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
