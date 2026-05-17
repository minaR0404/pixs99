import { NextRequest, NextResponse } from "next/server";
import { isIP } from "net";
import { verifyUrl } from "@/lib/proxy";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (ipVersion === 6) {
    return (
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:")
    );
  }

  return false;
}

function parseAllowedImageUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (isBlockedHostname(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!url || !sig) {
    return NextResponse.json({ error: "Missing url or sig" }, { status: 400 });
  }

  if (!verifyUrl(url, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const imageUrl = parseAllowedImageUrl(url);
  if (!imageUrl) {
    return NextResponse.json({ error: "URL is not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(imageUrl, {
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
