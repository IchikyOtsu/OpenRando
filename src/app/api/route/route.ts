import { NextResponse } from "next/server";

type Pt = [number, number]; // [lat, lon]

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const points = body.points as Pt[] | undefined;
    if (!points || points.length < 2) {
      return NextResponse.json({ error: "At least two waypoints required" }, { status: 400 });
    }

    let allCoords: Array<[number, number]> = []; // lon,lat
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
        // Fallback: straight line if OSRM fails or returns no route
        const straight: Array<[number, number]> = [[a[1], a[0]], [b[1], b[0]]];
        if (allCoords.length === 0) allCoords.push(...straight);
        else allCoords.push(...straight.slice(1));
        const segDist = haversine(a[0], a[1], b[0], b[1]);
        totalDistance += segDist;
        const walkingSpeedMps = 1.25; // ~4.5 km/h
        totalDuration += segDist / walkingSpeedMps;
      } catch {
        // Network or fetch error: fallback to straight line
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
        const elevData = await elevRes.json();
        const elevations: number[] = elevData.results.map((r: any) => r.elevation as number);
        for (let i = 1; i < elevations.length; i++) {
          const d = elevations[i] - elevations[i - 1];
          if (d > 0) elevationGain += d;
        }
      }
    } catch (e) {
      // ignore elevation errors
    }

    const geometry = { type: "LineString", coordinates: allCoords };
    return NextResponse.json({ geometry, distance: totalDistance, duration: totalDuration, elevationGain, pointsCount: points.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
