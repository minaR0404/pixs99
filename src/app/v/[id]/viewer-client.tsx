"use client";

import { useState, useEffect, useCallback } from "react";

interface Image {
  url: string;
  original_url?: string;
  title: string;
  source?: string;
  width?: number;
  height?: number;
}

interface Props {
  id: string;
  query: string;
  images: Image[];
  createdAt: string;
  daysRemaining: number;
}

type Layout = "grid" | "masonry" | "list";

function BrandMark() {
  return (
    <span className="vw-brand-mark">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
        <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="#fff" opacity="0.7"  />
        <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.7"  />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
      </svg>
    </span>
  );
}

export default function ViewerClient({ id, query, images, createdAt, daysRemaining }: Props) {
  const [layout, setLayout]               = useState<Layout>("grid");
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [toastMsg, setToastMsg]           = useState<string | null>(null);
  const [loadedSet, setLoadedSet]         = useState<Set<number>>(new Set());

  const n = images.length;
  const cur = lightboxIdx !== null ? images[lightboxIdx] : null;

  function markLoaded(i: number) {
    setLoadedSet(prev => new Set([...prev, i]));
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1800);
  }

  function closeLightbox() { setLightboxIdx(null); }
  const prevImage = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + n) % n : 0), [n]);
  const nextImage = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % n : 0), [n]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  prevImage();
      if (e.key === "ArrowRight") nextImage();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, prevImage, nextImage]);

  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIdx]);

  function handleCopyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast("Link copied to clipboard");
  }

  const dateLabel = new Date(createdAt).toLocaleDateString("en-CA");
  const sourceHref = (src?: string) => {
    if (!src) return "#";
    return src.startsWith("http") ? src : `https://${src}`;
  };

  return (
    <div className="vw-page">
      {/* Topbar */}
      <div className="vw-topbar">
        <div className="vw-wrap vw-topbar-inner">
          <a href="/" className="vw-brand">
            <BrandMark />
            PixS99
          </a>
          <div className="vw-topbar-right">
            <span className="vw-viewer-id">{id}</span>
            <button className="vw-icon-btn" title="Copy link" onClick={handleCopyLink}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button className="vw-icon-btn" title="Share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            <a href="/dashboard" className="vw-btn vw-btn-ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="vw-wrap">
        <div className="vw-header">
          <div className="vw-header-row">
            <div>
              <span className="vw-eyebrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
                Search query
              </span>
              <h1 className="vw-query-title">{query}</h1>
              <div className="vw-query-meta">
                <span className="vw-query-meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <span><strong style={{ color: "var(--text)", fontWeight: 600 }}>{n}</strong> images</span>
                </span>
                <span className="vw-meta-dot" />
                <span className="vw-query-meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {dateLabel}
                </span>
                <span className="vw-meta-dot" />
                <span className="vw-query-meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {daysRemaining > 0 ? `Expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}` : "Expired"}
                </span>
              </div>
            </div>

            <div className="vw-header-actions">
              <button className="vw-btn vw-btn-ghost" onClick={() => showToast("Preparing zip…")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>
                </svg>
                Download all
              </button>
              <a href="/#demo" className="vw-btn vw-btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
                New search
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="vw-wrap">
        <div className="vw-toolbar">
          <div className="vw-results-count">
            Showing <strong>1–{n}</strong> of <strong>{n}</strong> results · sorted by <strong>relevance</strong>
          </div>
          <div className="vw-toolbar-controls">
            <div className="vw-seg">
              {([
                { key: "grid",    label: "Grid",    icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></> },
                { key: "masonry", label: "Masonry", icon: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></> },
                { key: "list",    label: "List",    icon: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></> },
              ] as { key: Layout; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                <button key={key} className={layout === key ? "active" : ""} onClick={() => setLayout(key)} title={label}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="vw-wrap" style={{ flex: 1 }}>
        <div className={`vw-gallery layout-${layout}`}>
          {images.map((img, i) => (
            <div
              key={i}
              className={`vw-img-card${loadedSet.has(i) ? " loaded" : ""}`}
              style={{ "--ar": `${img.width || 1} / ${img.height || 1}` } as React.CSSProperties}
              onClick={() => setLightboxIdx(i)}
            >
              <div className="vw-img-skel" />
              <span className="vw-img-num">{String(i + 1).padStart(2, "0")}</span>
              <img
                loading="lazy"
                src={img.url}
                alt={img.title}
                onLoad={() => markLoaded(i)}
                onError={() => markLoaded(i)}
              />
              <div className="vw-img-overlay">
                <h3>{img.title}</h3>
                <span className="src">{img.source}</span>
              </div>
              <div className="vw-list-meta">
                <h3>{img.title}</h3>
                <span className="src">{img.source}</span>
                {(img.width && img.height) && (
                  <span className="dim">
                    <span>{img.width} × {img.height}</span>
                    <span>JPEG</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <div
        className={`vw-lightbox${lightboxIdx !== null ? " show" : ""}`}
        onClick={e => { if (e.target === e.currentTarget) closeLightbox(); }}
      >
        <div className="vw-lightbox-stage">
          <button className="vw-lightbox-close" onClick={closeLightbox} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="vw-lightbox-img-wrap">
            <button className="vw-lightbox-nav prev" onClick={prevImage} title="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            {cur && <img src={cur.url} alt={cur.title} />}
            <button className="vw-lightbox-nav next" onClick={nextImage} title="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <div className="vw-lightbox-meta">
            <div className="vw-lightbox-meta-info">
              <h3>{cur?.title ?? "—"}</h3>
              <span className="src">{cur?.source ?? "—"}</span>
            </div>
            <div className="vw-lightbox-meta-actions">
              <span className="vw-lightbox-counter">
                {lightboxIdx !== null ? `${lightboxIdx + 1} / ${n}` : ""}
              </span>
              <a
                className="vw-btn vw-btn-ghost"
                href={cur ? sourceHref(cur.source) : "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open source
              </a>
              <button
                className="vw-btn vw-btn-primary"
                onClick={() => showToast("Download started")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`vw-toast${toastMsg ? " show" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>{toastMsg}</span>
      </div>

      {/* Footer */}
      <footer>
        <div className="vw-wrap vw-footer-inner">
          <span>
            Powered by <a href="/" className="brand-link">PixS99</a> · viewer URLs are immutable &amp; shareable
          </span>
          <div className="vw-footer-actions">
            <a href="#">Report</a>
            <a href="#">Privacy</a>
            <a href="/">Get your API key</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
