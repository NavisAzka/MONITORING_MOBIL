"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { ITS_MAP_BOUNDS } from "@/lib/mapBounds";

function locationIcon() {
  return L.divIcon({
    className: "vehicle-marker-wrap",
    html: '<div class="vehicle-marker occupied"><span>●</span></div>',
    iconSize: [38, 42],
    iconAnchor: [19, 21],
    popupAnchor: [0, -18],
  });
}

function FollowVehicle({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([latitude, longitude], { animate: true, duration: 0.75 });
  }, [latitude, longitude, map]);
  return null;
}

export default function VehicleLocationMap({ latitude, longitude, label }: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  return <MapContainer center={[latitude, longitude]} zoom={17} minZoom={14} maxZoom={19} maxBounds={ITS_MAP_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom className="leaflet-map">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
      maxNativeZoom={19}
    />
    <FollowVehicle latitude={latitude} longitude={longitude}/>
    <Marker position={[latitude, longitude]} icon={locationIcon()}>
      <Popup><strong>{label}</strong></Popup>
    </Marker>
  </MapContainer>;
}
