"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  is_active: boolean;
  created_at: string;
}

export default function DashboardClient() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    const data = await res.json();
    setKeys(data.keys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

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
              <button
                onClick={() => navigator.clipboard.writeText(createdKey)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Copy
              </button>
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
    </div>
  );
}
