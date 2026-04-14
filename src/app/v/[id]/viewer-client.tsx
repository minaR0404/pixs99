"use client";

import { useState } from "react";

interface Image {
  url: string;
  original_url?: string;
  title: string;
  source?: string;
  width?: number;
  height?: number;
}

export default function ViewerClient({ images }: { images: Image[] }) {
  const [selected, setSelected] = useState<Image | null>(null);

  return (
    <>
      {/* Image Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(img)}
            className="group aspect-square rounded-lg bg-card border border-border overflow-hidden hover:border-accent/50 transition-colors"
          >
            <img
              src={img.url}
              alt={img.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "";
                (e.target as HTMLImageElement).alt = "Image unavailable";
                (e.target as HTMLImageElement).className =
                  "w-full h-full flex items-center justify-center bg-card text-muted text-xs";
              }}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected.url}
              alt={selected.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-white/80">{selected.title}</span>
              {selected.source && (
                <a
                  href={selected.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Source
                </a>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              x
            </button>
          </div>
        </div>
      )}
    </>
  );
}
