import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id) return false;

      const githubId = String(profile.id);
      const name = profile.name ?? profile.login ?? "";
      const email = profile.email ?? "";
      const avatarUrl = (profile as Record<string, unknown>).avatar_url as string ?? "";

      // Upsert user
      await sql`
        INSERT INTO users (github_id, name, email, avatar_url, updated_at)
        VALUES (${githubId}, ${name}, ${email}, ${avatarUrl}, NOW())
        ON CONFLICT (github_id)
        DO UPDATE SET name = ${name}, email = ${email}, avatar_url = ${avatarUrl}, updated_at = NOW()
      `;

      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.id) {
        token.githubId = String(profile.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.githubId) {
        session.user.id = token.githubId as string;
      }
      return session;
    },
  },
});
