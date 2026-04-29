"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  is_active: boolean;
  created_at: string;
}

interface HistoryItem {
  id: string;
  query: string;
  image_count: number;
  created_at: string;
}

type Tab = "overview" | "keys" | "history" | "plan";
type Plan = "free" | "pro" | "ultra";

interface SubscriptionInfo {
  currentPeriodEnd: number;
  cancelAt: number | null;
}

interface Usage {
  today: number;
  thisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
}

// ── Static mock data ───────────────────────────────────────────────────────
const MOCK_SPARK: number[][] = [
  [100,115,108,120,112,128,115,130,118,135,122,118,128,140,132,145,138,150,142,155],
  [80,90,85,95,88,98,92,102,95,88,98,105,100,110,105,115,108,120,112,118],
  [90,85,92,88,95,82,88,84,90,86,92,88,84,90,86,82,88,84,80,78],
  [30,28,32,35,28,25,30,32,38,35,28,32,35,40,35,30,38,42,38,35],
];
const MOCK_STATS = [
  { label: "Total requests", value: "847,392", delta: "+12.4%", trend: "up" as const, icon: "activity" },
  { label: "Images served",  value: "2.1M",    delta: "+8.2%",  trend: "up" as const, icon: "image"    },
  { label: "Avg latency",    value: "184ms",   delta: "−6.1%",  trend: "up" as const, icon: "zap"      },
  { label: "Error rate",     value: "0.12%",   delta: "+0.03%", trend: "down" as const, icon: "alert"  },
];
const MOCK_DAYS = [
  25000,27500,24000,28000,26500,29000,27000,30000,28500,31000,
  29000,32500,30500,33000,31500,35000,32500,36000,34000,37500,
  35000,38500,36000,40000,37500,38000,39500,41000,39000,42000,
];
const MOCK_ENDPOINTS = [
  { method: "GET",  path: "/v1/search",         count: "412,983" },
  { method: "GET",  path: "/v1/images/{id}",    count: "284,210" },
  { method: "POST", path: "/v1/search/similar", count: "98,471"  },
  { method: "GET",  path: "/v1/collections",    count: "32,108"  },
  { method: "POST", path: "/v1/embeddings",     count: "19,620"  },
];
const CURL_EXAMPLE = `curl https://api.pixs99.io/v1/search \\
  -H "Authorization: Bearer pixs99_6767b55a..." \\
  -d '{"query": "sunset over Tokyo skyline", "limit": 24}'`;

const ACCENT_COLORS = {
  indigo: { accent: "#6366f1", soft: "#4f46e5", glow: "rgba(99,102,241,0.18)" },
  cyan:   { accent: "#06b6d4", soft: "#0891b2", glow: "rgba(6,182,212,0.18)"  },
  teal:   { accent: "#14b8a6", soft: "#0d9488", glow: "rgba(20,184,166,0.18)" },
  orange: { accent: "#f97316", soft: "#ea580c", glow: "rgba(249,115,22,0.18)" },
  violet: { accent: "#8b5cf6", soft: "#7c3aed", glow: "rgba(139,92,246,0.18)" },
};

const PLAN_LABELS: Record<Plan, string> = { free: "Free", pro: "Pro", ultra: "Ultra" };
const TAB_TITLES: Record<Tab, string> = {
  overview: "Overview",
  keys:     "API Keys",
  history:  "Search History",
  plan:     "Plan & Billing",
};

// ── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ data, color = "var(--db-accent)", height = 40, id }: {
  data: number[]; color?: string; height?: number; id: string;
}) {
  if (!data.length) return null;
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
         style={{ width: "100%", height: h, display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── AreaChart ──────────────────────────────────────────────────────────────
function AreaChart({ data }: { data: number[] }) {
  const w = 600, h = 200, px = 8, py = 14;
  const iw = w - px * 2, ih = h - py * 2;
  const max = Math.max(...data) * 1.1;
  const pts = data.map((v, i) => [
    px + (i / (data.length - 1)) * iw,
    py + ih - (v / max) * ih,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L ${w - px},${h - py} L ${px},${h - py} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="db-chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="var(--db-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--db-accent)" stopOpacity="0"    />
        </linearGradient>
      </defs>
      {[0,1,2,3,4].map(i => {
        const y = py + (i / 4) * ih;
        return <line key={i} x1={px} x2={w - px} y1={y} y2={y}
          stroke="var(--db-border)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          strokeDasharray={i === 4 ? "" : "2 3"} />;
      })}
      <path d={area} fill="url(#areaGrad)" />
      <path d={path} fill="none" stroke="var(--db-accent)" strokeWidth="2"
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--db-accent)"
              stroke="var(--bg-elev)" strokeWidth="2" />
    </svg>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} className={className ?? "db-btn db-btn-ghost"} style={{ flexShrink: 0 }}>
      {copied ? (
        <>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 7l3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" />
            <path d="M9.5 4.5V2.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1H4.5" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Tweaks panel ───────────────────────────────────────────────────────────
function TweaksPanel({
  theme, setTheme, accent, setAccent, showSidebar, setShowSidebar, onClose,
}: {
  theme: string; setTheme: (t: string) => void;
  accent: string; setAccent: (a: string) => void;
  showSidebar: boolean; setShowSidebar: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="db-twk-panel">
      <div className="db-twk-hd">
        <b>Tweaks</b>
        <button className="db-twk-x" onClick={onClose}>✕</button>
      </div>
      <div className="db-twk-body">
        <div className="db-twk-sect">Theme</div>
        <div className="db-twk-row">
          <div className="db-twk-lbl">Mode</div>
          <div className="db-twk-seg">
            <div className="db-twk-seg-thumb" style={{
              left: theme === "dark" ? "2px" : "calc(50% + 1px)",
              width: "calc(50% - 3px)",
            }} />
            <button onClick={() => setTheme("dark")}
                    style={{ fontWeight: theme === "dark" ? 600 : 400 }}>Dark</button>
            <button onClick={() => setTheme("light")}
                    style={{ fontWeight: theme === "light" ? 600 : 400 }}>Light</button>
          </div>
        </div>
        <div className="db-twk-row">
          <div className="db-twk-lbl">Accent</div>
          <select className="db-twk-field" value={accent} onChange={e => setAccent(e.target.value)}>
            <option value="indigo">Indigo</option>
            <option value="cyan">Cyan</option>
            <option value="teal">Teal</option>
            <option value="orange">Orange</option>
            <option value="violet">Violet</option>
          </select>
        </div>
        <div className="db-twk-sect">Layout</div>
        <div className="db-twk-row db-twk-row-h">
          <div className="db-twk-lbl">Show sidebar</div>
          <button className="db-twk-toggle" data-on={showSidebar ? "1" : "0"}
                  onClick={() => setShowSidebar(!showSidebar)}><i /></button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DashboardClient({
  plan, subscription, usage, user, signOutSlot,
}: {
  plan: Plan;
  subscription: SubscriptionInfo | null;
  usage: Usage;
  user?: { name: string; image: string };
  signOutSlot?: React.ReactNode;
}) {
  const [tab, setTab]               = useState<Tab>("overview");
  const [theme, setTheme]           = useState<string>("dark");
  const [accent, setAccent]         = useState<string>("indigo");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTweaks, setShowTweaks] = useState(false);
  const [keys, setKeys]             = useState<ApiKey[]>([]);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const c = ACCENT_COLORS[accent as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.indigo;
    document.documentElement.style.setProperty("--db-accent", c.accent);
    document.documentElement.style.setProperty("--accent-soft", c.soft);
    document.documentElement.style.setProperty("--accent-glow", c.glow);
  }, [accent]);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    const data = await res.json();
    setKeys(data.keys ?? []);
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetch("/api/history");
    const data = await res.json();
    setHistory(data.history ?? []);
    setHistoryLoading(false);
    setHistoryFetched(true);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("upgraded")) {
      window.history.replaceState({}, "", "/dashboard");
      setTab("plan");
    }
  }, []);

  useEffect(() => {
    if (tab === "history" && !historyFetched) fetchHistory();
  }, [tab, historyFetched, fetchHistory]);

  async function handleCreate() {
    if (!newKeyName.trim() || creating) return;
    setCreating(true);
    setCreatedKey(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (data.key) { setCreatedKey(data.key); setNewKeyName(""); fetchKeys(); }
    setCreating(false);
  }

  async function handleRevoke(id: string) {
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchKeys();
  }

  const userName = user?.name ?? "Dashboard";

  return (
    <div className="db-shell">
      {showSidebar && (
        <nav className="db-sidebar">
          {/* Brand */}
          <div className="db-brand">
            <div className="db-brand-mark">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
                <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="#fff" opacity="0.7"  />
                <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.7"  />
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#fff" opacity="0.95" />
              </svg>
            </div>
            <span className="db-brand-name">PixS99</span>
          </div>

          <span className="db-nav-label">Workspace</span>

          {(["overview", "keys", "history", "plan"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className={`db-nav-item${tab === t ? " active" : ""}`}>
              <svg className="db-nav-icon" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {t === "overview" && <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V9.5z"/></>}
                {t === "keys"     && <><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4l3 3-3 3-3-3"/><path d="M15 9l3 3"/></>}
                {t === "history"  && <><path d="M3 12a9 9 0 109-9 9 9 0 00-6.7 3L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>}
                {t === "plan"     && <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></>}
              </svg>
              {TAB_TITLES[t]}
            </button>
          ))}

          <span className="db-nav-label">Resources</span>

          <button className="db-nav-item">
            <svg className="db-nav-icon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <path d="M14 2v6h6M9 13h6M9 17h4"/>
            </svg>
            Documentation
            <svg style={{ width: 12, height: 12, marginLeft: "auto", opacity: 0.5, flexShrink: 0 }}
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>

          <button className="db-nav-item">
            <svg className="db-nav-icon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>
            </svg>
            Settings
          </button>

          <div className="db-sidebar-footer">
            <div className="db-user-card">
              <div className="db-avatar">
                {user?.image
                  ? <img src={user.image} alt={user.name} />
                  : <span>{user?.name?.[0] ?? "U"}</span>}
              </div>
              <div className="db-user-meta">
                <div className="db-user-name">{user?.name ?? "User"}</div>
                <div className="db-user-plan">{PLAN_LABELS[plan]} plan</div>
              </div>
              <svg style={{ width: 14, height: 14, color: "var(--text-mute)", flexShrink: 0 }}
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {signOutSlot}
            </div>
          </div>
        </nav>
      )}

      <div className="db-main">
        {/* Topbar */}
        <div className="db-topbar">
          <div className="db-breadcrumb">
            <span>{userName}</span>
            <span className="sep">/</span>
            <span className="current">{TAB_TITLES[tab]}</span>
          </div>
          <div className="db-topbar-actions">
            <div className="db-env-pill">
              <span className="db-env-dot" />
              Production
              <svg style={{ width: 12, height: 12, marginLeft: 2, opacity: 0.6 }}
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <button className="db-icon-btn" title="Documentation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <path d="M14 2v6h6M9 13h6M9 17h4"/>
              </svg>
            </button>
            <button className="db-icon-btn" title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.7 21a2 2 0 01-3.4 0"/>
              </svg>
            </button>
            <button className="db-icon-btn" title="Toggle theme"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="db-content">
          {tab === "overview" && <OverviewPage usage={usage} plan={plan} keys={keys} />}
          {tab === "keys" && (
            <KeysTab
              keys={keys} loading={loading}
              newKeyName={newKeyName} setNewKeyName={setNewKeyName}
              createdKey={createdKey} creating={creating}
              handleCreate={handleCreate} handleRevoke={handleRevoke}
            />
          )}
          {tab === "history" && (
            <HistoryTab history={history} loading={!historyFetched || historyLoading} />
          )}
          {tab === "plan" && (
            <PlanSection plan={plan} subscription={subscription} usage={usage} />
          )}
        </div>
      </div>

      {/* Tweaks */}
      <button className="db-tweaks-trigger" onClick={() => setShowTweaks(v => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>
        </svg>
        Tweaks
      </button>

      {showTweaks && (
        <TweaksPanel
          theme={theme} setTheme={setTheme}
          accent={accent} setAccent={setAccent}
          showSidebar={showSidebar} setShowSidebar={setShowSidebar}
          onClose={() => setShowTweaks(false)}
        />
      )}
    </div>
  );
}

// ── Overview page ──────────────────────────────────────────────────────────
function OverviewPage({ usage, plan, keys }: { usage: Usage; plan: Plan; keys: ApiKey[] }) {
  const [range, setRange] = useState("30d");
  const activeKeys = keys.filter(k => k.is_active).length;
  const todayPct  = Math.min((usage.today    / usage.dailyLimit)   * 100, 100);
  const monthPct  = Math.min((usage.thisMonth / usage.monthlyLimit) * 100, 100);

  return (
    <>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Overview</h1>
          <p className="db-page-sub">Monitor API usage, performance, and health across your workspace.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="db-btn db-btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <path d="M12 15V3"/>
            </svg>
            Export
          </button>
          <button className="db-btn db-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            API Reference
          </button>
        </div>
      </div>

      {/* KPI stats */}
      <div className="db-stats-grid" style={{ marginBottom: 24 }}>
        {MOCK_STATS.map((s, i) => (
          <div key={i} className="db-stat">
            <div className="db-stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                {s.icon === "activity" && <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>}
                {s.icon === "image"    && <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></>}
                {s.icon === "zap"      && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>}
                {s.icon === "alert"    && <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h0"/></>}
              </svg>
              {s.label}
            </div>
            <div className="db-stat-value">{s.value}</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, fontWeight: 500,
              color: s.trend === "up" ? "var(--success)" : "var(--danger)",
              marginBottom: 4,
            }}>
              {s.trend === "up" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                  <polyline points="16 7 22 7 22 13"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
                  <polyline points="16 17 22 17 22 11"/>
                </svg>
              )}
              <span style={{ fontWeight: 600 }}>{s.delta}</span>
              <span style={{ color: "var(--text-mute)", fontWeight: 400 }}>vs last week</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Sparkline
                id={`spark-${i}`}
                data={MOCK_SPARK[i]}
                color={s.trend === "down" ? "var(--danger)" : "var(--db-accent)"}
                height={40}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + endpoints */}
      <div style={{
        display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24,
      }}>
        <div className="db-card">
          <div className="db-card-header">
            <div>
              <p className="db-card-title">Request volume</p>
              <p className="db-card-sub">Daily requests over the last 30 days</p>
            </div>
            {/* chart controls */}
            <div style={{
              display: "flex", gap: 4,
              background: "var(--bg-elev-2)",
              border: "1px solid var(--db-border)",
              borderRadius: 7, padding: 3,
            }}>
              {["24h","7d","30d","90d"].map(r => (
                <button key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: "4px 10px", border: "none", borderRadius: 5,
                    background: range === r ? "var(--bg-hover)" : "transparent",
                    color: range === r ? "var(--text)" : "var(--text-mute)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <AreaChart data={MOCK_DAYS} />
            <div style={{
              display: "flex", justifyContent: "space-between",
              color: "var(--text-mute)", fontSize: 11, marginTop: 6,
              fontFamily: "var(--font-mono)",
            }}>
              <span>Mar 28</span><span>Apr 6</span><span>Apr 15</span><span>Apr 27</span>
            </div>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <p className="db-card-title">Top endpoints</p>
              <p className="db-card-sub">Last 7 days</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {MOCK_ENDPOINTS.map((e, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 20px",
                borderTop: i === 0 ? "none" : "1px solid var(--db-border)",
                fontSize: 13,
              }}>
                <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                  <span style={{
                    display: "inline-block",
                    fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600,
                    padding: "2px 6px", borderRadius: 4, marginRight: 8, flexShrink: 0,
                    background: e.method === "POST" ? "rgba(249,115,22,0.15)" : "rgba(16,185,129,0.15)",
                    color: e.method === "POST" ? "#f97316" : "var(--success)",
                  }}>
                    {e.method}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {e.path}
                  </span>
                </div>
                <span style={{
                  color: "var(--text-dim)", fontFeatureSettings: '"tnum"', fontSize: 12.5,
                  flexShrink: 0, marginLeft: 12,
                }}>
                  {e.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="db-card" style={{ marginBottom: 24 }}>
        <div className="db-card-header">
          <div>
            <p className="db-card-title">Quick start</p>
            <p className="db-card-sub">Authenticate and make your first image search request</p>
          </div>
          <button className="db-btn db-btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Full docs
          </button>
        </div>
        <div className="db-card-body">
          <div style={{ position: "relative" }}>
            <div className="db-code-block" style={{ paddingRight: 56 }}>
              <span className="db-tok-com"># Search images with PixS99</span>{"\n"}
              <span className="db-tok-key">curl</span>{" https://api.pixs99.io/v1/search \\\n  -H "}
              <span className="db-tok-str">&quot;Authorization: Bearer pixs99_6767b55a...&quot;</span>
              {" \\\n  -d "}
              <span className="db-tok-str">&apos;&#123;&quot;query&quot;: &quot;sunset over Tokyo skyline&quot;, &quot;limit&quot;: 24&#125;&apos;</span>
            </div>
            <div style={{ position: "absolute", top: 10, right: 10 }}>
              <CopyButton text={CURL_EXAMPLE} className="db-copy-btn" />
            </div>
          </div>
        </div>
      </div>

      {/* Usage summary */}
      <div className="db-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 0 }}>
        <div className="db-stat">
          <div className="db-stat-label">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/>
              <path d="M7 4v3l2 1.5" strokeLinecap="round"/>
            </svg>
            Today
          </div>
          <div className="db-stat-value">{usage.today.toLocaleString()}</div>
          <div className="db-stat-sub">/ {usage.dailyLimit.toLocaleString()} searches</div>
          <div className="db-stat-bar-wrap">
            <div className="db-stat-bar-fill" style={{ width: `${todayPct}%` }} />
          </div>
        </div>
        <div className="db-stat">
          <div className="db-stat-label">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2.5" width="12" height="10" rx="1.5"/>
              <path d="M4 1v3M10 1v3M1 6h12" strokeLinecap="round"/>
            </svg>
            This month
          </div>
          <div className="db-stat-value">{usage.thisMonth.toLocaleString()}</div>
          <div className="db-stat-sub">/ {usage.monthlyLimit.toLocaleString()} searches</div>
          <div className="db-stat-bar-wrap">
            <div className="db-stat-bar-fill" style={{ width: `${monthPct}%` }} />
          </div>
        </div>
        <div className="db-stat">
          <div className="db-stat-label">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 10l3-3 2.5 2.5L11 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Active keys
          </div>
          <div className="db-stat-value">{activeKeys}</div>
          <div className="db-stat-sub">{PLAN_LABELS[plan]} plan</div>
        </div>
      </div>
    </>
  );
}

// ── KeysTab ────────────────────────────────────────────────────────────────
function KeysTab({
  keys, loading, newKeyName, setNewKeyName,
  createdKey, creating, handleCreate, handleRevoke,
}: {
  keys: ApiKey[]; loading: boolean;
  newKeyName: string; setNewKeyName: (v: string) => void;
  createdKey: string | null; creating: boolean;
  handleCreate: () => void; handleRevoke: (id: string) => void;
}) {
  return (
    <>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">API Keys</h1>
          <p className="db-page-sub">Use these keys to authenticate requests to the PixS99 API.</p>
        </div>
      </div>

      <div className="db-card" style={{ marginBottom: 16 }}>
        <div className="db-card-header">
          <div>
            <p className="db-card-title">Create new key</p>
            <p className="db-card-sub">Name your key to identify its usage</p>
          </div>
        </div>
        <div className="db-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text" value={newKeyName} className="db-input"
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. my-bot"
            />
            <button onClick={handleCreate} disabled={!newKeyName.trim() || creating}
                    className="db-btn db-btn-primary" style={{ flexShrink: 0 }}>
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
          {createdKey && (
            <div style={{
              background: "var(--accent-glow)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--db-accent)", margin: 0 }}>
                Key created — copy it now, it won&apos;t be shown again
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code className="db-code-block" style={{ flex: 1, padding: "8px 12px", wordBreak: "break-all" }}>
                  {createdKey}
                </code>
                <CopyButton text={createdKey} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="db-card">
        <div className="db-card-header">
          <p className="db-card-title">Your API keys</p>
        </div>
        <table className="db-table">
          <thead>
            <tr><th>Name</th><th>Key</th><th>Status</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-mute)", padding: "32px 20px" }}>Loading…</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-mute)", padding: "32px 20px" }}>No API keys yet</td></tr>
            ) : keys.map(k => (
              <tr key={k.id}>
                <td style={{ fontWeight: 500 }}>{k.name}</td>
                <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{k.prefix}</span></td>
                <td><span className={`db-badge ${k.is_active ? "db-badge-active" : "db-badge-revoked"}`}>{k.is_active ? "Active" : "Revoked"}</span></td>
                <td style={{ color: "var(--text-dim)" }}>{new Date(k.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: "right" }}>
                  {k.is_active && (
                    <button onClick={() => handleRevoke(k.id)}
                            className="db-btn db-btn-danger" style={{ fontSize: 12, padding: "4px 10px" }}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── HistoryTab ─────────────────────────────────────────────────────────────
function HistoryTab({ history, loading }: { history: HistoryItem[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? history.filter(h => h.query.toLowerCase().includes(query.toLowerCase()))
    : history;

  return (
    <>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Search History</h1>
          <p className="db-page-sub">Browse and replay queries from the last 30 days.</p>
        </div>
      </div>

      <div className="db-history-toolbar">
        <div className="db-search-wrap">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4.5"/>
            <path d="M9.5 9.5l3 3" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Filter searches…" value={query}
                 onChange={e => setQuery(e.target.value)} className="db-input" />
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-mute)", padding: "48px 0" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text-mute)", padding: "48px 0" }}>
          {history.length === 0 ? "No search history yet. Searches made with your API keys will appear here." : "No results match your filter."}
        </p>
      ) : (
        <div className="db-history-grid">
          {filtered.map(h => (
            <a key={h.id} href={`/v/${h.id}`} target="_blank" rel="noopener noreferrer"
               className="db-history-card">
              <div className="db-history-thumbs">
                {[0,1,2].map(i => <div key={i} className="db-thumb" />)}
              </div>
              <div className="db-history-meta">
                <p className="db-history-query">{h.query}</p>
                <div className="db-history-info">
                  <span>{h.image_count} images</span>
                  <span>{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// ── PlanSection ────────────────────────────────────────────────────────────
const PLANS: { key: Plan; name: string; price: string; desc: string; features: string[] }[] = [
  { key: "free",  name: "Free",  price: "$0",  desc: "Get started for free",      features: ["10 searches / day","50 searches / month","7-day result TTL"]                                                 },
  { key: "pro",   name: "Pro",   price: "$19", desc: "For power users",           features: ["70 searches / day","2,000 searches / month","30-day result TTL","API key dashboard"]                         },
  { key: "ultra", name: "Ultra", price: "$49", desc: "Unlimited access",          features: ["350 searches / day","10,000 searches / month","Unlimited result TTL","Search history"]                      },
];

function PlanSection({ plan, subscription, usage }: { plan: Plan; subscription: SubscriptionInfo | null; usage: Usage }) {
  const [upgrading, setUpgrading] = useState<Plan | null>(null);
  const fmt = (unix: number) => new Date(unix * 1000).toLocaleDateString();
  const todayPct  = Math.min((usage.today    / usage.dailyLimit)   * 100, 100);
  const monthPct  = Math.min((usage.thisMonth / usage.monthlyLimit) * 100, 100);

  async function handleUpgrade(target: Plan) {
    setUpgrading(target);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: target }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setUpgrading(null);
  }

  async function handleManage() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Plan &amp; Billing</h1>
          <p className="db-page-sub">
            {subscription
              ? subscription.cancelAt
                ? `Ends on ${fmt(subscription.cancelAt)}`
                : `Renews on ${fmt(subscription.currentPeriodEnd)}`
              : "No active subscription"}
          </p>
        </div>
        {plan !== "free" && (
          <button onClick={handleManage} className="db-btn db-btn-ghost" style={{ fontSize: 12 }}>
            Manage subscription
          </button>
        )}
      </div>

      <div className="db-card">
        <div className="db-card-header">
          <p className="db-card-title">Current usage</p>
        </div>
        <div className="db-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Today", current: usage.today, limit: usage.dailyLimit, pct: todayPct },
            { label: "This month", current: usage.thisMonth, limit: usage.monthlyLimit, pct: monthPct },
          ].map(row => (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "var(--text-dim)" }}>{row.label}</span>
                <span style={{ color: "var(--text)", fontFeatureSettings: '"tnum"' }}>
                  {row.current.toLocaleString()} / {row.limit.toLocaleString()}
                </span>
              </div>
              <div className="db-usage-bar-wrap">
                <div className="db-usage-bar-fill" style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="db-plan-grid">
        {PLANS.map(p => {
          const isCurrent = p.key === plan;
          const isDowngrade = (plan === "ultra" && p.key === "pro") || (plan !== "free" && p.key === "free");
          return (
            <div key={p.key} className={`db-plan-card${isCurrent ? " current" : ""}`}>
              {isCurrent && <span className="db-plan-tag">CURRENT</span>}
              <p className="db-plan-name">{p.name}</p>
              <p className="db-plan-price">{p.price}<small>/mo</small></p>
              <p className="db-plan-desc">{p.desc}</p>
              <ul className="db-plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2.5 7l3 3 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="db-btn db-btn-ghost" style={{ width: "100%", justifyContent: "center", cursor: "default", opacity: 0.5 }} disabled>Current plan</button>
              ) : isDowngrade ? (
                <button onClick={handleManage} className="db-btn db-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>Manage</button>
              ) : (
                <button onClick={() => handleUpgrade(p.key)} disabled={upgrading !== null}
                        className="db-btn db-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  {upgrading === p.key ? "Redirecting…" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
