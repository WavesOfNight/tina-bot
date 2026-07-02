import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildRoles } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Trophy } from "lucide-react";

async function addReward(guildId: string, formData: FormData) {
  "use server";
  const level = Number(formData.get("level"));
  const roleId = formData.get("roleId") as string;
  if (!level || !roleId) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.levelReward.upsert({
    where: { guildId_level: { guildId, level } },
    create: { guildId, level, roleId },
    update: { roleId },
  });
  revalidatePath(`/dashboard/${guildId}/niveaux`);
}

async function removeReward(guildId: string, id: number) {
  "use server";
  await prisma.levelReward.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/niveaux`);
}

export default async function NiveauxPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [top, rewards, roles] = await Promise.all([
    prisma.member.findMany({ where: { guildId }, orderBy: { xp: "desc" }, take: 15 }),
    prisma.levelReward.findMany({ where: { guildId }, orderBy: { level: "asc" } }),
    getGuildRoles(guildId),
  ]);

  const add = addReward.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={Trophy} title="Niveaux (Nv 1-50)" subtitle="Classement et recompenses de niveau" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Classement</h2>
          <div className="space-y-1">
            {top.length === 0 && <p className="text-sm text-lavender-600">Personne n&apos;a encore gagne d&apos;experience.</p>}
            {top.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-white/40">
                <span>
                  #{i + 1} - {m.userId}
                </span>
                <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-xs font-medium text-aqua-800">Nv {m.level}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Recompenses de niveau</h2>
          <form action={add} className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-lavender-600">Niveau</label>
              <input type="number" name="level" min={1} max={50} required className="w-20 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-lavender-600">Role</label>
              <select name="roleId" required className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-4 py-2 text-sm font-medium text-white shadow-glass">
              Ajouter
            </button>
          </form>

          <div className="space-y-1">
            {rewards.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/40 px-2 py-1.5 text-sm">
                <span>
                  Niveau {r.level} -{" "}
                  {roles.find((role) => role.id === r.roleId)?.name ?? r.roleId}
                </span>
                <form action={removeReward.bind(null, guildId, r.id)}>
                  <button type="submit" className="rounded-full bg-coral-100 px-2 py-0.5 text-xs text-coral-600">
                    Retirer
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
