import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        // Provide a basic User-Agent per Nominatim policy
        "User-Agent": "OpenRando/0.1 (https://github.com/IchikyOtsu/OpenRando)",
        "Accept-Language": "fr",
      },
      // Less strict caching to be nice to the service
      // cache: 'force-cache',
    });
    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: res.status });
    }
    const data = await res.json();
    // Normalize minimal fields used client-side
    interface NominatimResult {
      display_name: string;
      lat: string;
      lon: string;
      boundingbox?: [string, string, string, string];
      type?: string;
      class?: string;
    }
    const results = (data as NominatimResult[]).map((d) => ({
      display_name: d.display_name,
      lat: d.lat,
      lon: d.lon,
      boundingbox: d.boundingbox,
      type: d.type,
      class: d.class,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
