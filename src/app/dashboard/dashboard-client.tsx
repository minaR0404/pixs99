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

type Tab = "keys" | "history" | "plan";
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

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

const TAB_TITLES: Record<Tab, string> = {
  keys: "API Keys",
  history: "Search History",
  plan: "Plan",
};

export default function DashboardClient({
  plan,
  subscription,
  usage,
  user,
  signOutSlot,
}: {
  plan: Plan;
  subscription: SubscriptionInfo | null;
  usage: Usage;
  user?: { name: string; image: string };
  signOutSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("upgraded")) {
      window.history.replaceState({}, "", "/dashboard");
      setTab("plan");
    }
  }, []);

  useEffect(() => {
    if (tab === "history" && !historyFetched) {
      fetchHistory();
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
    if (data.key) {
      setCreatedKey(data.key);
      setNewKeyName("");
      fetchKeys();
    }
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

  const activeKeys = keys.filter((k) => k.is_active).length;
  const todayPct = Math.min((usage.today / usage.dailyLimit) * 100, 100);
  const monthPct = Math.min((usage.thisMonth / usage.monthlyLimit) * 100, 100);

  return (
    <div className="db-shell">
      {/* Sidebar */}
      <nav className="db-sidebar">
        <div className="db-brand">
          <div className="db-brand-mark">
            <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
          </div>
          <span className="db-brand-name">PixS99</span>
        </div>

        <span className="db-nav-label">Main</span>

        <button
          onClick={() => setTab("keys")}
          className={`db-nav-item${tab === "keys" ? " active" : ""}`}
        >
          <svg className="db-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="8" r="3.5" />
            <path d="M9.5 8h5M13 6.5V8" strokeLinecap="round" />
          </svg>
          API Keys
        </button>

        <button
          onClick={() => setTab("history")}
          className={`db-nav-item${tab === "history" ? " active" : ""}`}
        >
          <svg className="db-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Search History
        </button>

        <button
          onClick={() => setTab("plan")}
          className={`db-nav-item${tab === "plan" ? " active" : ""}`}
        >
          <svg className="db-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 12l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Plan
        </button>

        <div className="db-sidebar-footer">
          <div className="db-user-card">
            <div className="db-avatar">
              {user?.image ? (
                <img src={user.image} alt={user.name} />
              ) : (
                <span>{user?.name?.[0] ?? "U"}</span>
              )}
            </div>
            <div className="db-user-meta">
              <div className="db-user-name">{user?.name ?? "User"}</div>
              <div className="db-user-plan">{PLAN_LABELS[plan]} plan</div>
            </div>
            {signOutSlot}
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="db-main">
        <div className="db-topbar">
          <div className="db-breadcrumb">
            <span>Dashboard</span>
            <span className="sep">/</span>
            <span className="current">{TAB_TITLES[tab]}</span>
          </div>
          <div className="db-topbar-actions">
            <div className="db-env-pill">
              <span className="db-env-dot" />
              Live
            </div>
          </div>
        </div>

        <div className="db-content">
          {/* Stats grid */}
          <div className="db-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
            <div className="db-stat">
              <div className="db-stat-label">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5.5" />
                  <path d="M7 4v3l2 1.5" strokeLinecap="round" />
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
                  <rect x="1" y="2.5" width="12" height="10" rx="1.5" />
                  <path d="M4 1v3M10 1v3M1 6h12" strokeLinecap="round" />
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
                  <path d="M2 10l3-3 2.5 2.5L11 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Active keys
              </div>
              <div className="db-stat-value">{loading ? "—" : activeKeys}</div>
              <div className="db-stat-sub">{PLAN_LABELS[plan]} plan</div>
            </div>
          </div>

          {/* Tab content */}
          {tab === "keys" && (
            <KeysTab
              keys={keys}
              loading={loading}
              newKeyName={newKeyName}
              setNewKeyName={setNewKeyName}
              createdKey={createdKey}
              creating={creating}
              handleCreate={handleCreate}
              handleRevoke={handleRevoke}
            />
          )}

          {tab === "plan" && (
            <PlanSection plan={plan} subscription={subscription} usage={usage} />
          )}

          {tab === "history" && (
            <HistoryTab
              history={history}
              loading={!historyFetched || historyLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KeysTab({
  keys,
  loading,
  newKeyName,
  setNewKeyName,
  createdKey,
  creating,
  handleCreate,
  handleRevoke,
}: {
  keys: ApiKey[];
  loading: boolean;
  newKeyName: string;
  setNewKeyName: (v: string) => void;
  createdKey: string | null;
  creating: boolean;
  handleCreate: () => void;
  handleRevoke: (id: string) => void;
}) {
  return (
    <>
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
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. my-bot"
              className="db-input"
            />
            <button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || creating}
              className="db-btn db-btn-primary"
              style={{ flexShrink: 0 }}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>

          {createdKey && (
            <div style={{
              background: "var(--accent-glow)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
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
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-mute)", padding: "32px 20px" }}>
                  Loading…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-mute)", padding: "32px 20px" }}>
                  No API keys yet
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                      {k.prefix}
                    </span>
                  </td>
                  <td>
                    <span className={`db-badge ${k.is_active ? "db-badge-active" : "db-badge-revoked"}`}>
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="db-btn db-btn-danger"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HistoryTab({
  history,
  loading,
}: {
  history: HistoryItem[];
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? history.filter((h) => h.query.toLowerCase().includes(query.toLowerCase()))
    : history;

  return (
    <>
      <div className="db-history-toolbar">
        <div className="db-search-wrap">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Filter searches…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="db-input"
          />
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-mute)", padding: "48px 0" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text-mute)", padding: "48px 0" }}>
          {history.length === 0
            ? "No search history yet. Searches made with your API keys will appear here."
            : "No results match your filter."}
        </p>
      ) : (
        <div className="db-history-grid">
          {filtered.map((h) => (
            <a
              key={h.id}
              href={`/v/${h.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="db-history-card"
            >
              <div className="db-history-thumbs">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="db-thumb" />
                ))}
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

const PLANS: { key: Plan; name: string; price: string; desc: string; features: string[] }[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    desc: "Get started for free",
    features: ["10 searches / day", "50 searches / month", "7-day result TTL"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    desc: "For power users",
    features: ["70 searches / day", "2,000 searches / month", "30-day result TTL", "API key dashboard"],
  },
  {
    key: "ultra",
    name: "Ultra",
    price: "$49",
    desc: "Unlimited access",
    features: ["350 searches / day", "10,000 searches / month", "Unlimited result TTL", "Search history"],
  },
];

function PlanSection({
  plan,
  subscription,
  usage,
}: {
  plan: Plan;
  subscription: SubscriptionInfo | null;
  usage: Usage;
}) {
  const [upgrading, setUpgrading] = useState<Plan | null>(null);
  const formatDate = (unix: number) => new Date(unix * 1000).toLocaleDateString();

  async function handleUpgrade(target: Plan) {
    setUpgrading(target);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const todayPct = Math.min((usage.today / usage.dailyLimit) * 100, 100);
  const monthPct = Math.min((usage.thisMonth / usage.monthlyLimit) * 100, 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Current plan info */}
      <div className="db-card">
        <div className="db-card-header">
          <div>
            <p className="db-card-title">Current plan</p>
            <p className="db-card-sub">
              {subscription
                ? subscription.cancelAt
                  ? `Ends on ${formatDate(subscription.cancelAt)}`
                  : `Renews on ${formatDate(subscription.currentPeriodEnd)}`
                : "No active subscription"}
            </p>
          </div>
          {plan !== "free" && (
            <button onClick={handleManage} className="db-btn db-btn-ghost" style={{ fontSize: 12 }}>
              Manage subscription
            </button>
          )}
        </div>
        <div className="db-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "var(--text-dim)" }}>Today</span>
              <span style={{ color: "var(--text)", fontFeatureSettings: '"tnum"' }}>
                {usage.today.toLocaleString()} / {usage.dailyLimit.toLocaleString()}
              </span>
            </div>
            <div className="db-usage-bar-wrap">
              <div className="db-usage-bar-fill" style={{ width: `${todayPct}%` }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "var(--text-dim)" }}>This month</span>
              <span style={{ color: "var(--text)", fontFeatureSettings: '"tnum"' }}>
                {usage.thisMonth.toLocaleString()} / {usage.monthlyLimit.toLocaleString()}
              </span>
            </div>
            <div className="db-usage-bar-wrap">
              <div className="db-usage-bar-fill" style={{ width: `${monthPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="db-plan-grid">
        {PLANS.map((p) => {
          const isCurrent = p.key === plan;
          const isDowngrade =
            (plan === "ultra" && p.key === "pro") || (plan !== "free" && p.key === "free");
          return (
            <div key={p.key} className={`db-plan-card${isCurrent ? " current" : ""}`}>
              {isCurrent && <span className="db-plan-tag">CURRENT</span>}
              <p className="db-plan-name">{p.name}</p>
              <p className="db-plan-price">
                {p.price}<small>/mo</small>
              </p>
              <p className="db-plan-desc">{p.desc}</p>
              <ul className="db-plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2.5 7l3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="db-btn db-btn-ghost" style={{ width: "100%", justifyContent: "center", cursor: "default", opacity: 0.5 }} disabled>
                  Current plan
                </button>
              ) : isDowngrade ? (
                <button onClick={handleManage} className="db-btn db-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
                  Manage
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(p.key)}
                  disabled={upgrading !== null}
                  className="db-btn db-btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={handleCopy} className="db-btn db-btn-ghost" style={{ flexShrink: 0 }}>
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
