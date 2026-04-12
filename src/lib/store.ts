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

export async function saveSearchResult(result: SearchResult): Promise<void> {
  await sql`
    INSERT INTO search_results (id, query, images, created_at)
    VALUES (${result.id}, ${result.query}, ${JSON.stringify(result.images)}, ${result.created_at})
  `;
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
