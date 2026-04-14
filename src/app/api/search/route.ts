import { NextRequest, NextResponse } from "next/server";
import { saveSearchResult, generateId, SearchImage } from "@/lib/store";
import { validateApiKey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage";
import { proxyUrl } from "@/lib/proxy";

async function searchImages(query: string, count: number): Promise<SearchImage[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: count }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status}`);
  }

  const data = await res.json();
  return (data.images ?? []).slice(0, count).map((img: { imageUrl: string; title: string; link: string; imageWidth?: number; imageHeight?: number }) => ({
    url: img.imageUrl,
    title: img.title,
    source: img.link,
    width: img.imageWidth,
    height: img.imageHeight,
  }));
}

export async function POST(req: NextRequest) {
  try {
    // Demo requests (from landing page) skip auth via Referer check
    const referer = req.headers.get("referer") ?? "";
    const isDemo = referer.includes(req.nextUrl.origin);

    let rateLimitKey: string;
    let rateLimitType: "demo" | "api";
    let githubId: string | null = null;

    if (!isDemo) {
      const authHeader = req.headers.get("authorization") ?? "";
      const key = authHeader.replace(/^Bearer\s+/i, "");
      const result = await validateApiKey(key);
      if (!key || !result.valid) {
        return NextResponse.json(
          { error: "Invalid or missing API key" },
          { status: 401 }
        );
      }
      githubId = result.githubId;
      rateLimitKey = key;
      rateLimitType = "api";
    } else {
      rateLimitKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimitType = "demo";
    }

    const remaining = await checkRateLimit(rateLimitKey, rateLimitType);
    if (remaining < 0) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again tomorrow." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { query, count = 8 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const clampedCount = Math.min(Math.max(count, 1), 20);

    const images = await searchImages(query.trim(), clampedCount);

    const id = generateId();
    const result = {
      id,
      query: query.trim(),
      images,
      created_at: new Date().toISOString(),
    };
    await saveSearchResult(result, githubId);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    logUsage({
      query: query.trim(),
      imageCount: images.length,
      isDemo,
      apiKey: isDemo ? undefined : rateLimitKey,
      ip,
    });

    const baseUrl = req.nextUrl.origin;
    const imagesWithProxy = images.map((img) => ({
      ...img,
      proxy_url: proxyUrl(img.url, baseUrl),
    }));

    return NextResponse.json({
      viewer_url: `${baseUrl}/v/${id}`,
      id,
      query: query.trim(),
      images: imagesWithProxy,
    });
  } catch {
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
