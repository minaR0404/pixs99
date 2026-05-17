"use client";

import { useRouter } from "next/navigation";
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

type Tab = "overview" | "keys" | "history" | "plan" | "docs" | "settings";
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

const CURL_EXAMPLE = `curl https://api.pixs99.io/v1/search \\
  -H "Authorization: Bearer pixs99_6767b55a..." \\
  -d '{"query": "sunset over Tokyo skyline", "limit": 24}'`;

// ── Analytics helpers ──────────────────────────────────────────────────────
interface Analytics {
  totalRequests: number;
  totalImages: number;
  thisWeekRequests: number;
  thisWeekImages: number;
  prevWeekRequests: number;
  prevWeekImages: number;
  daily: { date: string; count: number; images: number }[];
  topQueries: { query: string; count: number }[];
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

function weekDelta(curr: number, prev: number): { label: string; trend: "up" | "down" } {
  if (prev === 0) return curr > 0 ? { label: "+100%", trend: "up" } : { label: "—", trend: "up" };
  const pct = ((curr - prev) / prev) * 100;
  return { label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, trend: pct >= 0 ? "up" : "down" };
}

function buildDailyArray(
  daily: Analytics["daily"],
  days: number,
  field: "count" | "images",
): number[] {
  const map = new Map<string, number>(daily.map(d => [d.date.slice(0, 10), d[field]]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return map.get(d.toISOString().slice(0, 10)) ?? 0;
  });
}

function chartDateLabels(days: number): string[] {
  return [0, Math.floor(days * 0.33), Math.floor(days * 0.66), days - 1].map(i => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

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
  docs:     "Documentation",
  settings: "Settings",
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
  user?: { name: string; image: string; email?: string };
  signOutSlot?: React.ReactNode;
}) {
  const [tab, setTab]               = useState<Tab>("overview");
  const [theme, setTheme]           = useState<string>("dark");
  const [accent, setAccent]         = useState<string>("indigo");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTweaks, setShowTweaks] = useState(false);
  const [toast, setToast]           = useState({ msg: "", show: false });

