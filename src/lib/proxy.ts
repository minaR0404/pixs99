import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "pixs99-proxy-fallback";
}

export function signUrl(url: string): string {
  return createHmac("sha256", getSecret()).update(url).digest("hex").slice(0, 16);
}

export function verifyUrl(url: string, sig: string): boolean {
  return signUrl(url) === sig;
}

export function proxyUrl(originalUrl: string, baseUrl: string): string {
  const sig = signUrl(originalUrl);
  return `${baseUrl}/api/img?url=${encodeURIComponent(originalUrl)}&sig=${sig}`;
}
