"use client";

import { useState, useEffect } from "react";

const PALETTES = [
  ["#fb7185","#f43f5e"],["#60a5fa","#3b82f6"],["#34d399","#10b981"],
  ["#fbbf24","#f59e0b"],["#a78bfa","#8b5cf6"],["#22d3ee","#06b6d4"],
  ["#f472b6","#ec4899"],["#facc15","#eab308"],["#4ade80","#22c55e"],
  ["#818cf8","#6366f1"],["#fb923c","#f97316"],["#2dd4bf","#14b8a6"],
];

const CODE_SAMPLES: Record<string, string> = {
  curl: `<span class="tok-com"># Search and get a shareable viewer URL</span>
<span class="tok-key">curl</span> -X POST https://api.pixs99.io/v1/search \\
  -H <span class="tok-str">"Authorization: Bearer pixs99_demo-key-xxx"</span> \\
  -H <span class="tok-str">"Content-Type: application/json"</span> \\
  -d <span class="tok-str">'{"query": "tokyo skyline", "count": <span class="tok-num">10</span>}'</span>

<span class="tok-com"># Response</span>
{
  <span class="tok-key">"viewer_url"</span>: <span class="tok-str">"https://pixs99.io/v/abc123"</span>,
  <span class="tok-key">"images"</span>: [
    { <span class="tok-key">"url"</span>: <span class="tok-str">"https://..."</span>, <span class="tok-key">"title"</span>: <span class="tok-str">"..."</span>, <span class="tok-key">"source"</span>: <span class="tok-str">"..."</span> },
    ...
  ]
}`,
  js: `<span class="tok-com">// Search and get a shareable viewer URL</span>
<span class="tok-key">const</span> res = <span class="tok-key">await</span> <span class="tok-fn">fetch</span>(<span class="tok-str">"https://api.pixs99.io/v1/search"</span>, {
  method: <span class="tok-str">"POST"</span>,
  headers: {
    <span class="tok-str">"Authorization"</span>: <span class="tok-str">\`Bearer \${process.env.PIXS99_KEY}\`</span>,
    <span class="tok-str">"Content-Type"</span>: <span class="tok-str">"application/json"</span>,
  },
  body: <span class="tok-fn">JSON</span>.<span class="tok-fn">stringify</span>({ query: <span class="tok-str">"tokyo skyline"</span>, count: <span class="tok-num">10</span> }),
});

<span class="tok-key">const</span> { viewer_url, images } = <span class="tok-key">await</span> res.<span class="tok-fn">json</span>();
<span class="tok-fn">console</span>.<span class="tok-fn">log</span>(viewer_url); <span class="tok-com">// → https://pixs99.io/v/abc123</span>`,
  py: `<span class="tok-com"># Search and get a shareable viewer URL</span>
<span class="tok-key">import</span> requests, os

res = requests.<span class="tok-fn">post</span>(
    <span class="tok-str">"https://api.pixs99.io/v1/search"</span>,
    headers={
        <span class="tok-str">"Authorization"</span>: <span class="tok-str">f"Bearer {os.environ['PIXS99_KEY']}"</span>,
    },
    json={<span class="tok-str">"query"</span>: <span class="tok-str">"tokyo skyline"</span>, <span class="tok-str">"count"</span>: <span class="tok-num">10</span>},
)

data = res.<span class="tok-fn">json</span>()
<span class="tok-fn">print</span>(data[<span class="tok-str">"viewer_url"</span>])  <span class="tok-com"># → https://pixs99.io/v/abc123</span>`,
};

