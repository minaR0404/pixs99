// In-memory store for MVP — replace with DB (Supabase, etc.) later

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

const store = new Map<string, SearchResult>();

export function saveSearchResult(result: SearchResult): void {
  store.set(result.id, result);
}

export function getSearchResult(id: string): SearchResult | null {
  return store.get(id) ?? null;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
