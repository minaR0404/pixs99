import { NextRequest, NextResponse } from "next/server";
import { verifyUrl } from "@/lib/proxy";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!url || !sig) {
    return NextResponse.json({ error: "Missing url or sig" }, { status: 400 });
  }

  if (!verifyUrl(url, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PixS99/1.0",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_SIZE) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
