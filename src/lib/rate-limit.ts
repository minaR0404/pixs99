import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const LIMITS = {
  demo: 10,    // IP単位: 1日10回
  api: 50,     // APIキー単位: 1日50回
};

/**
 * レート制限チェック & カウント加算
 * @returns 残り回数。制限超過なら -1
 */
export async function checkRateLimit(
  key: string,
  type: "demo" | "api"
): Promise<number> {
  const limit = LIMITS[type];

  const rows = await sql`
    INSERT INTO rate_limits (key, date, count)
    VALUES (${key}, CURRENT_DATE, 1)
    ON CONFLICT (key, date)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;

  const count = rows[0].count as number;
  if (count > limit) return -1;
  return limit - count;
}
