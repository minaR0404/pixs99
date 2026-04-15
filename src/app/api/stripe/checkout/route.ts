import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/next-auth";
import { stripe, PLAN_CONFIG, Plan } from "@/lib/stripe";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = (await req.json()) as { plan: Plan };
  const config = PLAN_CONFIG[plan];

  if (!config?.priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const githubId = session.user.id;

  // Get or create Stripe customer
  let customerId = await getStripeCustomerId(githubId);
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { github_id: githubId },
    });
    customerId = customer.id;
    await setStripeCustomerId(githubId, customerId);
  }

  const origin = req.nextUrl.origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: config.priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url: `${origin}/dashboard`,
    metadata: { github_id: githubId, plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
