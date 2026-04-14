import { NextResponse } from "next/server";
import { auth } from "@/lib/next-auth";
import { getSearchHistory } from "@/lib/store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await getSearchHistory(session.user.id);
  return NextResponse.json({ history });
}
