import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { driverAssignment, getVehicleDetails } from "@/lib/fleet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { imei: string } }) {
  const user = await sessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk untuk melihat detail kendaraan." }, { status: 401 });
  }
  if (!/^(?:\d{6,20}|manual-[a-f0-9-]{36})$/.test(params.imei)) {
    return NextResponse.json({ error: "Kendaraan tidak ditemukan." }, { status: 404 });
  }
  const detail = await getVehicleDetails(params.imei);
  if (!detail) return NextResponse.json({ error: "Kendaraan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({
    ...detail,
    viewer: {
      role: user.role,
      selectedVehicleId: user.role === "driver" ? (await driverAssignment(user.id))?.vehicleId ?? null : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
