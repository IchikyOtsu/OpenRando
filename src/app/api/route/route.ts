import { NextResponse } from "next/server";

type Pt = [number, number]; // [lat, lon]

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const points = body.points as Pt[] | undefined;
    if (!points || points.length < 2) {
      return NextResponse.json({ error: "At least two waypoints required" }, { status: 400 });
    }

  const allCoords: Array<[number, number]> = []; // lon,lat
    let totalDistance = 0;
    let totalDuration = 0;

    // Haversine distance in meters
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371000; // earth radius meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // OSRM segment-by-segment with BRouter then straight-line fallback (all free, OSM-based)
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
  const profile = "walking";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coords: Array<[number, number]> = route.geometry.coordinates; // [lon,lat]
            // append, avoid duplicate join
            if (allCoords.length === 0) allCoords.push(...coords);
            else allCoords.push(...coords.slice(1));
            totalDistance += route.distance ?? 0;
            totalDuration += route.duration ?? 0;
            continue; // next segment
          }
        }
        // Fallback 1: BRouter (public, OSM-based)
        try {
          const brouterUrl = `https://brouter.de/brouter?profile=foot-hiking&format=geojson&lonlats=${a[1]},${a[0]}|${b[1]},${b[0]}`;
          const bres = await fetch(brouterUrl);
          if (bres.ok) {
            const bdata = await bres.json();
            let coords: Array<[number, number]> | undefined;
            if (bdata?.type === 'FeatureCollection') {
              const feat = bdata.features?.[0];
              coords = feat?.geometry?.coordinates as Array<[number, number]> | undefined;
            } else if (bdata?.type === 'Feature') {
              coords = bdata?.geometry?.coordinates as Array<[number, number]> | undefined;
            }
            if (coords && coords.length > 1) {
              if (allCoords.length === 0) allCoords.push(...coords);
              else allCoords.push(...coords.slice(1));
              // compute distance along returned coords
              let segDist = 0;
              for (let i2 = 1; i2 < coords.length; i2++) {
                const [lon1, lat1] = coords[i2 - 1];
                const [lon2, lat2] = coords[i2];
                segDist += haversine(lat1, lon1, lat2, lon2);
              }
              totalDistance += segDist;
              const walkingSpeedMps = 1.25; // ~4.5 km/h (estimation)
              totalDuration += segDist / walkingSpeedMps;
              continue; // next segment
            }
          }
        } catch {}

        // Fallback 2: straight line if both OSRM and BRouter fail or return no route
        const straight: Array<[number, number]> = [[a[1], a[0]], [b[1], b[0]]];
        if (allCoords.length === 0) allCoords.push(...straight);
        else allCoords.push(...straight.slice(1));
        const segDist = haversine(a[0], a[1], b[0], b[1]);
        totalDistance += segDist;
        const walkingSpeedMps = 1.25; // ~4.5 km/h
        totalDuration += segDist / walkingSpeedMps;
      } catch {
        // Network or fetch error: try BRouter, else straight line
        try {
          const brouterUrl = `https://brouter.de/brouter?profile=foot-hiking&format=geojson&lonlats=${a[1]},${a[0]}|${b[1]},${b[0]}`;
          const bres = await fetch(brouterUrl);
          if (bres.ok) {
            const bdata = await bres.json();
            let coords: Array<[number, number]> | undefined;
            if (bdata?.type === 'FeatureCollection') {
              const feat = bdata.features?.[0];
              coords = feat?.geometry?.coordinates as Array<[number, number]> | undefined;
            } else if (bdata?.type === 'Feature') {
              coords = bdata?.geometry?.coordinates as Array<[number, number]> | undefined;
            }
            if (coords && coords.length > 1) {
              if (allCoords.length === 0) allCoords.push(...coords);
              else allCoords.push(...coords.slice(1));
              // compute distance
              let segDist = 0;
              for (let i2 = 1; i2 < coords.length; i2++) {
                const [lon1, lat1] = coords[i2 - 1];
                const [lon2, lat2] = coords[i2];
                segDist += haversine(lat1, lon1, lat2, lon2);
              }
              totalDistance += segDist;
              const walkingSpeedMps = 1.25;
              totalDuration += segDist / walkingSpeedMps;
              continue;
            }
          }
        } catch {}

        const straight: Array<[number, number]> = [[a[1], a[0]], [b[1], b[0]]];
        if (allCoords.length === 0) allCoords.push(...straight);
        else allCoords.push(...straight.slice(1));
        const segDist = haversine(a[0], a[1], b[0], b[1]);
        totalDistance += segDist;
        const walkingSpeedMps = 1.25; // ~4.5 km/h
        totalDuration += segDist / walkingSpeedMps;
      }
    }

    // Compute elevation gain using Open-Elevation (sample if too many points)
    let elevationGain = 0;
    try {
      const maxSamples = 150; // avoid too many locations
      const step = Math.max(1, Math.floor(allCoords.length / maxSamples));
      const samples = allCoords.filter((_, idx) => idx % step === 0);
      const locations = samples.map((c) => `${c[1]},${c[0]}`).join("|"); // lat,lon
      const elevRes = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locations}`);
      if (elevRes.ok) {
        const elevData = await elevRes.json() as { results: Array<{ elevation: number }> };
        const elevations: number[] = elevData.results.map((r) => r.elevation);
        for (let i = 1; i < elevations.length; i++) {
          const d = elevations[i] - elevations[i - 1];
          if (d > 0) elevationGain += d;
        }
      }
    } catch {
      // ignore elevation errors
    }

    const geometry = { type: "LineString", coordinates: allCoords };
    return NextResponse.json({ geometry, distance: totalDistance, duration: totalDuration, elevationGain, pointsCount: points.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
