import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs — PixS99",
  description: "PixS99 API documentation. Search images and get a shareable viewer URL.",
};

export default function DocsPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="PixS99" className="w-8 h-8" />
            <span className="font-bold text-lg tracking-tight">PixS99</span>
          </a>
          <a
            href="/dashboard"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="text-muted mt-2">
            One endpoint. Search images, get a viewer URL.
          </p>
        </div>

        {/* Auth */}
        <Section title="Authentication">
          <p>
            Include your API key in the <Code>Authorization</Code> header:
          </p>
          <CodeBlock>
            {`Authorization: Bearer ps99_your_api_key_here`}
          </CodeBlock>
          <p>
            Get your API key from the{" "}
            <a href="/dashboard" className="text-accent hover:underline">
              Dashboard
            </a>
            .
          </p>
        </Section>

        {/* Search endpoint */}
        <Section title="POST /api/search">
          <p>Search images and generate a shareable viewer page.</p>

          <H3>Request</H3>
          <CodeBlock>
            {`curl -X POST https://pixs99.com/api/search \\
  -H "Authorization: Bearer ps99_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "tokyo skyline", "count": 10}'`}
          </CodeBlock>

          <H3>Parameters</H3>
          <Table
            headers={["Field", "Type", "Required", "Description"]}
            rows={[
              ["query", "string", "Yes", "Search query"],
              ["count", "number", "No", "Number of images (1–20, default 8)"],
            ]}
          />

          <H3>Response</H3>
          <CodeBlock>
            {`{
  "viewer_url": "https://pixs99.com/v/abc123",
  "id": "abc123",
  "query": "tokyo skyline",
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "title": "Tokyo Skyline at Night",
      "source": "https://example.com/page",
      "width": 1920,
      "height": 1080
    }
  ]
}`}
          </CodeBlock>
        </Section>

        {/* Rate limits */}
        <Section title="Rate Limits">
          <Table
            headers={["Tier", "Limit"]}
            rows={[
              ["API key", "50 requests / day"],
              ["Demo (no key)", "10 requests / day per IP"],
            ]}
          />
          <p>
            When exceeded, the API returns <Code>429</Code> with{" "}
            <Code>Rate limit exceeded</Code>.
          </p>
        </Section>

        {/* Errors */}
        <Section title="Errors">
          <Table
            headers={["Status", "Meaning"]}
            rows={[
              ["400", "Missing or invalid query"],
              ["401", "Invalid or missing API key"],
              ["429", "Rate limit exceeded"],
              ["500", "Internal error"],
            ]}
          />
        </Section>
      </main>

      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-3xl mx-auto text-xs text-muted">
          Powered by{" "}
          <a href="/" className="text-accent hover:underline">
            PixS99
          </a>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-sm mt-4">{children}</h3>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-card border border-border text-xs font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-lg bg-card border border-border p-4 font-mono text-xs overflow-x-auto text-muted">
      <code>{children}</code>
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 text-left font-medium text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 font-mono text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
