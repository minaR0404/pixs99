"use client";

import { useState } from "react";

export default function Home() {
  const [apiKey] = useState("demo-key-xxx");

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
              IR
            </div>
            <span className="font-bold text-lg tracking-tight">ImgRelay</span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#demo" className="text-muted hover:text-foreground transition-colors">
              Demo
            </a>
            <a href="#docs" className="text-muted hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="#pricing" className="text-muted hover:text-foreground transition-colors">
              Pricing
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Search images.{" "}
            <span className="text-accent">Get a viewer URL.</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            One API call to search images and generate a shareable gallery page.
            Built for AI agents, bots, and developers.
          </p>
        </section>

        {/* Demo */}
        <section id="demo" className="space-y-6">
          <h2 className="text-xl font-semibold">Try it</h2>
          <DemoSection />
        </section>

        {/* How it works */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <StepCard
              step="1"
              title="API Call"
              description='POST /api/search with your query — e.g. "cute cats"'
            />
            <StepCard
              step="2"
              title="Viewer Generated"
              description="We search images and create a shareable gallery page instantly"
            />
            <StepCard
              step="3"
              title="Share the Link"
              description="Return the viewer URL to your users — one click to see all images"
            />
          </div>
        </section>

        {/* Code Example */}
        <section id="docs" className="space-y-6">
          <h2 className="text-xl font-semibold">Quick start</h2>
          <div className="rounded-lg bg-card border border-border p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-muted">
              <code>{`curl -X POST https://your-domain.com/api/search \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "tokyo skyline", "count": 10}'

# Response:
{
  "viewer_url": "https://your-domain.com/v/abc123",
  "images": [
    { "url": "https://...", "title": "...", "source": "..." },
    ...
  ]
}`}</code>
            </pre>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="space-y-6">
          <h2 className="text-xl font-semibold">Pricing</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <PricingCard
              tier="Free"
              price="$0"
              features={["50 searches / month", "Viewer pages (7-day TTL)", "Community support"]}
            />
            <PricingCard
              tier="Pro"
              price="$9"
              features={["2,000 searches / month", "Viewer pages (30-day TTL)", "API key dashboard", "Priority support"]}
              highlighted
            />
            <PricingCard
              tier="Growth"
              price="$29"
              features={["10,000 searches / month", "Viewer pages (90-day TTL)", "Custom branding", "Search history"]}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted">
          <span>ImgRelay &copy; {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/docs" className="hover:text-foreground transition-colors">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoSection() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    viewer_url: string;
    images: { url: string; title: string }[];
  } | null>(null);

  async function handleSearch() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, count: 8 }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      // ignore for demo
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder='Search images — e.g. "cute cats"'
          className="flex-1 rounded-lg bg-card border border-border px-4 py-2.5 text-foreground placeholder:text-muted"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Viewer URL:</span>
            <a
              href={result.viewer_url}
              target="_blank"
              className="text-accent hover:underline font-mono"
            >
              {result.viewer_url}
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {result.images.map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-card border border-border overflow-hidden"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-2">
      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
        {step}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function PricingCard({
  tier,
  price,
  features,
  highlighted,
}: {
  tier: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 space-y-4 ${
        highlighted
          ? "bg-accent/5 border-accent/30"
          : "bg-card border-border"
      }`}
    >
      <div>
        <h3 className="font-semibold">{tier}</h3>
        <p className="text-3xl font-bold mt-1">
          {price}
          <span className="text-sm font-normal text-muted">/mo</span>
        </p>
      </div>
      <ul className="space-y-2 text-sm text-muted">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-accent">+</span> {f}
          </li>
        ))}
      </ul>
      <button
        className={`w-full rounded-lg py-2 text-sm font-medium transition-opacity ${
          highlighted
            ? "bg-accent text-white hover:opacity-90"
            : "bg-border text-foreground hover:opacity-80"
        }`}
      >
        Get started
      </button>
    </div>
  );
}
