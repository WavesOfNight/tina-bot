import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { getBotConfig, verifyAdminCredentials } from "@tina/database";

export type SessionRole = "owner" | "guild-admin";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const botConfig = await getBotConfig();

  return {
    secret: process.env.NEXTAUTH_SECRET,
    trustHost: true,
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        id: "credentials",
        name: "Compte admin",
        credentials: {
          username: { label: "Nom d'utilisateur", type: "text" },
          password: { label: "Mot de passe", type: "password" },
        },
        authorize: async (credentials) => {
          const username = credentials?.username as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!username || !password) return null;

          const admin = await verifyAdminCredentials(username, password);
          if (!admin) return null;

          return { id: String(admin.id), name: admin.username };
        },
      }),
      ...(botConfig?.clientSecret
        ? [
            Discord({
              clientId: botConfig.clientId,
              clientSecret: botConfig.clientSecret,
              authorization: { params: { scope: "identify guilds" } },
            }),
          ]
        : []),
    ],
    callbacks: {
      async jwt({ token, user, account }) {
        if (user?.name) token.name = user.name;
        if (account?.provider === "credentials") {
          token.role = "owner" satisfies SessionRole;
        } else if (account?.provider === "discord") {
          token.role = "guild-admin" satisfies SessionRole;
          token.accessToken = account.access_token;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.name = (token.name as string) ?? session.user.name;
        }
        const extendedSession = session as typeof session & { role?: SessionRole; accessToken?: string };
        extendedSession.role = (token.role as SessionRole) ?? "owner";
        extendedSession.accessToken = token.accessToken as string | undefined;
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
  };
});