  const showToast = useCallback((msg: string) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2000);
  }, []);
  const [keys, setKeys]             = useState<ApiKey[]>([]);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [analytics, setAnalytics]   = useState<Analytics | null>(null);
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

  const fetchAnalytics = useCallback(async () => {
    const res = await fetch("/api/analytics");
    if (res.ok) setAnalytics(await res.json());
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetch("/api/history");
    const data = await res.json();
    setHistory(data.history ?? []);
    setHistoryLoading(false);
    setHistoryFetched(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchKeys();
      fetchAnalytics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchKeys, fetchAnalytics]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("upgraded")) {
      window.history.replaceState({}, "", "/dashboard");
      window.setTimeout(() => setTab("plan"), 0);
    }
  }, []);

  useEffect(() => {
    if (tab === "history" && !historyFetched) {
      const timer = window.setTimeout(() => fetchHistory(), 0);
      return () => window.clearTimeout(timer);
    }
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

          <button className={`db-nav-item${tab === "docs" ? " active" : ""}`} onClick={() => setTab("docs")}>
            <svg className="db-nav-icon" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <path d="M14 2v6h6M9 13h6M9 17h4"/>
            </svg>
            Documentation
          </button>

          <button className={`db-nav-item${tab === "settings" ? " active" : ""}`} onClick={() => setTab("settings")}>
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
          {tab === "overview" && <OverviewPage usage={usage} plan={plan} keys={keys} analytics={analytics} />}
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
          {tab === "docs" && <DocumentationPage />}
          {tab === "settings" && <SettingsPage user={user} onToast={showToast} />}
        </div>
      </div>

      {/* Toast */}
      <div className={`db-toast${toast.show ? " show" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {toast.msg}
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
function OverviewPage({ usage, plan, keys, analytics }: { usage: Usage; plan: Plan; keys: ApiKey[]; analytics: Analytics | null }) {
  const [range, setRange] = useState("30d");
  const activeKeys = keys.filter(k => k.is_active).length;
  const todayPct  = Math.min((usage.today    / usage.dailyLimit)   * 100, 100);
  const monthPct  = Math.min((usage.thisMonth / usage.monthlyLimit) * 100, 100);

  const reqDelta   = analytics ? weekDelta(analytics.thisWeekRequests, analytics.prevWeekRequests) : null;
  const imgDelta   = analytics ? weekDelta(analytics.thisWeekImages,   analytics.prevWeekImages)   : null;
  const chartDays  = range === "7d" ? 7 : 30;
  const chartData  = analytics ? buildDailyArray(analytics.daily, chartDays, "count") : null;
  const sparkReq   = analytics ? buildDailyArray(analytics.daily, 20, "count") : null;
  const sparkImg   = analytics ? buildDailyArray(analytics.daily, 20, "images") : null;
  const dateLabels = chartDateLabels(chartDays);

  const stats = [
    {
      label: "Total requests",
      value: analytics ? fmtCount(analytics.totalRequests) : "—",
      delta: reqDelta?.label ?? "—",
      trend: reqDelta?.trend ?? ("up" as const),
      icon: "activity",
      spark: sparkReq,
    },
    {
      label: "Images served",
      value: analytics ? fmtCount(analytics.totalImages) : "—",
      delta: imgDelta?.label ?? "—",
      trend: imgDelta?.trend ?? ("up" as const),
      icon: "image",
      spark: sparkImg,
    },
    {
      label: "This week",
      value: analytics ? fmtCount(analytics.thisWeekRequests) : "—",
      delta: reqDelta?.label ?? "—",
      trend: reqDelta?.trend ?? ("up" as const),
      icon: "zap",
      spark: sparkReq,
    },
    {
      label: "This month",
      value: fmtCount(usage.thisMonth),
      delta: `/ ${fmtCount(usage.monthlyLimit)}`,
      trend: "up" as const,
      icon: "alert",
      spark: null,
    },
  ];

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
        {stats.map((s, i) => (
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
              {s.delta !== "—" && s.delta.startsWith("+") || s.delta !== "—" && s.delta.startsWith("-") ? (
                s.trend === "up" ? (
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
                )
              ) : null}
              <span style={{ fontWeight: 600 }}>{s.delta}</span>
              {(s.delta.startsWith("+") || s.delta.startsWith("-")) && (
                <span style={{ color: "var(--text-mute)", fontWeight: 400 }}>vs last week</span>
              )}
            </div>
            {s.spark && s.spark.some(v => v > 0) && (
              <div style={{ marginTop: 10 }}>
                <Sparkline
                  id={`spark-${i}`}
                  data={s.spark}
                  color={s.trend === "down" ? "var(--danger)" : "var(--db-accent)"}
                  height={40}
                />
              </div>
            )}
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
            {chartData ? (
              <>
                <AreaChart data={chartData} />
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  color: "var(--text-mute)", fontSize: 11, marginTop: 6,
                  fontFamily: "var(--font-mono)",
                }}>
                  {dateLabels.map(l => <span key={l}>{l}</span>)}
                </div>
              </>
            ) : (
              <div style={{ height: 214, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-mute)", fontSize: 13 }}>
                Loading…
              </div>
            )}
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <p className="db-card-title">Top queries</p>
              <p className="db-card-sub">Last 7 days</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {analytics && analytics.topQueries.length > 0 ? analytics.topQueries.map((q, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 20px",
                borderTop: i === 0 ? "none" : "1px solid var(--db-border)",
                fontSize: 13,
              }}>
                <span style={{
                  color: "var(--text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {q.query}
                </span>
                <span style={{
                  color: "var(--text-dim)", fontFeatureSettings: '"tnum"', fontSize: 12.5,
                  flexShrink: 0, marginLeft: 12,
                }}>
                  {q.count.toLocaleString()}
                </span>
              </div>
            )) : (
              <div style={{ padding: "20px", color: "var(--text-mute)", fontSize: 13, textAlign: "center" }}>
                {analytics ? "No queries in the last 7 days" : "Loading…"}
              </div>
            )}
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
  const router = useRouter();
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
    if (data.url) router.push(data.url);
    setUpgrading(null);
  }

  async function handleManage() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) router.push(data.url);
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

// ── Documentation page ─────────────────────────────────────────────────────
function DocumentationPage() {
  const sections = [
    { id: "introduction",  label: "Introduction" },
    { id: "quickstart",    label: "Quickstart" },
    { id: "authentication",label: "Authentication" },
    { id: "search",        label: "Search" },
    { id: "collections",   label: "Collections" },
    { id: "errors",        label: "Errors" },
    { id: "rate-limits",   label: "Rate limits" },
    { id: "sdks",          label: "SDKs & libraries" },
    { id: "changelog",     label: "Changelog" },
  ];
  const [active, setActive] = useState("introduction");

  useEffect(() => {
    const handler = () => {
      let best = sections[0].id;
      let bestDist = Infinity;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - 96);
        if (r.top < 200 && dist < bestDist) { bestDist = dist; best = s.id; }
      }
      setActive(best);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
  };

  const IC = ({ name }: { name: string }) => {
    const paths: Record<string, React.ReactNode> = {
      zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
      search:   <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
      code:     <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
      alert:    <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h0"/></>,
    };
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </svg>
    );
  };

  return (
    <>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Documentation</h1>
          <p className="db-page-sub">Reference and guides for building with the PixS99 image search API.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="db-btn db-btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            Search docs
          </button>
          <button className="db-btn db-btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            API Reference
          </button>
        </div>
      </div>

      <div className="db-docs-layout">
        <nav className="db-docs-toc">
          <div className="db-docs-toc-label">On this page</div>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`}
               className={active === s.id ? "active" : ""}
               onClick={e => { e.preventDefault(); jump(s.id); }}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="db-docs-content">
          <section id="introduction">
            <h2>Introduction</h2>
            <p>
              PixS99 is an image search API that lets you query millions of indexed images using natural language,
              embeddings, or your own custom collections. This guide walks through authentication, the core
              endpoints, and best practices for production use.
            </p>
            <div className="db-docs-hero">
              {[
                { id: "quickstart", icon: "zap",    title: "Quickstart",        sub: "Make your first request in 60 seconds." },
                { id: "search",     icon: "search",  title: "Search reference",  sub: "Endpoints, parameters, and examples." },
                { id: "sdks",       icon: "code",    title: "SDKs",              sub: "Official libraries for JS, Python, Go." },
              ].map(t => (
                <a key={t.id} href={`#${t.id}`} className="db-docs-tile"
                   onClick={e => { e.preventDefault(); jump(t.id); }}>
                  <div className="db-docs-tile-icon"><IC name={t.icon} /></div>
                  <p className="db-docs-tile-title">{t.title}</p>
                  <p className="db-docs-tile-sub">{t.sub}</p>
                </a>
              ))}
            </div>
          </section>

          <div className="db-docs-divider" />

          <section id="quickstart">
            <h2>Quickstart</h2>
            <p>
              All API calls are made to <code className="db-inline-code">https://api.pixs99.io/v1</code> over HTTPS.
              Create a key from the <strong>API Keys</strong> page and pass it as a Bearer token in the{" "}
              <code className="db-inline-code">Authorization</code> header.
            </p>
            <h3>1. Make your first request</h3>
            <div className="db-code-block">
              <span className="db-tok-com"># Search images by natural language query</span>{"\n"}
              <span className="db-tok-key">curl</span>{" https://api.pixs99.io/v1/search \\\n  -H "}
              <span className="db-tok-str">&quot;Authorization: Bearer pixs99_6767b55a...&quot;</span>{" \\\n  -H "}
              <span className="db-tok-str">&quot;Content-Type: application/json&quot;</span>{" \\\n  -d "}
              <span className="db-tok-str">&apos;&#123;&quot;query&quot;: &quot;sunset over Tokyo skyline&quot;, &quot;limit&quot;: 24&#125;&apos;</span>
            </div>
            <h3>2. Inspect the response</h3>
            <div className="db-code-block">
              {"{"}{"\n"}
              {"  "}<span className="db-tok-key">&quot;query&quot;</span>{": "}<span className="db-tok-str">&quot;sunset over Tokyo skyline&quot;</span>{",\n"}
              {"  "}<span className="db-tok-key">&quot;results&quot;</span>{": [\n"}
              {"    { "}<span className="db-tok-key">&quot;id&quot;</span>{": "}<span className="db-tok-str">&quot;img_a8f22&quot;</span>{", "}<span className="db-tok-key">&quot;score&quot;</span>{": "}<span className="db-tok-num">0.94</span>{", "}<span className="db-tok-key">&quot;url&quot;</span>{": "}<span className="db-tok-str">&quot;https://cdn.pixs99.io/...&quot;</span>{" },\n"}
              {"    { "}<span className="db-tok-key">&quot;id&quot;</span>{": "}<span className="db-tok-str">&quot;img_b1c43&quot;</span>{", "}<span className="db-tok-key">&quot;score&quot;</span>{": "}<span className="db-tok-num">0.91</span>{", "}<span className="db-tok-key">&quot;url&quot;</span>{": "}<span className="db-tok-str">&quot;https://cdn.pixs99.io/...&quot;</span>{" }\n"}
              {"  ],"}{"\n"}
              {"  "}<span className="db-tok-key">&quot;took_ms&quot;</span>{": "}<span className="db-tok-num">42</span>{"\n"}
              {"}"}
            </div>
          </section>

          <div className="db-docs-divider" />

          <section id="authentication">
            <h2>Authentication</h2>
            <p>
              PixS99 uses bearer tokens for authentication. Every request must include an{" "}
              <code className="db-inline-code">Authorization</code> header with a valid API key. Keys are
              scoped per-environment — production keys cannot read staging data and vice versa.
            </p>
            <div className="db-docs-callout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h0"/>
              </svg>
              <div>
                <strong>Keep keys server-side.</strong>
                <p>Never embed API keys in browser bundles or mobile apps. Use a backend proxy or short-lived signed URLs.</p>
              </div>
            </div>
            <h3>Header format</h3>
            <div className="db-code-block">
              Authorization: Bearer pixs99_6767b55a3f9d2c4e1b8a
            </div>
          </section>

          <div className="db-docs-divider" />

          <section id="search">
            <h2>Search</h2>
            <p>
              The search endpoint accepts natural language queries, image URLs (for visual similarity),
              or pre-computed embedding vectors.
            </p>
            <h3>Endpoints</h3>
            <table className="db-endpoint-table">
              <thead>
                <tr><th>Method</th><th>Path</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="db-endpoint-method">POST</span></td>
                  <td>/v1/search</td>
                  <td>Text or visual search.</td>
                </tr>
                <tr>
                  <td><span className="db-endpoint-method">POST</span></td>
                  <td>/v1/embed</td>
                  <td>Get embedding vectors for text or images.</td>
                </tr>
                <tr>
                  <td><span className={`db-endpoint-method db-endpoint-method-get`}>GET</span></td>
                  <td>/v1/images/&#123;id&#125;</td>
                  <td>Fetch image metadata by ID.</td>
                </tr>
                <tr>
                  <td><span className={`db-endpoint-method db-endpoint-method-get`}>GET</span></td>
                  <td>/v1/usage</td>
                  <td>Read your current usage and quota.</td>
                </tr>
              </tbody>
            </table>
            <h3>Parameters</h3>
            <ul>
              <li><strong>query</strong> — natural language description of what you&apos;re looking for.</li>
              <li><strong>image_url</strong> — alternative to <code className="db-inline-code">query</code> for visual similarity.</li>
              <li><strong>limit</strong> — number of results, 1–100. Defaults to 24.</li>
              <li><strong>collection</strong> — restrict the search to a specific custom collection.</li>
              <li><strong>filters</strong> — optional metadata filters (color, orientation, license).</li>
            </ul>
          </section>

          <div className="db-docs-divider" />

          <section id="collections">
            <h2>Collections</h2>
            <p>
              Custom collections let you index your own images and search them with the same API. Collections
              are private to your workspace and billed by storage.
            </p>
            <div className="db-code-block">
              <span className="db-tok-com"># Create a collection and index an image</span>{"\n"}
              <span className="db-tok-key">curl</span>{" -X POST https://api.pixs99.io/v1/collections \\\n  -H "}
              <span className="db-tok-str">&quot;Authorization: Bearer pixs99_...&quot;</span>{" \\\n  -d "}
              <span className="db-tok-str">&apos;&#123;&quot;name&quot;: &quot;product-catalog&quot;&#125;&apos;</span>
            </div>
          </section>

          <div className="db-docs-divider" />

          <section id="errors">
            <h2>Errors</h2>
            <p>
              PixS99 uses conventional HTTP status codes. Errors return a JSON body with a{" "}
              <code className="db-inline-code">code</code> and human-readable <code className="db-inline-code">message</code>.
            </p>
            <table className="db-endpoint-table">
              <thead>
                <tr><th>Status</th><th>Code</th><th>Meaning</th></tr>
              </thead>
              <tbody>
                {[
                  [400, "invalid_request",  "Required parameter missing or malformed."],
                  [401, "unauthenticated",  "API key missing, invalid, or revoked."],
                  [403, "forbidden",        "Key lacks permission for the requested resource."],
                  [429, "rate_limited",     "Too many requests — see rate limits."],
                  [500, "internal_error",   "Something failed on our end. Safe to retry."],
                ].map(([s, c, m]) => (
                  <tr key={s}>
                    <td>{s}</td>
                    <td><code className="db-inline-code">{c}</code></td>
                    <td>{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="db-docs-divider" />

          <section id="rate-limits">
            <h2>Rate limits</h2>
            <p>
              Limits depend on your plan. The current quota is returned on every response in the{" "}
              <code className="db-inline-code">X-RateLimit-Remaining</code> header.
            </p>
            <ul>
              <li><strong>Free</strong> — 5 requests / second, 1,000 / month.</li>
              <li><strong>Pro</strong> — 50 requests / second, 100,000 / month.</li>
              <li><strong>Scale</strong> — unlimited concurrency, 1M / month base + overage.</li>
            </ul>
          </section>

          <div className="db-docs-divider" />

          <section id="sdks">
            <h2>SDKs &amp; libraries</h2>
            <p>Official SDKs handle auth, retries, and pagination for you.</p>
            <div className="db-docs-hero">
              {[
                { title: "JavaScript", sub: "npm install @pixs99/sdk" },
                { title: "Python",     sub: "pip install pixs99" },
                { title: "Go",         sub: "go get github.com/pixs99/go" },
              ].map(t => (
                <div key={t.title} className="db-docs-tile">
                  <div className="db-docs-tile-icon"><IC name="code" /></div>
                  <p className="db-docs-tile-title">{t.title}</p>
                  <p className="db-docs-tile-sub">{t.sub}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="db-docs-divider" />

          <section id="changelog">
            <h2>Changelog</h2>
            <p><strong>2026-04-22</strong> — Added <code className="db-inline-code">filters.color</code> parameter on /v1/search.</p>
            <p><strong>2026-04-08</strong> — New <code className="db-inline-code">/v1/embed</code> endpoint for raw vectors.</p>
            <p><strong>2026-03-19</strong> — Increased default <code className="db-inline-code">limit</code> from 12 to 24.</p>
          </section>
        </div>
      </div>
    </>
  );
}

// ── Settings page ──────────────────────────────────────────────────────────
function SettingsPage({
  user,
  onToast,
}: {
  user?: { name: string; image: string; email?: string };
  onToast: (msg: string) => void;
}) {
  const settingsTabs = [
    { id: "profile",       label: "Profile",       icon: "home"     },
    { id: "workspace",     label: "Workspace",     icon: "plan"     },
    { id: "notifications", label: "Notifications", icon: "bell"     },
    { id: "security",      label: "Security",      icon: "key"      },
    { id: "danger",        label: "Danger zone",   icon: "alert"    },
  ] as const;
  type SettingsTab = typeof settingsTabs[number]["id"];

  const [stab, setStab] = useState<SettingsTab>("profile");

  const [name,     setName]     = useState(user?.name ?? "");
  const [handle,   setHandle]   = useState("");
  const [email,    setEmail]    = useState(user?.email ?? "");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [wsName,   setWsName]   = useState("");
  const [wsRegion, setWsRegion] = useState("ap-northeast-1");
  const [twoFa,    setTwoFa]    = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30d");
  const [notif, setNotif] = useState({
    productUpdates: true,
    securityAlerts: true,
    usageWarnings:  true,
    billing:        true,
    weeklyDigest:   false,
  });

  const NavIcon = ({ name }: { name: string }) => {
    const paths: Record<string, React.ReactNode> = {
      home:  <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V9.5z"/></>,
      plan:  <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></>,
      bell:  <><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></>,
      key:   <><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4l3 3-3 3-3-3"/><path d="M15 9l3 3"/></>,
      alert: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h0"/></>,
    };
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </svg>
    );
  };

  const avatar = user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Settings</h1>
          <p className="db-page-sub">Manage your account, workspace, and security preferences.</p>
        </div>
      </div>

      <div className="db-settings-layout">
        <nav className="db-settings-nav">
          {settingsTabs.map(t => (
            <button key={t.id} className={stab === t.id ? "active" : ""} onClick={() => setStab(t.id)}>
              <NavIcon name={t.icon} />{t.label}
            </button>
          ))}
        </nav>

        <div className="db-settings-content">
          {stab === "profile" && (
            <div className="db-card">
              <div className="db-card-header">
                <div>
                  <p className="db-card-title">Profile</p>
                  <p className="db-card-sub">How you appear to teammates and in API logs.</p>
                </div>
              </div>
              <div style={{ padding: "20px 20px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                  <div className="db-avatar-lg">
                    {user?.image
                      ? <img src={user.image} alt={user.name} />
                      : avatar}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="db-btn db-btn-ghost">Upload photo</button>
                      <button className="db-btn db-btn-ghost">Remove</button>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-mute)" }}>PNG or JPG, up to 2MB.</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 20px 8px" }}>
                {[
                  { label: "Full name",  help: "Used for invoices and team mentions.",       val: name,     set: setName,     type: "text"  },
                  { label: "Username",   help: "Your unique handle on PixS99.",              val: handle,   set: setHandle,   type: "text"  },
                  { label: "Email",      help: "Sign-in address and security alerts.",       val: email,    set: setEmail,    type: "email" },
                ].map(row => (
                  <div key={row.label} className="db-setting-row">
                    <div>
                      <div className="db-setting-row-label">{row.label}</div>
                      <div className="db-setting-row-help">{row.help}</div>
                    </div>
                    <div className="db-setting-row-control">
                      <input className="db-input" type={row.type} value={row.val}
                             onChange={e => row.set(e.target.value)} />
                    </div>
                  </div>
                ))}
                <div className="db-setting-row">
                  <div>
                    <div className="db-setting-row-label">Timezone</div>
                    <div className="db-setting-row-help">All timestamps in the dashboard use this zone.</div>
                  </div>
                  <div className="db-setting-row-control">
                    <select className="db-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                      <option value="Asia/Tokyo">(UTC+09:00) Asia / Tokyo</option>
                      <option value="Asia/Singapore">(UTC+08:00) Asia / Singapore</option>
                      <option value="Europe/London">(UTC+00:00) Europe / London</option>
                      <option value="America/New_York">(UTC-05:00) America / New York</option>
                      <option value="America/Los_Angeles">(UTC-08:00) America / Los Angeles</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--db-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="db-btn db-btn-ghost">Cancel</button>
                <button className="db-btn db-btn-primary" onClick={() => onToast("Profile saved")}>Save changes</button>
              </div>
            </div>
          )}

          {stab === "workspace" && (
            <div className="db-card">
              <div className="db-card-header">
                <div>
                  <p className="db-card-title">Workspace</p>
                  <p className="db-card-sub">Settings that apply across all keys and team members.</p>
                </div>
              </div>
              <div style={{ padding: "0 20px 8px" }}>
                <div className="db-setting-row">
                  <div>
                    <div className="db-setting-row-label">Workspace name</div>
                    <div className="db-setting-row-help">Shown in the breadcrumb and on invoices.</div>
                  </div>
                  <div className="db-setting-row-control">
                    <input className="db-input" value={wsName} onChange={e => setWsName(e.target.value)} />
                  </div>
                </div>
                <div className="db-setting-row">
                  <div>
                    <div className="db-setting-row-label">Default region</div>
                    <div className="db-setting-row-help">Where new collections are stored. Existing data is not moved.</div>
                  </div>
                  <div className="db-setting-row-control">
                    <select className="db-select" value={wsRegion} onChange={e => setWsRegion(e.target.value)}>
                      <option value="ap-northeast-1">Asia Pacific (Tokyo) — ap-northeast-1</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore) — ap-southeast-1</option>
                      <option value="eu-west-1">EU (Ireland) — eu-west-1</option>
                      <option value="us-east-1">US East (N. Virginia) — us-east-1</option>
                      <option value="us-west-2">US West (Oregon) — us-west-2</option>
                    </select>
                  </div>
                </div>
                <div className="db-setting-row">
                  <div>
                    <div className="db-setting-row-label">Workspace ID</div>
                    <div className="db-setting-row-help">Reference this when contacting support.</div>
                  </div>
                  <div className="db-setting-row-control">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                      ws_8f3a2e91c4b07d56
                      <CopyButton text="ws_8f3a2e91c4b07d56" />
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--db-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="db-btn db-btn-ghost">Cancel</button>
                <button className="db-btn db-btn-primary" onClick={() => onToast("Workspace saved")}>Save changes</button>
              </div>
            </div>
          )}

          {stab === "notifications" && (
            <div className="db-card">
              <div className="db-card-header">
                <div>
                  <p className="db-card-title">Email notifications</p>
                  <p className="db-card-sub">
                    Choose what we should email you about.
                    {email && <> Sent to <strong style={{ color: "var(--text)" }}>{email}</strong>.</>}
                  </p>
                </div>
              </div>
              <div style={{ padding: "0 20px 8px" }}>
                {([
                  ["productUpdates", "Product updates",    "New features, endpoint launches, and SDK releases."],
                  ["securityAlerts", "Security alerts",    "Sign-ins from new devices, key creation, and revocations."],
                  ["usageWarnings",  "Usage warnings",     "Notify when monthly usage crosses 80% / 95% / 100%."],
                  ["billing",        "Billing & invoices", "Payment receipts and renewal reminders."],
                  ["weeklyDigest",   "Weekly digest",      "Summary of requests, top endpoints, and errors every Monday."],
                ] as const).map(([key, label, help]) => (
                  <div key={key} className="db-setting-row">
                    <div>
                      <div className="db-setting-row-label">{label}</div>
                      <div className="db-setting-row-help">{help}</div>
                    </div>
                    <div className="db-setting-row-control" style={{ display: "flex", justifyContent: "flex-end" }}>
                      <label className="db-switch">
                        <input type="checkbox" checked={notif[key]}
                               onChange={e => setNotif(n => ({ ...n, [key]: e.target.checked }))} />
                        <span className="db-switch-slider" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stab === "security" && (
            <>
              <div className="db-card">
                <div className="db-card-header">
                  <div>
                    <p className="db-card-title">Authentication</p>
                    <p className="db-card-sub">Protect your account beyond a password.</p>
                  </div>
                </div>
                <div style={{ padding: "0 20px 8px" }}>
                  <div className="db-setting-row">
                    <div>
                      <div className="db-setting-row-label">Two-factor authentication</div>
                      <div className="db-setting-row-help">Require a TOTP code at sign-in.</div>
                    </div>
                    <div className="db-setting-row-control" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span className={twoFa ? "db-badge-active" : "db-badge-revoked"}>
                        {twoFa ? "Enabled" : "Disabled"}
                      </span>
                      <label className="db-switch">
                        <input type="checkbox" checked={twoFa} onChange={e => setTwoFa(e.target.checked)} />
                        <span className="db-switch-slider" />
                      </label>
                    </div>
                  </div>
                  <div className="db-setting-row">
                    <div>
                      <div className="db-setting-row-label">Session timeout</div>
                      <div className="db-setting-row-help">Automatically sign out idle sessions.</div>
                    </div>
                    <div className="db-setting-row-control">
                      <select className="db-select" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}>
                        <option value="1d">1 day</option>
                        <option value="7d">7 days</option>
                        <option value="30d">30 days</option>
                        <option value="never">Never</option>
                      </select>
                    </div>
                  </div>
                  <div className="db-setting-row">
                    <div>
                      <div className="db-setting-row-label">Password</div>
                      <div className="db-setting-row-help">Last changed 4 months ago.</div>
                    </div>
                    <div className="db-setting-row-control">
                      <button className="db-btn db-btn-ghost">Change password</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="db-card">
                <div className="db-card-header">
                  <div>
                    <p className="db-card-title">Active sessions</p>
                    <p className="db-card-sub">Devices currently signed in to your account.</p>
                  </div>
                  <button className="db-btn db-btn-ghost">Sign out all</button>
                </div>
                <table className="db-data-table">
                  <thead>
                    <tr><th>Device</th><th>Location</th><th>Last active</th><th></th></tr>
                  </thead>
                  <tbody>
                    {([
                      ["MacBook Pro · Chrome 124", "Tokyo, JP",  "Active now",  true ],
                      ["iPhone 15 · Safari",       "Tokyo, JP",  "2 hours ago", false],
                      ["Linux · Firefox 125",      "Osaka, JP",  "Yesterday",   false],
                    ] as const).map(([device, loc, time, current]) => (
                      <tr key={device}>
                        <td style={{ fontWeight: 500 }}>
                          {device}
                          {current && <span className="db-badge-active" style={{ marginLeft: 8 }}>This device</span>}
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>{loc}</td>
                        <td style={{ color: "var(--text-dim)" }}>{time}</td>
                        <td style={{ textAlign: "right" }}>
                          {!current && (
                            <button className="db-btn" style={{ color: "var(--danger)", border: "none", background: "transparent" }}>
                              Sign out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {stab === "danger" && (
            <div className={`db-card db-danger-card`}>
              <div className="db-card-header">
                <div>
                  <p className="db-card-title" style={{ color: "var(--danger)" }}>Danger zone</p>
                  <p className="db-card-sub">These actions are permanent and cannot be undone.</p>
                </div>
              </div>
              {[
                { title: "Transfer workspace",  sub: "Move ownership of this workspace to another team member.",                          btn: "Transfer",         danger: false },
                { title: "Reset all API keys",  sub: "Revoke every active key. Existing integrations will stop working immediately.",     btn: "Reset keys",       danger: true  },
                { title: "Delete workspace",    sub: "Permanently delete this workspace, all collections, and all API keys.",             btn: "Delete workspace", danger: true  },
              ].map(row => (
                <div key={row.title} className="db-danger-row">
                  <div>
                    <p className="db-danger-row-title">{row.title}</p>
                    <p className="db-danger-row-sub">{row.sub}</p>
                  </div>
                  <button className={`db-btn ${row.danger ? "db-btn-danger" : "db-btn-ghost"}`}>
                    {row.btn}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
