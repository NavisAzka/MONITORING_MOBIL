"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Vehicle } from "@/lib/types";
import { ITS_MAP_BOUNDS, ITS_MAP_CENTER } from "@/lib/mapBounds";

function markerIcon(occupied: boolean) {
  return L.divIcon({
    className: "vehicle-marker-wrap",
    html: `<div class="vehicle-marker ${occupied ? "occupied" : "free"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.8L19 11"/><path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01"/></svg></div>`,
    iconSize: [38, 42],
    iconAnchor: [19, 21],
    popupAnchor: [0, -18],
  });
}

// Flies to the requested vehicle and opens its popup; each new request number triggers one move.
function MapFocus({ vehicles, focusVehicleId, focusRequest, markers }: { vehicles: Vehicle[]; focusVehicleId: string; focusRequest: number; markers: React.MutableRefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  const handled = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest === handled.current) return;
    handled.current = focusRequest;
    const vehicle = vehicles.find((item) => item.id === focusVehicleId);
    if (!vehicle || vehicle.latitude === null || vehicle.longitude === null) return;
    map.once("moveend", () => markers.current.get(vehicle.id)?.openPopup());
    map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 17), { duration: 0.7 });
  }, [focusRequest, focusVehicleId, map, markers, vehicles]);
  return null;
}

export default function VehicleMap({ vehicles, focusVehicleId = "", focusRequest = 0 }: { vehicles: Vehicle[]; focusVehicleId?: string; focusRequest?: number }) {
  const markers = useRef(new Map<string, L.Marker>());
  const mapped = vehicles.filter((vehicle) => vehicle.latitude !== null && vehicle.longitude !== null
    && vehicle.latitude >= ITS_MAP_BOUNDS[0][0] && vehicle.latitude <= ITS_MAP_BOUNDS[1][0]
    && vehicle.longitude! >= ITS_MAP_BOUNDS[0][1] && vehicle.longitude! <= ITS_MAP_BOUNDS[1][1]);

  return <MapContainer center={ITS_MAP_CENTER} zoom={15} minZoom={14} maxZoom={19} maxBounds={ITS_MAP_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom className="leaflet-map">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
      maxNativeZoom={19}
    />
    <MapFocus vehicles={mapped} focusVehicleId={focusVehicleId} focusRequest={focusRequest} markers={markers}/>
    {mapped.map((vehicle) => <Marker key={vehicle.id} ref={(marker) => { if (marker) markers.current.set(vehicle.id, marker); else markers.current.delete(vehicle.id); }} position={[vehicle.latitude as number, vehicle.longitude as number]} icon={markerIcon(vehicle.status === "in_use")}>
      <Popup><strong>{vehicle.name}</strong><br />{vehicle.status === "in_use" ? `Aktif · ${vehicle.driver ? `dikendarai ${vehicle.driver}` : "sedang dipakai sopir"}` : "Tidak aktif"}<br />Penumpang <strong>{vehicle.currentPassengers ?? "–"}/{vehicle.passengerCapacity ?? "–"}</strong></Popup>
    </Marker>)}
  </MapContainer>;
}
