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

export async function getAnalytics(githubId: string): Promise<{
  totalRequests: number;
  totalImages: number;
  thisWeekRequests: number;
  thisWeekImages: number;
  prevWeekRequests: number;
  prevWeekImages: number;
  daily: { date: string; count: number; images: number }[];
  topQueries: { query: string; count: number }[];
}> {
  const [totals, daily, queries] = await Promise.all([
    sql`
      SELECT
        COUNT(*) AS total_requests,
        COALESCE(SUM(image_count), 0) AS total_images,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week_requests,
        COALESCE(SUM(image_count) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS this_week_images,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS prev_week_requests,
        COALESCE(SUM(image_count) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0) AS prev_week_images
      FROM usage_logs
      WHERE api_key_hash IN (
        SELECT key_hash FROM api_keys WHERE github_id = ${githubId}
      )
    `,
    sql`
      SELECT
        created_at::date::text AS date,
        COUNT(*) AS count,
        COALESCE(SUM(image_count), 0) AS images
      FROM usage_logs
      WHERE api_key_hash IN (
        SELECT key_hash FROM api_keys WHERE github_id = ${githubId}
      )
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY created_at::date
    `,
    sql`
      SELECT query, COUNT(*) AS count
      FROM usage_logs
      WHERE api_key_hash IN (
        SELECT key_hash FROM api_keys WHERE github_id = ${githubId}
      )
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT 5
    `,
  ]);

  return {
    totalRequests: Number(totals[0]?.total_requests ?? 0),
    totalImages: Number(totals[0]?.total_images ?? 0),
    thisWeekRequests: Number(totals[0]?.this_week_requests ?? 0),
    thisWeekImages: Number(totals[0]?.this_week_images ?? 0),
    prevWeekRequests: Number(totals[0]?.prev_week_requests ?? 0),
    prevWeekImages: Number(totals[0]?.prev_week_images ?? 0),
    daily: daily.map(r => ({
      date: r.date as string,
      count: Number(r.count),
      images: Number(r.images),
    })),
    topQueries: queries.map(r => ({
      query: r.query as string,
      count: Number(r.count),
    })),
  };
}
