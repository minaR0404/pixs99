import { NextRequest, NextResponse } from "next/server";
import { saveSearchResult, generateId } from "@/lib/store";

// Mock image search for MVP — replace with real search (Serper, Google CSE, etc.)
function mockImageSearch(query: string, count: number) {
  const images = Array.from({ length: count }, (_, i) => ({
    url: `https://picsum.photos/seed/${encodeURIComponent(query)}-${i}/400/400`,
    title: `${query} — image ${i + 1}`,
    source: `https://example.com/source/${i}`,
  }));
  return images;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, count = 8 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const clampedCount = Math.min(Math.max(count, 1), 20);

    // Search images (mock for now)
    const images = mockImageSearch(query.trim(), clampedCount);

    // Save result and generate viewer page
    const id = generateId();
    const result = {
      id,
      query: query.trim(),
      images,
      created_at: new Date().toISOString(),
    };
    saveSearchResult(result);

    const baseUrl = req.nextUrl.origin;

    return NextResponse.json({
      viewer_url: `${baseUrl}/v/${id}`,
      id,
      query: query.trim(),
      images,
    });
  } catch {
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
