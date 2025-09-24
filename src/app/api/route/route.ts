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

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
  const profile = "walking";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: txt }, { status: res.status });
      }
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) {
        return NextResponse.json({ error: 'No route found between points' }, { status: 422 });
      }
      const route = data.routes[0];
      const coords: Array<[number, number]> = route.geometry.coordinates; // [lon,lat]
      // append, avoid duplicate join
      if (allCoords.length === 0) allCoords.push(...coords);
      else allCoords.push(...coords.slice(1));
      totalDistance += route.distance ?? 0;
      totalDuration += route.duration ?? 0;
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
