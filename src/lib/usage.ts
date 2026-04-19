import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function logUsage(params: {
  query: string;
  imageCount: number;
  isDemo: boolean;
  apiKey?: string;
  ip?: string;
}): Promise<void> {
  const id = randomBytes(8).toString("hex");
  await sql`
    INSERT INTO usage_logs (id, api_key_hash, query, image_count, is_demo, ip, created_at)
    VALUES (
      ${id},
      ${params.apiKey ? hashKey(params.apiKey) : null},
      ${params.query},
      ${params.imageCount},
      ${params.isDemo},
      ${params.ip ?? null},
      NOW()
    )
  `;
}

export async function getUsageByKey(apiKeyHash: string): Promise<{
  today: number;
  total: number;
}> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS today,
      COUNT(*) AS total
    FROM usage_logs
    WHERE api_key_hash = ${apiKeyHash}
  `;
  return {
    today: Number(rows[0].today),
    total: Number(rows[0].total),
  };
}

export async function getUserUsage(githubId: string): Promise<{
  today: number;
  thisMonth: number;
}> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE u.created_at::date = CURRENT_DATE) AS today,
      COUNT(*) FILTER (WHERE u.created_at >= date_trunc('month', CURRENT_DATE)) AS this_month
    FROM usage_logs u
    WHERE u.api_key_hash IN (
      SELECT key_hash FROM api_keys WHERE github_id = ${githubId}
    )
  `;
  return {
    today: Number(rows[0].today),
    thisMonth: Number(rows[0].this_month),
  };
}
