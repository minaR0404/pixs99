import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export type Plan = "free" | "pro" | "ultra";

export const PLAN_CONFIG: Record<Plan, {
  name: string;
  priceId: string | null;
  searchesPerDay: number;
  searchesPerMonth: number;
  ttlDays: number | null; // null = unlimited
}> = {
  free: {
    name: "Free",
    priceId: null,
    searchesPerDay: 10,
    searchesPerMonth: 50,
    ttlDays: 7,
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    searchesPerDay: 70,
    searchesPerMonth: 2000,
    ttlDays: 30,
  },
  ultra: {
    name: "Ultra",
    priceId: process.env.STRIPE_ULTRA_PRICE_ID ?? "",
    searchesPerDay: 350,
    searchesPerMonth: 10000,
    ttlDays: null,
  },
};

export function planFromPriceId(priceId: string): Plan {
  for (const [plan, config] of Object.entries(PLAN_CONFIG)) {
    if (config.priceId === priceId) return plan as Plan;
  }
  return "free";
}

export interface SubscriptionInfo {
  currentPeriodEnd: number;
  cancelAt: number | null;
}

export async function getSubscriptionInfo(
  customerId: string
): Promise<SubscriptionInfo | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) return null;
  const periodEnd = sub.items.data[0]?.current_period_end;
  if (!periodEnd) return null;
  const cancelAt = sub.cancel_at ?? (sub.cancel_at_period_end ? periodEnd : null);
  return { currentPeriodEnd: periodEnd, cancelAt };
}
