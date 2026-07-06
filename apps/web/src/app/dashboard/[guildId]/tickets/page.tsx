import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildRoles, postTicketPanel } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Ticket as TicketIcon } from "lucide-react";

async function saveTicketConfig(guildId: string, formData: FormData) {
  "use server";
  const ticketCategoryId = (formData.get("ticketCategoryId") as string) || null;
  const ticketSupportRoleId = (formData.get("ticketSupportRoleId") as string) || null;
  const ticketPanelChannelId = (formData.get("ticketPanelChannelId") as string) || null;

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, ticketCategoryId, ticketSupportRoleId, ticketPanelChannelId },
    update: { ticketCategoryId, ticketSupportRoleId, ticketPanelChannelId },
  });
  revalidatePath(`/dashboard/${guildId}/tickets`);
}

async function publishPanel(guildId: string, channelId: string) {
  "use server";
  if (!channelId) return;
  await postTicketPanel(channelId);
  revalidatePath(`/dashboard/${guildId}/tickets`);
}

const STATUS_LABELS: Record<string, string> = { OPEN: "Ouvert", CLOSED: "Ferme" };

export default async function TicketsPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, categories, textChannels, roles, tickets] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId, 4),
    getGuildChannels(guildId, 0),
    getGuildRoles(guildId),
    prisma.ticket.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const save = saveTicketConfig.bind(null, guildId);
  const publish = publishPanel.bind(null, guildId, guild?.ticketPanelChannelId ?? "");

  return (
    <div>
      <PageHeader icon={TicketIcon} title="Tickets" subtitle="Support prive via un salon cree a la demande" />

      <form action={save} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Categorie des tickets</label>
          <select name="ticketCategoryId" defaultValue={guild?.ticketCategoryId ?? ""} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucune (tickets desactives)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Role support (voit tous les tickets)</label>
          <select name="ticketSupportRoleId" defaultValue={guild?.ticketSupportRoleId ?? ""} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon du panneau &quot;Ouvrir un ticket&quot;</label>
          <select name="ticketPanelChannelId" defaultValue={guild?.ticketPanelChannelId ?? ""} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      {guild?.ticketPanelChannelId && (
        <form action={publish} className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
          <p className="mb-3 text-xs text-lavender-500">
            Publie (ou republie) le message avec le bouton &quot;Ouvrir un ticket&quot; dans le salon configure ci-dessus.
          </p>
          <button type="submit" className="bubble-btn rounded-full bg-discord-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            Publier le panneau
          </button>
        </form>
      )}

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Tickets recents</h2>
      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {tickets.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun ticket pour le moment.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="text-sm font-medium text-lavender-900">
                <span
                  className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === "OPEN" ? "bg-aqua-100 text-aqua-800" : "bg-lavender-100 text-lavender-700"
                  }`}
                >
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
                {"#"}
                {t.id}
              </p>
              <p className="text-xs text-lavender-600">Ouvert par &lt;@{t.userId}&gt;</p>
            </div>
            <span className="text-xs text-lavender-400">{t.createdAt.toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
