import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";

async function addCommand(guildId: string, formData: FormData) {
  "use server";
  const name = (formData.get("name") as string).toLowerCase().trim().replace(/\s+/g, "-");
  const response = formData.get("response") as string;
  if (!name || !response) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.customCommand.upsert({
    where: { guildId_name: { guildId, name } },
    create: { guildId, name, response },
    update: { response },
  });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteCommand(guildId: string, id: number) {
  "use server";
  await prisma.customCommand.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function addAutoResponse(guildId: string, formData: FormData) {
  "use server";
  const trigger = (formData.get("trigger") as string)?.trim();
  const response = (formData.get("autoResponse") as string)?.trim();
  const matchType = (formData.get("matchType") as string) === "EXACT" ? "EXACT" : "CONTAINS";
  if (!trigger || !response) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.autoResponse.create({ data: { guildId, trigger, response, matchType } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteAutoResponse(guildId: string, id: number) {
  "use server";
  await prisma.autoResponse.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

export default async function CommandesPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [commands, guild, autoResponses] = await Promise.all([
    prisma.customCommand.findMany({ where: { guildId }, orderBy: { name: "asc" } }),
    prisma.guild.findUnique({ where: { id: guildId } }),
    prisma.autoResponse.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } }),
  ]);
  const prefix = guild?.prefix ?? "!";

  const add = addCommand.bind(null, guildId);

  return (
    <div>
      <PageHeader icon="⌨️" title={`Commandes Perso (${commands.length})`} subtitle="Commandes texte et reponses automatiques" />

      <form action={add} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom (sans prefixe)</label>
          <input name="name" required placeholder="regles" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse</label>
          <input name="response" required placeholder="Consulte le reglement dans #regles" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {commands.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune commande personnalisee pour le moment.</p>}
        {commands.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {prefix}
                {c.name}
              </p>
              <p className="text-sm text-lavender-600">{c.response}</p>
            </div>
            <form action={deleteCommand.bind(null, guildId, c.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="font-display mb-4 mt-8 flex items-center gap-2 text-lg font-semibold text-lavender-900">
        <span aria-hidden="true">💬</span> Reponses automatiques ({autoResponses.length})
      </h2>
      <p className="mb-3 text-xs text-lavender-500">
        Contrairement aux commandes perso (declenchees par {prefix}nom), une reponse automatique se declenche des qu'un
        mot apparait dans un message normal.
      </p>

      <form action={addAutoResponse.bind(null, guildId)} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Mot declencheur</label>
          <input name="trigger" required placeholder="miaou" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse du bot</label>
          <input name="autoResponse" required placeholder="miaou !" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Correspondance</label>
          <select name="matchType" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="CONTAINS">Message contient le mot</option>
            <option value="EXACT">Message = exactement le mot</option>
          </select>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {autoResponses.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune reponse automatique pour le moment.</p>}
        {autoResponses.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {r.matchType === "EXACT" ? `"${r.trigger}"` : `contient "${r.trigger}"`}
                <span className="ml-2 rounded-full bg-aqua-100 px-2 py-0.5 text-[10px] font-medium text-aqua-800">
                  {r.matchType === "EXACT" ? "mot exact" : "contient"}
                </span>
              </p>
              <p className="text-sm text-lavender-600">→ {r.response}</p>
            </div>
            <form action={deleteAutoResponse.bind(null, guildId, r.id)}>
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
