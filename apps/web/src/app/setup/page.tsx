import { redirect } from "next/navigation";
import { createAdminUser, hasAdminUser } from "@tina/database";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

async function createFirstAdmin(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!username || !password || password.length < 8 || password !== confirm) {
    redirect("/setup?error=1");
  }
  if (await hasAdminUser()) {
    redirect("/login");
  }

  await createAdminUser(username, password);
  await signIn("credentials", { username, password, redirectTo: "/dashboard" });
}

export default async function SetupPage({ searchParams }: { searchParams: { error?: string } }) {
  if (await hasAdminUser()) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md rounded-aero p-10 shadow-glass">
        <div className="mb-6 text-center">
          <svg width="90" height="90" viewBox="0 0 100 100" className="mx-auto mb-3" aria-hidden="true">
            <circle cx="50" cy="50" r="48" fill="#FAEEDA" />
            <path
              d="M20 45 Q25 10 50 12 Q80 10 82 45 Q84 60 75 60 Q78 40 60 30 Q50 45 40 30 Q25 40 25 60 Q16 60 20 45 Z"
              fill="#993C1D"
            />
            <circle cx="38" cy="55" r="2" fill="#854F0B" />
            <circle cx="44" cy="58" r="2" fill="#854F0B" />
            <circle cx="62" cy="58" r="2" fill="#854F0B" />
            <circle cx="35" cy="60" r="4" fill="#F4C0D1" />
            <circle cx="65" cy="60" r="4" fill="#F4C0D1" />
            <ellipse cx="38" cy="52" rx="10" ry="8" fill="none" stroke="#444441" strokeWidth="2.5" />
            <ellipse cx="62" cy="52" rx="10" ry="8" fill="none" stroke="#444441" strokeWidth="2.5" />
            <line x1="48" y1="52" x2="52" y2="52" stroke="#444441" strokeWidth="2.5" />
          </svg>
          <h1 className="font-display text-2xl font-semibold text-lavender-900">Bienvenue sur Tina [BOT]</h1>
          <p className="text-sm text-lavender-600">Cree ton compte administrateur pour commencer</p>
        </div>

        {searchParams.error && (
          <p className="mb-4 rounded-xl bg-coral-100 px-3 py-2 text-sm text-coral-600">
            Verifie ton nom d&apos;utilisateur et un mot de passe d&apos;au moins 8 caracteres (identique dans les deux champs).
          </p>
        )}

        <form action={createFirstAdmin} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Nom d&apos;utilisateur</label>
            <input name="username" required className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Mot de passe</label>
            <input name="password" type="password" required minLength={8} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Confirmer le mot de passe</label>
            <input name="confirm" type="password" required minLength={8} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bubble-btn w-full rounded-full bg-lavender-400 px-6 py-3 font-medium text-white shadow-glass">
            Creer mon compte admin
          </button>
        </form>
      </div>
    </main>
  );
}
