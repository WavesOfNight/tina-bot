import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildRoles } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";

async function createMessage(guildId: string, formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const channelId = formData.get("channelId") as string;
  if (!title || !channelId) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.reactionRoleMessage.create({ data: { guildId, channelId, title, dirty: true } });
  revalidatePath(`/dashboard/${guildId}/reaction-buttons`);
}

async function addButton(guildId: string, messageId: number, formData: FormData) {
  "use server";
  const roleId = formData.get("roleId") as string;
  const label = formData.get("label") as string;
  const emoji = (formData.get("emoji") as string) || null;
  if (!roleId || !label) return;

  await prisma.reactionRoleButton.upsert({
    where: { messageId_fk_roleId: { messageId_fk: messageId, roleId } },
    create: { messageId_fk: messageId, roleId, label, emoji },
    update: { label, emoji },
  });
  await prisma.reactionRoleMessage.update({ where: { id: messageId }, data: { dirty: true } });
  revalidatePath(`/dashboard/${guildId}/reaction-buttons`);
}

export default async function ReactionButtonsPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [messages, channels, roles] = await Promise.all([
    prisma.reactionRoleMessage.findMany({ where: { guildId }, include: { buttons: true }, orderBy: { createdAt: "desc" } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId),
  ]);

  const create = createMessage.bind(null, guildId);

  return (
    <div>
      <PageHeader icon="🖱️" title="Reaction Buttons" subtitle="Attribue des roles en un clic" />

      <form action={create} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Titre du message</label>
          <input name="title" required placeholder="Choisis tes roles" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon</label>
          <select name="channelId" required className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Creer
        </button>
      </form>

      <div className="space-y-3">
        {messages.length === 0 && <p className="glass-panel rounded-aero p-4 text-sm text-lavender-600 shadow-glass">Aucun message de reaction-role.</p>}
        {messages.map((msg) => (
          <div key={msg.id} className="glass-panel rounded-aero p-5 shadow-glass">
            <p className="mb-2 font-medium text-lavender-900">
              #{msg.id} - {msg.title}
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {msg.buttons.map((b) => (
                <span key={b.id} className="rounded-full bg-aqua-100 px-3 py-1 text-xs text-aqua-800">
                  {b.emoji} {b.label}
                </span>
              ))}
              {msg.buttons.length === 0 && <span className="text-xs text-lavender-500">Aucun role configure</span>}
            </div>
            <form action={addButton.bind(null, guildId, msg.id)} className="flex flex-wrap items-end gap-2">
              <select name="roleId" required className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input name="label" required placeholder="Label du bouton" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
              <input name="emoji" placeholder="Emoji (optionnel)" className="w-32 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
              <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-4 py-2 text-xs font-medium text-white shadow-glass">
                Ajouter le role
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
