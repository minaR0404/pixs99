import { neon } from "@neondatabase/serverless";
import type { Plan } from "./stripe";
import { PLAN_CONFIG } from "./stripe";

const sql = neon(process.env.DATABASE_URL!);

const DEMO_LIMIT = 10; // IP単位: 1日10回

/**
 * レート制限チェック & カウント加算
 * @returns 残り回数。制限超過なら -1
 */
export async function checkRateLimit(
  key: string,
  type: "demo" | "api",
  plan: Plan = "free"
): Promise<number> {
  const limit = type === "demo" ? DEMO_LIMIT : PLAN_CONFIG[plan].searchesPerDay;

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
