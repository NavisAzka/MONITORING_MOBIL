export type Role = "driver" | "passenger" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
};

export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type Vehicle = {
  id: string;
  name: string;
  status: "in_use" | "available";
  driver: string | null;
  driverId: string | null;
  speed: number;
  speedAvailable: boolean;
  engine: string;
  latitude: number | null;
  longitude: number | null;
  locationTime: number;
  gpsSignal: string;
  odometer: number | null;
  demo: boolean;
  passengerCapacity: number | null;
  currentPassengers: number | null;
  manual?: boolean;
};

export type VehicleDetails = {
  vehicle: Vehicle;
  deviceStatus: string;
  battery: string;
  charging: string;
  oil: string;
  gsmSignal: string;
  satellites: string;
  gpsAccuracy: string;
  gpsPositioned: string;
  odometer: string;
  fuel: string;
  voltage: string;
  door: string;
  stnk: string;
  kir: string;
  packageExpiry: string;
};
