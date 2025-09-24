"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent, Map as LeafletMap } from "leaflet";
import togpx from "togpx";

function ClickHandler({ setPoints }: { setPoints: (p: LatLngExpression[] | ((prev: LatLngExpression[]) => LatLngExpression[])) => void }) {
  useMapEvents({
    async click(e: LeafletMouseEvent) {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      try {
        const res = await fetch('/api/snap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon })
        });
        const data = await res.json();
        const snappedLat = (res.ok && typeof data?.lat === 'number') ? data.lat : lat;
        const snappedLon = (res.ok && typeof data?.lon === 'number') ? data.lon : lon;
        setPoints((prev: LatLngExpression[]) => [...prev, [snappedLat, snappedLon]]);
      } catch {
        setPoints((prev: LatLngExpression[]) => [...prev, [lat, lon]]);
      }
    },
  });
  return null;
}

export default function MapEditor() {
  const [points, setPoints] = useState<LatLngExpression[]>([]);
  const [map, setMap] = useState<LeafletMap | null>(null);

  function undo() {
    setPoints(points.slice(0, -1));
  }

  function clear() {
    setPoints([]);
    setRouted([]);
    setStats(null);
  }

  function downloadGeoJSON() {
    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: points.map((p) => [ (p as any)[1], (p as any)[0] ]),
      },
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportGPX() {
    if (points.length < 2) return;
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [ (p as any)[1], (p as any)[0] ]),
          },
        },
      ],
    };
    const gpx = togpx(geojson as any);
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.gpx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const [routed, setRouted] = useState<LatLngExpression[]>([]);
  const [stats, setStats] = useState<null | { distance: number; duration: number; elevationGain: number; pointsCount: number }>(null);

  // whenever points change, if we have at least 2 points, request routing
  useEffect(() => {
    let cancelled = false;
    async function computeRoute() {
      if (points.length < 2) return;
      try {
        const payload = points.map((p) => [(p as any)[0], (p as any)[1]]);
        const res = await fetch(`/api/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: payload }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("/api/route error", data);
          alert("Erreur API route: " + (data?.error || JSON.stringify(data)));
          return;
        }
        if (cancelled) return;
        if (data?.geometry?.coordinates) {
          const matched = (data.geometry.coordinates as Array<[number, number]>).map((c) => [c[1], c[0]] as LatLngExpression);
          setRouted(matched);
          setStats({ distance: data.distance ?? 0, duration: data.duration ?? 0, elevationGain: data.elevationGain ?? 0, pointsCount: data.pointsCount ?? points.length });
          // Fit the map to the routed geometry
          try {
            if (map && matched.length > 0) {
              (map as any).fitBounds(matched as any, { padding: [40, 40] });
            }
          } catch {}
        }
        else {
          console.warn('No geometry in /api/route response', data);
          alert('Aucun itinéraire généré (voir console)');
        }
      } catch (err) {
        // ignore
      }
    }
    computeRoute();
    return () => { cancelled = true; };
  }, [points]);

  const center: LatLngExpression = [46.8, 2.3];

  function MapRefSetter({ onMap }: { onMap: (m: LeafletMap) => void }) {
    const m = useMap();
    useEffect(() => {
      onMap(m);
    }, [m]);
    return null;
  }

  return (
    <div className="relative h-screen w-screen">
        <MapContainer center={center} zoom={6} className="h-full w-full">
          <MapRefSetter onMap={(m) => setMap(m)} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler setPoints={setPoints} />
          {routed.length > 0 ? (
            <Polyline positions={routed} pathOptions={{ color: "#16a34a" }} />
          ) : points.length > 0 ? (
            <Polyline positions={points} pathOptions={{ color: "#16a34a" }} />
          ) : null}
          {points.map((pt, i) => (
            <CircleMarker key={i} center={pt} radius={5} pathOptions={{ color: "#065f46", fillColor: "#16a34a" }} />
          ))}
        </MapContainer>

      {/* Controls overlay top-left */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-wrap gap-2 p-2 rounded bg-white/90 shadow">
        <button onClick={undo} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">Annuler</button>
        <button onClick={clear} className="px-3 py-2 rounded bg-red-50 hover:bg-red-100">Effacer</button>
        <button onClick={downloadGeoJSON} className="px-3 py-2 rounded bg-green-600 text-white hover:opacity-90">GeoJSON</button>
        <button onClick={exportGPX} className="px-3 py-2 rounded bg-amber-600 text-white hover:opacity-90">GPX</button>
      </div>

      {/* Info overlay bottom-right */}
      {stats && (
        <div className="absolute bottom-4 right-4 z-[1000] max-w-xs p-3 border rounded-md bg-white/90 dark:bg-gray-800/90 shadow">
          <div className="text-sm text-gray-700">
            <div><span className="font-semibold">Distance:</span> {(stats.distance / 1000).toFixed(2)} km</div>
            <div><span className="font-semibold">Durée estimée:</span> {(stats.duration / 3600).toFixed(2)} h</div>
            <div><span className="font-semibold">Dénivelé +:</span> {Math.round(stats.elevationGain)} m</div>
            <div><span className="font-semibold">Points:</span> {stats.pointsCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
