"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap, ScaleControl } from "react-leaflet";
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
  const [routeColor, setRouteColor] = useState<string>("#16a34a");
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string] }>>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  function undo() {
    const newPts = points.slice(0, -1);
    setPoints(newPts);
    if (newPts.length < 2) {
      setRouted([]);
      setStats(null);
    }
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
  const [autoRoute, setAutoRoute] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'profile' | 'basemap'>('info');
  const [baseMap] = useState<'osm'>('osm');

  // Debounced search
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data?.results)) {
          setSuggestions(data.results);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function handleSelectSuggestion(s: { display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string] }) {
    setSearch(s.display_name);
    setShowSuggestions(false);
    if (!map) return;
    try {
      if (s.boundingbox && s.boundingbox.length === 4) {
        const [latMin, latMax, lonMin, lonMax] = s.boundingbox.map(parseFloat);
        const southWest: [number, number] = [latMin, lonMin];
        const northEast: [number, number] = [latMax, lonMax];
        (map as any).fitBounds([southWest, northEast], { padding: [40, 40] });
      } else {
        const lat = parseFloat(s.lat);
        const lon = parseFloat(s.lon);
        (map as any).setView([lat, lon], 14);
      }
    } catch {}
  }

  // whenever points change, if we have at least 2 points, request routing (if autoRoute)
  useEffect(() => {
    let cancelled = false;
    async function computeRoute() {
      if (!autoRoute) {
        setRouted([]);
        setStats(null);
        return;
      }
      if (points.length < 2) {
        setRouted([]);
        setStats(null);
        return;
      }
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
  }, [points, autoRoute]);

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
        <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
          <MapRefSetter onMap={(m) => setMap(m)} />
          {baseMap === 'osm' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <ScaleControl position="bottomleft" />
          <ClickHandler setPoints={setPoints} />
          {routed.length > 0 ? (
            <Polyline positions={routed} pathOptions={{ color: routeColor }} />
          ) : points.length > 0 ? (
            <Polyline positions={points} pathOptions={{ color: routeColor }} />
          ) : null}
          {points.map((pt, i) => (
            <CircleMarker key={i} center={pt} radius={5} pathOptions={{ color: "#065f46", fillColor: "#16a34a" }} />
          ))}
        </MapContainer>

      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/95 border-b shadow flex items-center gap-3 px-3 py-2">
        <button onClick={undo} className="px-2 py-1 rounded hover:bg-gray-100">↶ Annuler</button>
        <button onClick={clear} className="px-2 py-1 rounded hover:bg-gray-100">🗑️ Tout supprimer</button>
        <button onClick={exportGPX} className="px-2 py-1 rounded hover:bg-gray-100">⤓ Export GPX</button>
        <button onClick={downloadGeoJSON} className="px-2 py-1 rounded hover:bg-gray-100">{} GeoJSON</button>
        <div className="ml-auto" />
      </div>

      {/* Search box with suggestions */}
      <div className="absolute top-14 left-4 z-[1000] bg-white rounded shadow p-2 w-[300px]">
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Rechercher un endroit..."
          value={search}
          onChange={(e) => {
            const v = e.target.value;
            setSearch(v);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              const s = suggestions[0];
              if (s) handleSelectSuggestion(s);
            }
          }}
        />
        {searchLoading && <div className="text-xs text-gray-500 mt-1">Recherche…</div>}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="mt-2 max-h-64 overflow-auto border rounded text-sm bg-white">
            {suggestions.map((s, idx) => (
              <li key={idx}>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-gray-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectSuggestion(s)}
                  title={s.display_name}
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Route control bubble top-center */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow px-3 py-2 flex items-center gap-3">
        <span className="text-sm">Tracé automatique</span>
        <button
          onClick={() => setAutoRoute(!autoRoute)}
          className={`w-8 h-5 rounded-full transition-colors ${autoRoute ? 'bg-green-600' : 'bg-gray-300'}`}
          title="Activer/Désactiver le routage auto"
        >
          <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${autoRoute ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        {/* Bouton couleur du tracé */}
        <div className="relative">
          <button
            title="Choisir la couleur du tracé"
            className="w-5 h-5 rounded-full border"
            style={{ backgroundColor: routeColor }}
            onClick={() => setShowColorPicker((v) => !v)}
          />
          {showColorPicker && (
            <div className="absolute top-7 left-0 bg-white border rounded shadow p-2 flex gap-2 z-[1001]">
              {['#16a34a','#2563eb','#dc2626','#f59e0b','#7c3aed','#0ea5e9','#10b981','#111827'].map((c) => (
                <button
                  key={c}
                  className="w-5 h-5 rounded-full border"
                  style={{ backgroundColor: c }}
                  onClick={() => { setRouteColor(c); setShowColorPicker(false); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info overlay bottom-right */}
      <div className="absolute bottom-4 right-4 z-[1000] w-[320px] max-w-[90vw] bg-white/95 rounded-md shadow border">
        <div className="flex text-sm">
          <button className={`flex-1 px-3 py-2 border-b ${activeTab==='info' ? 'bg-white font-semibold' : 'bg-gray-50'}`} onClick={()=>setActiveTab('info')}>Informations</button>
          <button className={`flex-1 px-3 py-2 border-b ${activeTab==='profile' ? 'bg-white font-semibold' : 'bg-gray-50'}`} onClick={()=>setActiveTab('profile')}>Diagramme</button>
          <button className={`flex-1 px-3 py-2 border-b ${activeTab==='basemap' ? 'bg-white font-semibold' : 'bg-gray-50'}`} onClick={()=>setActiveTab('basemap')}>Fonds de carte</button>
        </div>
        <div className="p-3 text-sm text-gray-700">
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>Durée</div><div>{stats ? (stats.duration/3600).toFixed(2) : '0.00'} h</div>
              <div>Dénivelé +</div><div>{stats ? Math.round(stats.elevationGain) : 0} m</div>
              <div>Distance</div><div>{stats ? (stats.distance/1000).toFixed(2) : '0.00'} km</div>
              <div>Points</div><div>{stats ? stats.pointsCount : 0}</div>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="text-xs text-gray-500">Profil d'élévation à venir…</div>
          )}
          {activeTab === 'basemap' && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="basemap" checked readOnly /> OpenStreetMap
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
