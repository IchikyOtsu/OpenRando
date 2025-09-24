import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const points = body.points as Array<[number, number]> | undefined;
    if (!points || points.length < 2) {
      return NextResponse.json({ error: "At least two points are required" }, { status: 400 });
    }

    // OSRM expects lon,lat pairs joined by ';'
    const coords = points.map((p) => `${p[1]},${p[0]}`).join(";");
    const profile = "foot"; // suitable for hiking; alternatives: walking, cycling
    const url = `https://router.project-osrm.org/match/v1/${profile}/${coords}?geometries=geojson&overview=full&steps=false`;

    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt }, { status: res.status });
    }

    const data = await res.json();
    // data.matchings is an array; take the first matching
    if (!data.matchings || data.matchings.length === 0) {
      return NextResponse.json({ error: "No matching route found" }, { status: 422 });
    }

    const geometry = data.matchings[0].geometry; // GeoJSON LineString
    return NextResponse.json({ geometry });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
