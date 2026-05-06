import { NextResponse } from "next/server";
import { auth } from "@/lib/next-auth";
import { getAnalytics } from "@/lib/usage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const analytics = await getAnalytics(session.user.id);
  return NextResponse.json(analytics);
}
