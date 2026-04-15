import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/next-auth";
import { stripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = await getStripeCustomerId(session.user.id);
  if (!customerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${req.nextUrl.origin}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
