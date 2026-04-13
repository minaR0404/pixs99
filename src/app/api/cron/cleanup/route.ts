import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const TTL_DAYS = 7;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sql`
    DELETE FROM search_results
    WHERE created_at < NOW() - MAKE_INTERVAL(days => ${TTL_DAYS})
  `;

  return NextResponse.json({
    deleted: result.length,
    ttl_days: TTL_DAYS,
  });
}
