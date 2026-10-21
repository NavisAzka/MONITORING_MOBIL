"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { formatAgo, isLocationStale } from "@/lib/driverMonitoring";
import { formatSpeed } from "@/lib/driverMonitoring";
import type { Vehicle } from "@/lib/types";
import { ITS_MAP_CENTER, PASSENGER_MAP_BOUNDS } from "@/lib/mapBounds";

type Position = { latitude: number; longitude: number };

function vehicleIcon() {
  return L.divIcon({
    className: "passenger-vehicle-marker-wrap",
    html: '<div class="passenger-vehicle-marker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.8L19 11"/><path d="M3 11h18v7H3zM6 18v2m12-2v2"/></svg></div>',
    iconSize: [54, 58],
    iconAnchor: [27, 29],
    popupAnchor: [0, -26],
  });
}

const passengerIcon = L.divIcon({
  className: "passenger-position-marker-wrap",
  html: '<div class="passenger-position-marker"><span></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function MapPosition({ position, locateRequest, vehicles, focusVehicleId, focusRequest }: {
  position: Position | null;
  locateRequest: number;
  vehicles: Vehicle[];
  focusVehicleId: string;
  focusRequest: number;
}) {
  const map = useMap();
  const hadPosition = useRef(false);
  const handledRequest = useRef(locateRequest);
  const handledFocusRequest = useRef(focusRequest);

  useEffect(() => {
    if (position && !hadPosition.current) {
      map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
      hadPosition.current = true;
    }
  }, [map, position]);

  useEffect(() => {
    if (locateRequest === handledRequest.current || !position) return;
    map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
    handledRequest.current = locateRequest;
  }, [locateRequest, map, position]);

  useEffect(() => {
    if (focusRequest === handledFocusRequest.current) return;
    const vehicle = vehicles.find((item) => item.id === focusVehicleId);
    if (!vehicle || vehicle.latitude === null || vehicle.longitude === null) return;
    map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 17), { duration: 0.7 });
    handledFocusRequest.current = focusRequest;
  }, [focusRequest, focusVehicleId, map, vehicles]);

  return null;
}

export default function PassengerMap({ vehicles, position, locateRequest, focusVehicleId, focusRequest }: {
  vehicles: Vehicle[];
  position: Position | null;
  locateRequest: number;
  focusVehicleId: string;
  focusRequest: number;
}) {
  return <MapContainer center={ITS_MAP_CENTER} zoom={15} minZoom={15} maxZoom={19} zoomControl={false} maxBounds={PASSENGER_MAP_BOUNDS} maxBoundsViscosity={0.5} scrollWheelZoom className="passenger-leaflet-map">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
      maxNativeZoom={19}
    />
    <MapPosition position={position} locateRequest={locateRequest} vehicles={vehicles} focusVehicleId={focusVehicleId} focusRequest={focusRequest}/>
    {vehicles.map((vehicle) => {
      const stale = isLocationStale(vehicle.locationTime, Date.now(), vehicle.demo);
      return <Marker key={vehicle.id} position={[vehicle.latitude as number, vehicle.longitude as number]} icon={vehicleIcon()}>
      <Popup>
        <div className="passenger-vehicle-popup">
          <strong>{vehicle.name}</strong>
          {stale
            ? <span className="passenger-popup-status stale">Mobil aktif · lokasi terakhir {formatAgo(vehicle.locationTime, Date.now(), vehicle.demo)}</span>
            : <span className="passenger-popup-status">Mobil aktif</span>}
          <div><span>Kecepatan</span><b>{formatSpeed(vehicle.speed, vehicle.speedAvailable)}</b></div>
          <div><span>Penumpang</span><b>{vehicle.currentPassengers ?? "Belum diketahui"} / {vehicle.passengerCapacity ?? "Belum diatur"} orang</b></div>
          <div><span>Sopir</span><b>{vehicle.driver || "Belum diketahui"}</b></div>
        </div>
      </Popup>
    </Marker>;
    })}
    {position && <Marker position={[position.latitude, position.longitude]} icon={passengerIcon} zIndexOffset={1000}>
      <Popup><strong>Lokasi Anda</strong></Popup>
    </Marker>}
  </MapContainer>;
}
