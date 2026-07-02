import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Radio as RadioIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const RADIO_URL = "https://radio.reads-records.com/listen/reads_radio/radio.mp3";

async function startRadio(guildId: string, formData: FormData) {
  "use server";
  const radioChannelId = formData.get("radioChannelId") as string;
  if (!radioChannelId) return;

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, radioChannelId, radioEnabled: true },
    update: { radioChannelId, radioEnabled: true },
  });
  revalidatePath(`/dashboard/${guildId}/radio`);
}

async function stopRadio(guildId: string) {
  "use server";
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, radioEnabled: false },
    update: { radioEnabled: false },
  });
  revalidatePath(`/dashboard/${guildId}/radio`);
}

export default async function RadioPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, voiceChannels] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId, 2),
  ]);

  const start = startRadio.bind(null, guildId);
  const stop = stopRadio.bind(null, guildId);
  const isPlaying = Boolean(guild?.radioEnabled && guild.radioChannelId);
  const currentChannelName = voiceChannels.find((c) => c.id === guild?.radioChannelId)?.name;

  return (
    <div>
      <PageHeader icon={RadioIcon} title="Radio" subtitle="Diffuse la radio READS dans un salon vocal" />

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isPlaying ? "bg-aqua-400" : "bg-lavender-200"}`} />
          <p className="text-sm text-lavender-800">
            {isPlaying ? (
              <>
                En cours de diffusion dans <span className="font-medium">🔊 {currentChannelName ?? guild?.radioChannelId}</span>
              </>
            ) : (
              "Radio actuellement arretee"
            )}
          </p>
        </div>
        <p className="mb-4 break-all text-xs text-lavender-500">Flux : {RADIO_URL}</p>

        <form action={start} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Salon vocal</label>
            <select
              name="radioChannelId"
              defaultValue={guild?.radioChannelId ?? ""}
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
          <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            {isPlaying ? "Changer de salon" : "Lancer la radio"}
          </button>
          {isPlaying && (
            <button
              formAction={stop}
              className="bubble-btn rounded-full bg-coral-100 px-5 py-2 text-sm font-medium text-coral-600 shadow-glass"
            >
              Arreter
            </button>
          )}
        </form>

        {voiceChannels.length === 0 && (
          <p className="mt-3 text-xs text-coral-500">Aucun salon vocal trouve sur ce serveur.</p>
        )}

        <p className="mt-4 text-xs text-lavender-400">
          Le changement peut prendre jusqu&apos;a 15 secondes le temps que le bot rejoigne le salon.
        </p>
      </div>
    </div>
  );
}
