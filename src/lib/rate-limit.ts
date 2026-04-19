import { neon } from "@neondatabase/serverless";
import type { Plan } from "./stripe";
import { PLAN_CONFIG } from "./stripe";

const sql = neon(process.env.DATABASE_URL!);

const DEMO_LIMIT = 10; // IP単位: 1日10回

/**
 * レート制限チェック & カウント加算（日次 + 月次）
 * @returns 日次残り回数。制限超過なら -1
 */
export async function checkRateLimit(
  key: string,
  type: "demo" | "api",
  plan: Plan = "free"
): Promise<number> {
  const dayLimit = type === "demo" ? DEMO_LIMIT : PLAN_CONFIG[plan].searchesPerDay;
  const monthLimit = type === "demo" ? null : PLAN_CONFIG[plan].searchesPerMonth;

  const dayRows = await sql`
    INSERT INTO rate_limits (key, date, count)
    VALUES (${key}, CURRENT_DATE, 1)
    ON CONFLICT (key, date)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;
  const dayCount = dayRows[0].count as number;
  if (dayCount > dayLimit) return -1;

  if (monthLimit !== null) {
    const monthRows = await sql`
      INSERT INTO rate_limits (key, date, count)
      VALUES (${`m:${key}`}, date_trunc('month', CURRENT_DATE)::date, 1)
      ON CONFLICT (key, date)
      DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `;
    const monthCount = monthRows[0].count as number;
    if (monthCount > monthLimit) return -1;
  }

  return dayLimit - dayCount;
}
