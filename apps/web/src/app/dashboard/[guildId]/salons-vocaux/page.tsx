import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Mic } from "lucide-react";

export const dynamic = "force-dynamic";

async function saveHub(guildId: string, formData: FormData) {
  "use server";
  const hubVoiceChannelId = formData.get("hubVoiceChannelId") as string;
  const hubChannelNameTemplate = (formData.get("hubChannelNameTemplate") as string)?.trim() || "🔊 Salon de {user}";
  if (!hubVoiceChannelId) return;

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, hubVoiceChannelId, hubChannelNameTemplate },
    update: { hubVoiceChannelId, hubChannelNameTemplate },
  });
  revalidatePath(`/dashboard/${guildId}/salons-vocaux`);
}

async function stopHub(guildId: string) {
  "use server";
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, hubVoiceChannelId: null },
    update: { hubVoiceChannelId: null },
  });
  revalidatePath(`/dashboard/${guildId}/salons-vocaux`);
}

export default async function SalonsVocauxPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, voiceChannels] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId, 2),
  ]);

  const save = saveHub.bind(null, guildId);
  const stop = stopHub.bind(null, guildId);
  const isEnabled = Boolean(guild?.hubVoiceChannelId);
  const hubChannelName = voiceChannels.find((c) => c.id === guild?.hubVoiceChannelId)?.name;

  return (
    <div>
      <PageHeader
        icon={Mic}
        title="Salons Vocaux Personnalises"
        subtitle="Les membres creent leur propre salon vocal en rejoignant un salon dedie"
      />

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isEnabled ? "bg-aqua-400" : "bg-lavender-200"}`} />
          <p className="text-sm text-lavender-800">
            {isEnabled ? (
              <>
                Actif sur <span className="font-medium">🔊 {hubChannelName ?? guild?.hubVoiceChannelId}</span>
              </>
            ) : (
              "Fonctionnalite actuellement desactivee"
            )}
          </p>
        </div>

        <form action={save} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Salon "Creer un salon"</label>
            <select
              name="hubVoiceChannelId"
              defaultValue={guild?.hubVoiceChannelId ?? ""}
              className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choisir un salon...
              </option>
              {voiceChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  🔊 {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Nom par defaut du salon cree</label>
            <input
              name="hubChannelNameTemplate"
              defaultValue={guild?.hubChannelNameTemplate ?? "🔊 Salon de {user}"}
              placeholder="🔊 Salon de {user}"
              className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            {isEnabled ? "Enregistrer" : "Activer"}
          </button>
          {isEnabled && (
            <button
              formAction={stop}
              className="bubble-btn rounded-full bg-coral-100 px-5 py-2 text-sm font-medium text-coral-600 shadow-glass"
            >
              Desactiver
            </button>
          )}
        </form>

        {voiceChannels.length === 0 && (
          <p className="mt-3 text-xs text-coral-500">Aucun salon vocal trouve sur ce serveur.</p>
        )}

        <p className="mt-4 text-xs text-lavender-400">
          {"{user}"} est remplace par le pseudo du membre. Quand quelqu&apos;un rejoint le salon choisi ci-dessus, Tina lui cree
          aussitot son propre salon vocal (juste a cote) et l&apos;y deplace - lui seul peut le renommer ou en gerer les
          membres. Le salon est supprime automatiquement des qu&apos;il se vide.
        </p>
        <p className="mt-2 text-xs text-lavender-400">
          Si un membre essaie de renommer son salon avec un mot interdit par la moderation automatique, Tina le previent, lui
          inflige un avertissement et supprime aussitot le salon.
        </p>
      </div>
    </div>
  );
}
