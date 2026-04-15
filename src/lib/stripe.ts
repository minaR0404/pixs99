import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export type Plan = "free" | "pro" | "growth";

export const PLAN_CONFIG: Record<Plan, {
  name: string;
  priceId: string | null;
  searchesPerDay: number;
  ttlDays: number | null; // null = unlimited
}> = {
  free: {
    name: "Free",
    priceId: null,
    searchesPerDay: 10,
    ttlDays: 7,
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    searchesPerDay: 70,
    ttlDays: 30,
  },
  growth: {
    name: "Growth",
    priceId: process.env.STRIPE_GROWTH_PRICE_ID ?? "",
    searchesPerDay: 350,
    ttlDays: null,
  },
};

export function planFromPriceId(priceId: string): Plan {
  for (const [plan, config] of Object.entries(PLAN_CONFIG)) {
    if (config.priceId === priceId) return plan as Plan;
  }
  return "free";
}
