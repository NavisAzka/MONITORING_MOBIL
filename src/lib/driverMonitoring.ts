// Shared admin-side driver types and realtime status helpers (client-safe, no server imports).

export type DriverVehicle = {
  id: string;
  name: string;
  speed: number;
  speedAvailable: boolean;
  engine: string;
  latitude: number | null;
  longitude: number | null;
  locationTime: number;
  demo?: boolean;
  startedAt: number | null;
  sessionDistanceKm: number | null;
};

export type AdminDriver = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  vehicle: DriverVehicle | null;
};

export type LiveState = { key: "inactive" | "stale" | "driving" | "idle" | "parked"; label: string };

const STALE_SECONDS = 120;
const MAXTRACKER_WIB_OFFSET_SECONDS = 7 * 60 * 60;

// Maxtracker's live `locationtime` is observed to trail wall clock by seven hours.
// Adjust only for display/freshness checks; do not mutate the raw API value or demo timestamps.
export function adjustedLocationTime(unixSeconds: number, demo = false) {
  return unixSeconds && !demo ? unixSeconds + MAXTRACKER_WIB_OFFSET_SECONDS : unixSeconds;
}

// GPS position older than two minutes is shown as "last known" rather than live.
export function isLocationStale(locationTime: number, nowMs = Date.now(), demo = false) {
  const adjusted = adjustedLocationTime(locationTime, demo);
  return !adjusted || nowMs / 1000 - adjusted > STALE_SECONDS;
}

export function liveState(vehicle: DriverVehicle | null, nowMs = Date.now()): LiveState {
  if (!vehicle) return { key: "inactive", label: "Tidak aktif" };
  if (isLocationStale(vehicle.locationTime, nowMs, vehicle.demo)) return { key: "stale", label: "Aktif · GPS tidak diperbarui" };
  if (vehicle.speed > 0) return { key: "driving", label: "Sedang mengemudi" };
  if (vehicle.engine.toLowerCase() === "on") return { key: "idle", label: "Berhenti · mesin hidup" };
  return { key: "parked", label: "Aktif · parkir" };
}

export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} menit`;
  return `${hours} jam ${minutes % 60} menit`;
}

export function formatAgo(unixSeconds: number, nowMs = Date.now(), demo = false) {
  if (!unixSeconds) return "belum pernah";
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - adjustedLocationTime(unixSeconds, demo)));
  if (seconds < 60) return `${seconds} detik lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

const WIB_TIME_ZONE = "Asia/Jakarta";

export function formatWibTime(timestampMs: number) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB_TIME_ZONE }).format(new Date(timestampMs));
}

export function formatWibDateTime(timestampMs: number) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: WIB_TIME_ZONE }).format(new Date(timestampMs));
}

export function formatWibDate(timestamp: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: WIB_TIME_ZONE }).format(timestamp);
}

export function formatWibShortDate(timestamp: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: WIB_TIME_ZONE }).format(timestamp);
}

export function formatLocationTimestamp(unixSeconds: number, demo = false) {
  if (!unixSeconds) return "Waktu tidak tersedia";
  const timestampMs = adjustedLocationTime(unixSeconds, demo) * 1000;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: WIB_TIME_ZONE }).format(new Date(timestampMs));
}

export function formatSpeed(speed: number, available = true) {
  if (!available || !Number.isFinite(speed)) return "0 km/s";
  return `${Math.round(speed)} km/jam`;
}

export function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (value) => alphabet[value % alphabet.length]).join("");
}

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}
