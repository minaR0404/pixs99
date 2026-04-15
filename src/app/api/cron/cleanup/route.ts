import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { PLAN_CONFIG } from "@/lib/stripe";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete expired results per plan TTL
  // Growth (ttlDays: null) is never deleted
  let totalDeleted = 0;

  for (const [plan, config] of Object.entries(PLAN_CONFIG)) {
    if (config.ttlDays === null) continue; // unlimited

    const result = await sql`
      DELETE FROM search_results
      WHERE created_at < NOW() - MAKE_INTERVAL(days => ${config.ttlDays})
        AND COALESCE(
          (SELECT plan FROM users WHERE users.github_id = search_results.github_id),
          'free'
        ) = ${plan}
    `;
    totalDeleted += result.length;
  }

  // Also clean up anonymous (demo) results with free TTL
  const demoResult = await sql`
    DELETE FROM search_results
    WHERE created_at < NOW() - MAKE_INTERVAL(days => ${PLAN_CONFIG.free.ttlDays!})
      AND github_id IS NULL
  `;
  totalDeleted += demoResult.length;

  return NextResponse.json({ deleted: totalDeleted });
}
