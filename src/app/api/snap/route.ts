import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = body?.lat;
    const lon = body?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json({ error: 'lat and lon (numbers) are required' }, { status: 400 });
    }
    const profile = 'walking';
    const url = `https://router.project-osrm.org/nearest/v1/${profile}/${lon},${lat}?number=1`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt }, { status: res.status });
    }
    const data = await res.json();
    const wp = data?.waypoints?.[0];
    if (!wp || !wp.location) {
      return NextResponse.json({ error: 'No snap found' }, { status: 422 });
    }
    const [snappedLon, snappedLat] = wp.location as [number, number];
    return NextResponse.json({ lat: snappedLat, lon: snappedLon });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
