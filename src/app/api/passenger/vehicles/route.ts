import { NextResponse } from "next/server";
import { listVehicles } from "@/lib/fleet";
import type { Vehicle } from "@/lib/types";
import { ITS_MAP_CENTER } from "@/lib/mapBounds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await listVehicles();
  // Active vehicles stay visible even when their GPS is stale; the client marks them as "last known location".
  const vehicles = result.vehicles.filter((vehicle) => vehicle.status === "in_use"
    && vehicle.latitude !== null && vehicle.longitude !== null);
  // A local-only marker for UI testing. It never enters the Maxtracker data or production response.
  if (process.env.NODE_ENV !== "production") {
    const testVehicle: Vehicle = {
      id: "test-vehicle-its",
      name: "Mobil Uji",
      status: "in_use",
      driver: "Sopir Uji",
      driverId: null,
      speed: 8,
      speedAvailable: true,
      engine: "On",
      latitude: ITS_MAP_CENTER[0] - 0.0005,
      longitude: ITS_MAP_CENTER[1] + 0.0004,
      locationTime: Math.floor(Date.now() / 1000),
      gpsSignal: "Uji",
      odometer: null,
      demo: true,
      passengerCapacity: 4,
      currentPassengers: 2,
      manual: true,
    };
    vehicles.push(testVehicle);
  }

  return NextResponse.json({ vehicles, demo: result.demo, unavailable: result.unavailable }, {
    headers: { "Cache-Control": "no-store" },
  });
}
