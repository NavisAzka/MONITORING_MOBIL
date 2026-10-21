import type { Vehicle } from "@/lib/types";
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";

type RawGpsDevice = Record<string, string | number | undefined>;
type ActiveAssignment = { vehicleId: string; driverId: string; driverName: string; startedAt: Date };

const { assignments, users, vehicles: vehicleTable } = schema;

async function activeAssignments(): Promise<ActiveAssignment[]> {
  const db = await getDb();
  return db.select({ vehicleId: assignments.vehicleId, driverId: assignments.driverId, driverName: users.name, startedAt: assignments.startedAt })
    .from(assignments).innerJoin(users, eq(users.id, assignments.driverId)).where(isNull(assignments.endedAt));
}

async function vehicleRows() {
  const db = await getDb();
  return db.select().from(vehicleTable);
}

const samples: Array<RawGpsDevice & { imei: string }> = [
  { imei: "3596331045888551", lat: "-7.2808", lng: "112.7935", speed: "0", engine: "On", gpssignal: "On", status: "PARK", batery: "Very High Battery", charge: "On", oil: "Connected", gsmsignal: "Strong Signal", gpslength: "8", gpssatelite: "14", odometer: "19310.96", fuel: "82", volt: "13.8", door: "Close", stnk: "2027-04-18", kir: "2027-01-20", paket: "2026-12-31" },
  { imei: "860465041935515", lat: "-7.2822", lng: "112.7950", speed: "18", engine: "On", gpssignal: "On", status: "RUN", batery: "High Battery", charge: "On", oil: "Connected", gsmsignal: "Strong Signal", gpslength: "9", gpssatelite: "12", odometer: "28540.20", fuel: "68", volt: "14.1", door: "Close", stnk: "2027-03-06", kir: "2027-02-11", paket: "2026-12-31" },
  { imei: "354018119695496", lat: "-7.2789", lng: "112.7967", speed: "0", engine: "Off", gpssignal: "On", status: "PARK", batery: "Very High Battery", charge: "Off", oil: "Connected", gsmsignal: "Strong Signal", gpslength: "7", gpssatelite: "15", odometer: "8740.55", fuel: "74", volt: "12.6", door: "Close", stnk: "2027-06-15", kir: "2027-05-02", paket: "2026-12-31" },
  { imei: "863396054982341", lat: "-7.2840", lng: "112.7928", speed: "12", engine: "On", gpssignal: "On", status: "RUN", batery: "High Battery", charge: "On", oil: "Connected", gsmsignal: "Medium Signal", gpslength: "11", gpssatelite: "10", odometer: "12004.30", fuel: "59", volt: "14.0", door: "Close", stnk: "2027-02-23", kir: "2027-04-30", paket: "2026-12-31" },
  { imei: "860465040650412", lat: "-7.2778", lng: "112.7938", speed: "0", engine: "Off", gpssignal: "Off", status: "PARK", batery: "Medium Battery", charge: "Off", oil: "Connected", gsmsignal: "Weak Signal", gpslength: "0", gpssatelite: "0", odometer: "39211.74", fuel: "42", volt: "12.1", door: "Close", stnk: "2027-05-14", kir: "2027-03-18", paket: "2026-12-31" },
];

// Demo locations stay close to the ITS Sukolilo campus.
const demoRoutes: Array<Array<[number, number]>> = [
  [[-7.2808,112.7935],[-7.2803,112.7941],[-7.2797,112.7946],[-7.2801,112.7951],[-7.2808,112.7945],[-7.2812,112.7939]],
  [[-7.2822,112.7950],[-7.2817,112.7957],[-7.2811,112.7962],[-7.2815,112.7968],[-7.2822,112.7961],[-7.2826,112.7955]],
  [[-7.2789,112.7967],[-7.2784,112.7961],[-7.2778,112.7956],[-7.2782,112.7950],[-7.2789,112.7957],[-7.2793,112.7963]],
  [[-7.2840,112.7928],[-7.2834,112.7934],[-7.2829,112.7940],[-7.2833,112.7946],[-7.2840,112.7940],[-7.2844,112.7934]],
  [[-7.2778,112.7938],[-7.2783,112.7932],[-7.2788,112.7927],[-7.2784,112.7921],[-7.2778,112.7927],[-7.2774,112.7933]],
];

function demoDevices(): RawGpsDevice[] {
  const tick = Math.floor(Date.now() / 15000);
  return samples.map((sample, index) => {
    const route = demoRoutes[index];
    const position = route[tick % route.length];
    const moving = (tick + index) % 3 !== 0;
    return {
      ...sample,
      lat: position[0].toFixed(6),
      lng: position[1].toFixed(6),
      speed: moving ? String(12 + ((tick + index) % 4) * 3) : "0",
      status: moving ? "RUN" : "PARK",
      locationtime: String(Math.floor(Date.now() / 1000)),
    };
  });
}

