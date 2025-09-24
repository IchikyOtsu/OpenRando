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
    const results = (data as any[]).map((d) => ({
      display_name: d.display_name as string,
      lat: d.lat as string,
      lon: d.lon as string,
      boundingbox: d.boundingbox as [string, string, string, string] | undefined,
      type: d.type as string | undefined,
      class: d.class as string | undefined,
    }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
