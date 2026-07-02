import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { createPermanentInvite, getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

async function generateInvite(guildId: string, formData: FormData) {
  "use server";
  const channelId = formData.get("channelId") as string;
  if (!channelId) return;

  const invite = await createPermanentInvite(channelId);
  if (!invite) return;

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, permanentInviteCode: invite.code, permanentInviteChannelId: channelId },
    update: { permanentInviteCode: invite.code, permanentInviteChannelId: channelId },
  });
  revalidatePath(`/dashboard/${guildId}/invitation`);
}

export default async function InvitationPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, channels] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId, 0),
  ]);

  const generate = generateInvite.bind(null, guildId);
  const inviteUrl = guild?.permanentInviteCode ? `https://discord.gg/${guild.permanentInviteCode}` : null;
  const currentChannelName = channels.find((c) => c.id === guild?.permanentInviteChannelId)?.name;

  return (
    <div>
      <PageHeader icon={Link2} title="Invitation" subtitle="Un lien d'invitation permanent pour ton serveur" />

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${inviteUrl ? "bg-aqua-400" : "bg-lavender-200"}`} />
          <p className="text-sm text-lavender-800">
            {inviteUrl ? (
              <>
                Lien actif, cree depuis <span className="font-medium">#{currentChannelName ?? guild?.permanentInviteChannelId}</span>
              </>
            ) : (
              "Aucun lien d'invitation permanent pour le moment"
            )}
          </p>
        </div>

        {inviteUrl && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2">
            <code className="flex-1 text-sm text-lavender-900">{inviteUrl}</code>
            <a
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="bubble-btn rounded-full bg-lavender-400 px-4 py-1.5 text-xs font-medium text-white shadow-glass"
            >
              Ouvrir
            </a>
          </div>
        )}

        <form action={generate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Salon source</label>
            <select
              name="channelId"
              defaultValue={guild?.permanentInviteChannelId ?? ""}
              className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choisir un salon...
              </option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  # {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            {inviteUrl ? "Regenerer le lien" : "Creer le lien"}
          </button>
        </form>

        {channels.length === 0 && <p className="mt-3 text-xs text-coral-500">Aucun salon textuel trouve sur ce serveur.</p>}

        <p className="mt-4 text-xs text-lavender-400">
          Ce lien n&apos;expire jamais et n&apos;a pas de limite d&apos;utilisation. Tina [BOT] verifie automatiquement qu&apos;il reste
          valide et le recree s&apos;il a ete supprime. La commande <span className="font-medium">/invite</span> affiche le meme lien
          directement dans Discord.
        </p>
      </div>
    </div>
  );
}
