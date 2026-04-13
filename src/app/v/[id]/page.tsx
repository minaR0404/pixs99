import { notFound } from "next/navigation";
import { getSearchResult } from "@/lib/store";
import ViewerClient from "./viewer-client";

type Params = Promise<{ id: string }>;

export default async function ViewerPage({ params }: { params: Params }) {
  const { id } = await params;
  const result = await getSearchResult(id);

  if (!result) {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="PixS99" className="w-8 h-8" />
            <span className="font-bold text-lg tracking-tight">PixS99</span>
          </a>
          <span className="text-xs text-muted font-mono">{id}</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{result.query}</h1>
            <p className="text-sm text-muted">
              {result.images.length} images found
            </p>
          </div>
          <span className="text-xs text-muted">
            {new Date(result.created_at).toLocaleDateString()}
          </span>
        </div>

        <ViewerClient images={result.images} />
      </main>

      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-5xl mx-auto text-xs text-muted">
          Powered by <a href="/" className="text-accent hover:underline">PixS99</a>
        </div>
      </footer>
    </div>
  );
}