const FAQ_ITEMS = [
  { q: "What image sources does PixS99 search?", a: "We aggregate across multiple licensed image providers and the open web. Every result includes source attribution and a direct link back to the origin." },
  { q: "How long do viewer URLs stay live?", a: "7 days on Free, 30 days on Pro, and unlimited on Ultra. Expired pages return a clean 410 Gone with a notice — never a broken link." },
  { q: "Can I host my own image collections?", a: "Yes. Pro and Ultra plans support custom collections — upload up to 1M images and query them with the same /v1/search endpoint." },
  { q: "Do you store the queries my users send?", a: "Queries are logged for 30 days for debugging and analytics, then deleted. No PII is collected. SOC 2 audit available on request." },
  { q: "Is there a free trial of Pro?", a: "Yes — every new account gets a 14-day Pro trial automatically. No credit card required to start." },
];

function BrandMark() {
  return (
    <span className="lp-brand-mark">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#fff" opacity="0.7" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.7" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
      </svg>
    </span>
  );
}

function CheckIcon({ size = 24, strokeWidth = 2.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  const [demoQuery, setDemoQuery] = useState("tokyo skyline");
  const [thumbs, setThumbs] = useState<Array<{ c1: string; c2: string; delay: number }>>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"curl" | "js" | "py">("curl");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function runDemo(query?: string) {
    const q = (query ?? demoQuery).trim() || "tokyo skyline";
    setShowResults(false);
    setShowUrl(false);
    setThumbs([]);
    setSearchKey(k => k + 1);

    setTimeout(() => {
      const newThumbs = Array.from({ length: 12 }, (_, i) => {
        const c = PALETTES[(q.length * 7 + i) % PALETTES.length];
        return { c1: c[0], c2: c[1], delay: i * 30 };
      });
      setThumbs(newThumbs);
      setShowResults(true);
      const slug = q.replace(/\s+/g, "").toLowerCase().slice(0, 4) + Math.random().toString(36).slice(2, 6);
      setTimeout(() => { setViewerUrl(`https://pixs99.io/v/${slug}`); setShowUrl(true); }, 200);
    }, 250);
  }

  useEffect(() => { setTimeout(() => runDemo(), 400); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCopy() {
    if (viewerUrl) {
      navigator.clipboard?.writeText(viewerUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="lp-page">
      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <a href="#" className="lp-brand">
            <BrandMark />
            PixS99
          </a>
          <div className="lp-nav-links">
            <a href="#demo">Demo</a>
            <a href="#docs">Docs</a>
            <a href="#pricing">Pricing</a>
            <a href="/dashboard" className="lp-btn lp-btn-primary">Dashboard</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-hero-pill">
            <span className="tag">NEW</span>
            <span>v2 — Faster search, custom collections</span>
          </div>
          <h1>Search images.<br /><span className="accent">Get a viewer URL.</span></h1>
          <p className="lede">One API call to search images and generate a shareable gallery page. Built for AI agents, bots, and developers.</p>
          <div className="lp-hero-cta">
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-lg">
              Try it free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <a href="#docs" className="lp-btn lp-btn-ghost lp-btn-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              Read docs
            </a>
          </div>

          {/* Live demo */}
          <div className="lp-demo" id="demo">
            <div className="lp-demo-bar">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                id="demoInput"
                type="text"
                placeholder='Search images — e.g. "tokyo skyline"'
                value={demoQuery}
                onChange={e => setDemoQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runDemo()}
              />
              <button className="lp-btn lp-btn-primary" onClick={() => runDemo()}>Search</button>
            </div>
            <div key={searchKey} className={`lp-demo-results${showResults ? " show" : ""}`}>
              {thumbs.map((t, i) => (
                <div
                  key={i}
                  className="lp-demo-thumb"
                  style={{ "--c1": t.c1, "--c2": t.c2, animationDelay: `${t.delay}ms` } as React.CSSProperties}
                />
              ))}
            </div>
            <div className={`lp-viewer-url${showUrl ? " show" : ""}`}>
              <span className="label">200 OK</span>
              <span className="url-text">{viewerUrl}</span>
              <button className="lp-copy-btn" onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</button>
            </div>
          </div>
        </div>
      </header>

      {/* Trust strip */}
      <div className="lp-wrap">
        <div className="lp-trust">
          {["99.95% uptime", "Sub-200ms p95", "Edge-cached worldwide", "No PII stored"].map(item => (
            <div key={item} className="lp-trust-item">
              <CheckIcon size={14} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section>
        <div className="lp-wrap">
          <div className="lp-section-head">
            <span className="lp-section-eyebrow">How it works</span>
            <h2 className="lp-section-title">From query to gallery in one call</h2>
            <p className="lp-section-sub">No SDKs to install, no infra to run. Just a single endpoint that searches the web, hosts the results, and hands you back a link.</p>
          </div>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-step-num">01</div>
              <h3>Send a query</h3>
              <p>POST <code style={{ fontFamily: "var(--font-mono)", fontSize: "12.5px", color: "var(--text)" }}>/v1/search</code> with a natural-language query — e.g. &ldquo;cute cats&rdquo;, &ldquo;tokyo skyline at dusk&rdquo;.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">02</div>
              <h3>We build the viewer</h3>
              <p>PixS99 searches across image sources, ranks results, and generates a hosted gallery page on our edge in milliseconds.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">03</div>
              <h3>Share the URL</h3>
              <p>You receive a short viewer URL plus the raw image data. Pass it to your users — one click and they see everything.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-features">
            {[
              { icon: "zap",       title: "Built for agents",       desc: "Single-call design fits LLM tool-use patterns. Returns both URL and structured data." },
              { icon: "globe",     title: "Global edge",            desc: "Viewer pages and image proxies cached at 12 PoPs. Sub-200ms first paint anywhere." },
              { icon: "lock",      title: "Bring your keys",        desc: "Per-key rate limits, IP allowlists, and full audit logs. Rotate or revoke anytime." },
              { icon: "image",     title: "Custom collections",     desc: "Upload your own image sets and search them with the same API. Up to 1M images per collection." },
              { icon: "activity",  title: "Live observability",     desc: "Per-endpoint metrics, error logs, and replay. See every request in your dashboard." },
              { icon: "shield",    title: "SOC 2 ready",            desc: "Encrypted in transit and at rest. No image data stored beyond TTL. GDPR compliant." },
            ].map(f => (
              <div key={f.title} className="lp-feature">
                <div className="lp-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon === "zap"      && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                    {f.icon === "globe"    && <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" /></>}
                    {f.icon === "lock"     && <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>}
                    {f.icon === "image"    && <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></>}
                    {f.icon === "activity" && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
                    {f.icon === "shield"   && <path d="M12 22s-8-4.5-8-12V5l8-3 8 3v5c0 7.5-8 12-8 12z" />}
                  </svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code section */}
      <section id="docs">
        <div className="lp-wrap">
          <div className="lp-code-section">
            <div className="lp-code-side">
              <span className="lp-section-eyebrow">Quick start</span>
              <h2>One endpoint.<br />That&rsquo;s the whole API.</h2>
              <p>Authenticate with a Bearer token, send a query, get a viewer URL plus the structured image array. No webhooks, no polling.</p>
              <ul className="lp-code-feature-list">
                {[
                  { strong: "Synchronous response", rest: " — viewer ready before the call returns" },
                  { strong: "Stable URLs", rest: " — viewer pages are immutable; safe to share & cache" },
                  { strong: "Predictable shape", rest: " — JSON schema versioned, never breaks" },
                  { strong: "Source attribution", rest: " — every image carries provenance" },
                ].map(item => (
                  <li key={item.strong}>
                    <CheckIcon size={16} strokeWidth={2.5} />
                    <span><strong>{item.strong}</strong>{item.rest}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-code-block-wrap">
              <div className="lp-code-tabs">
                {(["curl", "js", "py"] as const).map(lang => (
                  <button
                    key={lang}
                    className={`lp-code-tab${activeTab === lang ? " active" : ""}`}
                    onClick={() => setActiveTab(lang)}
                  >
                    {lang === "curl" ? "curl" : lang === "js" ? "JavaScript" : "Python"}
                  </button>
                ))}
              </div>
              <pre
                className="lp-code-block"
                dangerouslySetInnerHTML={{ __html: CODE_SAMPLES[activeTab] }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <span className="lp-section-eyebrow">Pricing</span>
            <h2 className="lp-section-title">Simple. Pay for what you search.</h2>
            <p className="lp-section-sub">Start free. Upgrade when your bot finds product-market fit. No seat fees, no hidden costs.</p>
          </div>

          <div className="lp-plan-grid">
            {[
              {
                name: "Free", price: "$0", desc: "For prototyping & personal projects.", featured: false,
                features: ["10 searches / day","50 searches / month","Viewer pages (7-day TTL)","Community support"],
              },
              {
                name: "Pro", price: "$19", desc: "For builders shipping real products.", featured: true,
                features: ["70 searches / day","2,000 searches / month","Viewer pages (30-day TTL)","API key dashboard","Priority support"],
              },
              {
                name: "Ultra", price: "$49", desc: "For high-traffic apps & agencies.", featured: false,
                features: ["350 searches / day","10,000 searches / month","Viewer pages (Unlimited TTL)","Custom branding","Search history & analytics"],
              },
            ].map(plan => (
              <div key={plan.name} className={`lp-plan-card${plan.featured ? " featured" : ""}`}>
                {plan.featured && <span className="lp-plan-tag">Most popular</span>}
                <p className="lp-plan-name">{plan.name}</p>
                <p className="lp-plan-price">{plan.price}<small>/mo</small></p>
                <p className="lp-plan-desc">{plan.desc}</p>
                <ul className="lp-plan-features">
                  {plan.features.map(f => (
                    <li key={f}><CheckIcon size={14} strokeWidth={2.5} />{f}</li>
                  ))}
                </ul>
                <a href="#" className={`lp-btn ${plan.featured ? "lp-btn-primary" : "lp-btn-ghost"}`}>Get started</a>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", color: "var(--text-mute)", fontSize: "13px", marginTop: "32px" }}>
            Need more? <a href="#" style={{ color: "var(--accent)" }}>Contact us</a> for enterprise pricing with SSO, on-prem cache, and custom SLAs.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-section-head">
            <span className="lp-section-eyebrow">FAQ</span>
            <h2 className="lp-section-title">Questions, answered.</h2>
          </div>
          <div className="lp-faq">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`lp-faq-item${openFaq === i ? " open" : ""}`}>
                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                </button>
                <div className="lp-faq-a">
                  <div className="lp-faq-a-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-cta-banner">
            <h2>Ship image search this afternoon.</h2>
            <p>Free forever for hobby projects. 5 minutes to integrate.</p>
            <div style={{ display: "inline-flex", gap: "10px" }}>
              <a href="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">Get an API key</a>
              <a href="#docs" className="lp-btn lp-btn-ghost lp-btn-lg">Read the docs</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="lp-wrap">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <a href="#" className="lp-brand">
                <BrandMark />
                PixS99
              </a>
              <p>One API call to search images and generate a shareable gallery page.</p>
            </div>
            <div className="lp-footer-col">
              <h4>Product</h4>
              <a href="#demo">Demo</a>
              <a href="#pricing">Pricing</a>
              <a href="/dashboard">Dashboard</a>
              <a href="#">Changelog</a>
            </div>
            <div className="lp-footer-col">
              <h4>Developers</h4>
              <a href="#docs">API Reference</a>
              <a href="#">Quickstart</a>
              <a href="#">Status</a>
              <a href="#">Open source</a>
            </div>
            <div className="lp-footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Contact</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>PixS99 &copy; 2026 — All rights reserved.</span>
            <span>Made for AI agents and the developers who love them.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
