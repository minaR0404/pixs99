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
  cancelAtPeriodEnd: boolean;
}

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

export default function DashboardClient({
  plan,
  subscription,
}: {
  plan: Plan;
  subscription: SubscriptionInfo | null;
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

  if (loading) {
    return <p className="text-muted text-sm">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("keys")}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
            tab === "keys"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          API Keys
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
            tab === "history"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Search History
        </button>
        <button
          onClick={() => setTab("plan")}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
            tab === "plan"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Plan
        </button>
      </div>

      {tab === "keys" && (
        <>
          {/* Create new key */}
          <div className="rounded-lg bg-card border border-border p-5 space-y-4">
            <h2 className="font-semibold">Create new key</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Key name (e.g. my-bot)"
                className="flex-1 rounded-lg bg-background border border-border px-4 py-2.5 text-foreground placeholder:text-muted"
              />
              <button
                onClick={handleCreate}
                disabled={!newKeyName.trim() || creating}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>

            {createdKey && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-4 space-y-2">
                <p className="text-sm font-semibold text-accent">
                  Key created — copy it now, it won&apos;t be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background rounded px-3 py-2 break-all">
                    {createdKey}
                  </code>
                  <CopyButton text={createdKey} />
                </div>
              </div>
            )}
          </div>

          {/* Key list */}
          <div className="rounded-lg bg-card border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted">
                      No API keys yet
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium">{k.name}</td>
                      <td className="px-5 py-3 font-mono text-muted">{k.prefix}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            k.is_active
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {k.is_active ? "Active" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {k.is_active && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
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
      )}

      {tab === "plan" && (
        <PlanSection plan={plan} subscription={subscription} />
      )}

      {tab === "history" && (
        <div className="rounded-lg bg-card border border-border overflow-hidden">
          {!historyFetched || historyLoading ? (
            <p className="px-5 py-8 text-center text-muted text-sm">Loading...</p>
          ) : history.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted text-sm">
              No search history yet. Searches made with your API keys will appear here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-5 py-3 font-medium">Query</th>
                  <th className="px-5 py-3 font-medium">Images</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">{h.query}</td>
                    <td className="px-5 py-3 text-muted">{h.image_count}</td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(h.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <a
                        href={`/v/${h.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline text-xs font-medium"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const PLANS: { key: Plan; name: string; price: string; features: string[] }[] = [
  { key: "free", name: "Free", price: "$0", features: ["50 searches / month", "7-day TTL"] },
  { key: "pro", name: "Pro", price: "$19", features: ["2,000 searches / month", "30-day TTL", "API key dashboard"] },
  { key: "ultra", name: "Ultra", price: "$49", features: ["10,000 searches / month", "Unlimited TTL", "Search history"] },
];

function PlanSection({
  plan,
  subscription,
}: {
  plan: Plan;
  subscription: SubscriptionInfo | null;
}) {
  const [upgrading, setUpgrading] = useState<Plan | null>(null);

  const periodEndDate =
    subscription && new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString();

  async function handleUpgrade(target: Plan) {
    setUpgrading(target);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: target }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setUpgrading(null);
  }

  async function handleManage() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-card border border-border p-5 space-y-2">
        <p className="text-sm text-muted">
          Current plan: <span className="text-foreground font-semibold">{PLAN_LABELS[plan]}</span>
        </p>
        {subscription && periodEndDate && (
          subscription.cancelAtPeriodEnd ? (
            <p className="text-sm text-muted">
              Ends on <span className="text-foreground font-medium">{periodEndDate}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Renews on <span className="text-foreground font-medium">{periodEndDate}</span>
            </p>
          )
        )}
        {plan !== "free" && (
          <button
            onClick={handleManage}
            className="mt-1 text-sm text-accent hover:underline"
          >
            Manage subscription
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.key === plan;
          const isDowngrade = (plan === "ultra" && p.key === "pro") || (plan !== "free" && p.key === "free");
          return (
            <div
              key={p.key}
              className={`rounded-lg border p-5 space-y-3 ${
                isCurrent ? "bg-accent/5 border-accent/30" : "bg-card border-border"
              }`}
            >
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-2xl font-bold mt-1">
                  {p.price}<span className="text-sm font-normal text-muted">/mo</span>
                </p>
              </div>
              <ul className="space-y-1 text-sm text-muted">
                {p.features.map((f, i) => (
                  <li key={i}>+ {f}</li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="block text-center text-sm text-muted py-2">Current plan</span>
              ) : isDowngrade ? (
                <button
                  onClick={handleManage}
                  className="w-full rounded-lg py-2 text-sm font-medium bg-border text-foreground hover:opacity-80 transition-opacity"
                >
                  Manage
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(p.key)}
                  disabled={upgrading !== null}
                  className="w-full rounded-lg py-2 text-sm font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {upgrading === p.key ? "Redirecting..." : "Upgrade"}
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
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all ${
        copied ? "bg-green-600" : "bg-accent hover:opacity-90"
      }`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
