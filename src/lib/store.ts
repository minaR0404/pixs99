import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface SearchImage {
  url: string;
  title: string;
  source?: string;
  width?: number;
  height?: number;
}

export interface SearchResult {
  id: string;
  query: string;
  images: SearchImage[];
  created_at: string;
}

export async function saveSearchResult(result: SearchResult, githubId?: string | null): Promise<void> {
  await sql`
    INSERT INTO search_results (id, query, images, created_at, github_id)
    VALUES (${result.id}, ${result.query}, ${JSON.stringify(result.images)}, ${result.created_at}, ${githubId ?? null})
  `;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  image_count: number;
  created_at: string;
}

export async function getSearchHistory(githubId: string, limit = 50, offset = 0): Promise<SearchHistoryItem[]> {
  const rows = await sql`
    SELECT id, query, jsonb_array_length(images) AS image_count, created_at
    FROM search_results
    WHERE github_id = ${githubId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    query: r.query as string,
    image_count: Number(r.image_count),
    created_at: r.created_at as string,
  }));
}

export async function getSearchResult(id: string): Promise<SearchResult | null> {
  const rows = await sql`
    SELECT id, query, images, created_at FROM search_results WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    query: row.query,
    images: row.images as SearchImage[],
    created_at: row.created_at,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
