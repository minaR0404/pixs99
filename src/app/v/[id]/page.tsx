import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSearchResult } from "@/lib/store";
import { proxyUrl } from "@/lib/proxy";
import { headers } from "next/headers";
import ViewerClient from "./viewer-client";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const result = await getSearchResult(id);
  if (!result) return { title: "Not Found — PixS99" };
  const firstImage = result.images[0]?.url;
  return {
    title: `${result.query} — PixS99 Viewer`,
    description: `${result.images.length} images for "${result.query}"`,
    openGraph: {
      title: `${result.query} — PixS99`,
      description: `${result.images.length} images for "${result.query}"`,
      ...(firstImage ? { images: [{ url: firstImage }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title: `${result.query} — PixS99`,
      description: `${result.images.length} images for "${result.query}"`,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function ViewerPage({ params }: { params: Params }) {
  const { id } = await params;
  const result = await getSearchResult(id);
  if (!result) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const createdAt = new Date(result.created_at);
  const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const images = result.images.map(img => ({
    ...img,
    url: proxyUrl(img.url, baseUrl),
    original_url: img.url,
  }));

  return (
    <ViewerClient
      id={id}
      query={result.query}
      images={images}
      createdAt={result.created_at}
      daysRemaining={daysRemaining}
    />
  );
}