function text(value: unknown, fallback = "") {
  return value === undefined || value === null ? fallback : String(value).trim();
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasNumericValue(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return false;
  return Number.isFinite(Number(value));
}

function parseDevices(value: unknown): RawGpsDevice[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as RawGpsDevice[];
  if (value && typeof value === "object") return [value as RawGpsDevice];
  return [];
}

type GpsResult = { devices: RawGpsDevice[]; demo: boolean; unavailable: boolean };
const gpsState = globalThis as typeof globalThis & {
  gpsSnapshot?: { expires: number; value: GpsResult };
  gpsRequest?: Promise<GpsResult>;
};

async function fetchGpsDevices(): Promise<GpsResult> {
  const { MAXTRACKER_TOKEN, MAXTRACKER_USERNAME } = process.env;
  const baseUrl = (process.env.MAXTRACKER_BASE_URL || "https://maxtrackindo.com/openapi").replace(/\/$/, "");
  if (!MAXTRACKER_TOKEN || !MAXTRACKER_USERNAME) return { devices: demoDevices(), demo: true, unavailable: false };
  try {
    const url = new URL(`${baseUrl}/getdevice`);
    url.searchParams.set("token", MAXTRACKER_TOKEN);
    url.searchParams.set("username", MAXTRACKER_USERNAME);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Maxtracker returned ${response.status}`);
    const devices = parseDevices(await response.json());
    return devices.length ? { devices, demo: false, unavailable: false } : { devices: [], demo: false, unavailable: false };
  } catch {
    return { devices: demoDevices(), demo: true, unavailable: true };
  }
}

async function getGpsDevices(): Promise<GpsResult> {
  if (gpsState.gpsSnapshot && gpsState.gpsSnapshot.expires > Date.now()) return gpsState.gpsSnapshot.value;
  if (gpsState.gpsRequest) return gpsState.gpsRequest;
  const request = fetchGpsDevices();
  gpsState.gpsRequest = request;
  try {
    const result = await request;
    gpsState.gpsSnapshot = { value: result, expires: Date.now() + 10000 };
    return result;
  } finally {
    gpsState.gpsRequest = undefined;
  }
}

export async function getVehicleDetails(imei: string) {
  const gps = await getGpsDevices();
  const manual = (await vehicleRows()).find((item) => item.id === imei);
  let device = gps.devices.find((candidate) => text(candidate.imei) === imei);
  if (!device && !manual) return null;

  const { MAXTRACKER_TOKEN } = process.env;
  const baseUrl = (process.env.MAXTRACKER_BASE_URL || "https://maxtrackindo.com/openapi").replace(/\/$/, "");
  if (device && !gps.demo && MAXTRACKER_TOKEN) {
    try {
      const url = new URL(`${baseUrl}/getdevicebyimei`);
      url.searchParams.set("token", MAXTRACKER_TOKEN);
      url.searchParams.set("imei", imei);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const details = parseDevices(await response.json());
        device = details.find((candidate) => text(candidate.imei) === imei) ?? device;
      }
    } catch { /* Keep using the latest device-list data if the detail endpoint is unavailable. */ }
  }

  const { vehicles } = await listVehicles();
  const vehicle = vehicles.find((candidate) => candidate.id === imei);
  if (!vehicle) return null;
  const value = (key: string, fallback = "Tidak tersedia") => text(device?.[key], fallback) || fallback;
  return {
    vehicle,
    deviceStatus: value("status"),
    battery: value("batery"),
    charging: value("charge"),
    oil: value("oil"),
    gsmSignal: value("gsmsignal"),
    satellites: value("gpssatelite"),
    gpsAccuracy: value("gpslength"),
    gpsPositioned: value("gpspositioned", value("gpssignal")),
    odometer: value("odometer", "Tidak tersedia"),
    fuel: value("fuel", value("tank")),
    voltage: value("volt"),
    door: value("door"),
    stnk: value("stnk"),
    kir: value("kir"),
    packageExpiry: value("paket"),
  };
}

export async function listVehicles(): Promise<{ vehicles: Vehicle[]; demo: boolean; unavailable: boolean }> {
  const [gps, managed, active] = await Promise.all([getGpsDevices(), vehicleRows(), activeAssignments()]);
  const vehicles: Vehicle[] = gps.devices.map((device, index) => {
    const id = text(device.imei, `vehicle-${index + 1}`);
    const info = managed.find((item) => item.id === id);
    const assignment = active.find((item) => item.vehicleId === id);
    const locationTime = numeric(device.locationtime, gps.demo ? Math.floor(Date.now() / 1000) : 0);
    const latitude = numeric(device.lat, NaN);
    const longitude = numeric(device.lng, NaN);
    const validCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    return {
      id,
      name: info?.name ?? `Mobil ${index + 1}`,
      status: assignment ? "in_use" as const : "available" as const,
      driver: assignment?.driverName ?? null,
      driverId: assignment?.driverId ?? null,
      speed: numeric(device.speed),
      speedAvailable: hasNumericValue(device.speed),
      engine: text(device.engine, "Tidak diketahui"),
      latitude: validCoordinates ? latitude : null,
      longitude: validCoordinates ? longitude : null,
      locationTime,
      gpsSignal: text(device.gpssignal, "Tidak diketahui"),
      odometer: Number.isFinite(numeric(device.odometer, NaN)) ? numeric(device.odometer) : null,
      demo: gps.demo,
      passengerCapacity: info?.passengerCapacity ?? null,
      currentPassengers: info?.currentPassengers ?? null,
    };
  });
  for (const info of managed.filter((item) => !vehicles.some((vehicle) => vehicle.id === item.id))) {
    const assignment = active.find((item) => item.vehicleId === info.id);
    vehicles.push({ id: info.id, name: info.name, status: assignment ? "in_use" : "available", driver: assignment?.driverName ?? null,
      driverId: assignment?.driverId ?? null, speed: 0, speedAvailable: false, engine: "Tidak tersedia", latitude: null, longitude: null, locationTime: 0,
      gpsSignal: "Tidak tersedia", odometer: null, demo: false, passengerCapacity: info.passengerCapacity, currentPassengers: info.currentPassengers ?? null, manual: info.imei === null });
  }
  return { vehicles, demo: gps.demo, unavailable: gps.unavailable };
}

export async function createManagedVehicle(name: string, passengerCapacity: number | null, currentPassengers: number | null) {
  const db = await getDb();
  const [record] = await db.insert(vehicleTable).values({ id: `manual-${randomUUID()}`, imei: null, name, passengerCapacity, currentPassengers }).returning();
  return record;
}

// GPS vehicles get a database row the first time an admin edits them or a driver selects them.
async function ensureVehicleRow(id: string, name: string) {
  const db = await getDb();
  await db.insert(vehicleTable).values({ id, imei: id.startsWith("manual-") ? null : id, name }).onConflictDoNothing();
}

export async function updateManagedVehicle(id: string, name: string, passengerCapacity: number | null, currentPassengers: number | null) {
  const { vehicles } = await listVehicles();
  if (!vehicles.some((vehicle) => vehicle.id === id)) return false;
  await ensureVehicleRow(id, name);
  const db = await getDb();
  await db.update(vehicleTable).set({ name, passengerCapacity, currentPassengers, updatedAt: new Date() }).where(eq(vehicleTable.id, id));
  return true;
}

// Latest odometer (km) reported by the vehicle's GPS, from the shared short-lived snapshot.
export async function odometerOf(vehicleId: string) {
  const gps = await getGpsDevices();
  const value = numeric(gps.devices.find((device) => text(device.imei) === vehicleId)?.odometer, NaN);
  return Number.isFinite(value) ? value : null;
}

function isUniqueViolation(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

// A driver holds at most one vehicle; switching closes the previous assignment. The partial unique
// indexes reject a vehicle that another driver selected at the same moment.
export async function assignVehicle(vehicleId: string, driverId: string, vehicleName: string) {
  const db = await getDb();
  await ensureVehicleRow(vehicleId, vehicleName);
  await getGpsDevices(); // warm the snapshot so odometer reads inside the transaction hit the cache
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(assignments).where(and(eq(assignments.driverId, driverId), isNull(assignments.endedAt)));
      if (current?.vehicleId === vehicleId) return true;
      const [taken] = await tx.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.vehicleId, vehicleId), isNull(assignments.endedAt)));
      if (taken) return false;
      if (current) await tx.update(assignments).set({ endedAt: new Date(), endOdometer: await odometerOf(current.vehicleId) }).where(eq(assignments.id, current.id));
      await tx.insert(assignments).values({ driverId, vehicleId, startOdometer: await odometerOf(vehicleId) });
      return true;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function releaseDriverVehicle(driverId: string) {
  const db = await getDb();
  const current = await driverAssignment(driverId);
  if (!current) return;
  await db.update(assignments).set({ endedAt: new Date(), endOdometer: await odometerOf(current.vehicleId) })
    .where(and(eq(assignments.driverId, driverId), isNull(assignments.endedAt)));
}

// The driver's open assignment (vehicle and start time), or null.
export async function driverAssignment(driverId: string) {
  const db = await getDb();
  const [assignment] = await db.select({ vehicleId: assignments.vehicleId, startedAt: assignments.startedAt }).from(assignments)
    .where(and(eq(assignments.driverId, driverId), isNull(assignments.endedAt)));
  return assignment ?? null;
}
