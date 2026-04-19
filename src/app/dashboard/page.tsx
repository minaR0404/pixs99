import { auth, signIn, signOut } from "@/lib/next-auth";
import { getUserPlan, getStripeCustomerId } from "@/lib/store";
import { getSubscriptionInfo } from "@/lib/stripe";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted">Sign in to manage your API keys</p>
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/dashboard" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Sign in with GitHub
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        user={{ name: session.user.name ?? "", image: session.user.image ?? "" }}
      />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
        <DashboardClient {...await loadPlanProps(session.user.id!)} />
      </main>
    </div>
  );
}

async function loadPlanProps(githubId: string) {
  const plan = await getUserPlan(githubId);
  if (plan === "free") return { plan, subscription: null };
  const customerId = await getStripeCustomerId(githubId);
  const subscription = customerId ? await getSubscriptionInfo(customerId) : null;
  return { plan, subscription };
}

function Header({ user }: { user?: { name: string; image: string } }) {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="PixS99" className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight">PixS99</span>
        </a>
        {user && (
          <div className="flex items-center gap-2">
            {user.image && (
              <img
                src={user.image}
                alt={user.name}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm text-muted">{user.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
