import { NextRequest, NextResponse } from "next/server";
import { stripe, planFromPriceId } from "@/lib/stripe";
import { setUserPlan } from "@/lib/store";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const githubId = session.metadata?.github_id;
      if (!githubId) break;

      // Retrieve the subscription to get the price ID
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const priceId = subscription.items.data[0]?.price.id;
      if (priceId) {
        await setUserPlan(githubId, planFromPriceId(priceId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const githubId = subscription.metadata?.github_id
        ?? (await getGithubIdFromCustomer(subscription.customer as string));
      if (!githubId) break;

      const priceId = subscription.items.data[0]?.price.id;
      if (priceId) {
        await setUserPlan(githubId, planFromPriceId(priceId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const githubId = subscription.metadata?.github_id
        ?? (await getGithubIdFromCustomer(subscription.customer as string));
      if (githubId) {
        await setUserPlan(githubId, "free");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function getGithubIdFromCustomer(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.github_id ?? null;
}
