import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { Keyboard } from "lucide-react";

export const dynamic = "force-dynamic";

async function addCommand(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim().toLowerCase().replace(/\s+/g, "");
  const response = (formData.get("response") as string)?.trim();
  const cooldownSeconds = Math.max(0, Number(formData.get("cooldownSeconds")) || 5);
  if (!name || !response) return;

  await prisma.twitchCommand.upsert({
    where: { name },
    create: { name, response, cooldownSeconds },
    update: { response, cooldownSeconds },
  });
  revalidatePath("/dashboard/twitch/commandes");
}

async function deleteCommand(id: number) {
  "use server";
  await prisma.twitchCommand.delete({ where: { id } });
  revalidatePath("/dashboard/twitch/commandes");
}

export default async function TwitchCommandesPage() {
  const [commands, config] = await Promise.all([
    prisma.twitchCommand.findMany({ orderBy: { name: "asc" } }),
    prisma.twitchBotConfig.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div>
      <PageHeader icon={Keyboard} title="Commandes" subtitle="Commandes personnalisees declenchees dans le chat Twitch" />

      <form action={addCommand} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom (sans prefixe)</label>
          <input name="name" required placeholder="discord" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse</label>
          <input
            name="response"
            required
            placeholder="Rejoins le Discord : {channel} !"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Cooldown (s)</label>
          <input name="cooldownSeconds" type="number" min={0} defaultValue={5} className="w-20 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {commands.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune commande personnalisee pour le moment.</p>}
        {commands.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {config?.prefix ?? "!"}
                {c.name}
              </p>
              <p className="text-sm text-lavender-600">{c.response}</p>
              <p className="text-xs text-lavender-400">
                {c.uses} utilisation{c.uses > 1 ? "s" : ""} - cooldown {c.cooldownSeconds}s
              </p>
            </div>
            <form action={deleteCommand.bind(null, c.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
