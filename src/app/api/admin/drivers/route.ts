import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { listVehicles } from "@/lib/fleet";
import { getDb, schema } from "@/db";
import { isNull } from "drizzle-orm";
import { createDriver, identityTaken, listDrivers } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function admin(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return { denied: NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 }) };
  if (session.role !== "admin") return { denied: NextResponse.json({ error: "Fitur ini hanya tersedia untuk admin." }, { status: 403 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const { denied } = await admin(request);
  if (denied) return denied;

  const db = await getDb();
  const [{ vehicles }, drivers, active] = await Promise.all([
    listVehicles(),
    listDrivers(),
    db.select().from(schema.assignments).where(isNull(schema.assignments.endedAt)),
  ]);
  return NextResponse.json({
    drivers: drivers.map((driver) => {
      const assignment = active.find((item) => item.driverId === driver.id);
      const vehicle = assignment ? vehicles.find((item) => item.id === assignment.vehicleId) : undefined;
      return {
        id: driver.id,
        name: driver.name,
        username: driver.username,
        email: driver.email ?? "",
        phone: driver.phone ?? "",
        address: driver.address ?? "",
        vehicle: vehicle && assignment ? {
          id: vehicle.id,
          name: vehicle.name,
          speed: vehicle.speed,
          speedAvailable: vehicle.speedAvailable,
          engine: vehicle.engine,
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
          locationTime: vehicle.locationTime,
          demo: vehicle.demo,
          startedAt: assignment.startedAt.getTime(),
          // Distance so far in this session, from the odometer recorded when it started.
          sessionDistanceKm: assignment.startOdometer !== null && vehicle.odometer !== null && vehicle.odometer >= assignment.startOdometer
            ? Math.round((vehicle.odometer - assignment.startOdometer) * 100) / 100 : null,
        } : null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

// Only admins can create driver accounts.
export async function POST(request: NextRequest) {
  const { denied, session } = await admin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";

  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Nama sopir wajib diisi (2–80 karakter)." }, { status: 400 });
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return NextResponse.json({ error: "Username 3–32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau tanda hubung." }, { status: 400 });
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "Kata sandi minimal 8 karakter." }, { status: 400 });
  if (phone && !/^[0-9+\-\s()]{6,40}$/.test(phone)) return NextResponse.json({ error: "Format nomor HP tidak valid." }, { status: 400 });

  if (await identityTaken(username)) return NextResponse.json({ error: "Username sudah dipakai akun lain." }, { status: 409 });
  if (await identityTaken(name)) return NextResponse.json({ error: "Nama ini sudah dipakai akun lain. Gunakan nama yang berbeda." }, { status: 409 });

  const driver = await createDriver({ name, username, password, phone, createdBy: session!.id });
  return NextResponse.json({ driver: { id: driver.id, name: driver.name, username: driver.username } }, { status: 201 });
}
