import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildRoles } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { Keyboard, ArrowUp, ArrowDown, X } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: "Envoyer un message",
  SEND_DM: "Envoyer un message prive",
  ADD_ROLE: "Ajouter un role",
  REMOVE_ROLE: "Retirer un role",
  ADD_REACTION: "Ajouter une reaction",
  WAIT: "Attendre",
  KICK: "Expulser l'auteur",
  BAN: "Bannir l'auteur",
};

function describeAction(type: string, config: string): string {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(config);
  } catch {
    // ignore malformed config
  }

  switch (type) {
    case "SEND_MESSAGE":
      return `"${parsed.text ?? ""}"${parsed.channelId ? ` dans <#${parsed.channelId}>` : ""}`;
    case "SEND_DM":
      return `"${parsed.text ?? ""}"`;
    case "ADD_ROLE":
    case "REMOVE_ROLE":
      return parsed.roleId ? `<@&${parsed.roleId}>` : "aucun role choisi";
    case "ADD_REACTION":
      return String(parsed.emoji ?? "");
    case "WAIT":
      return `${parsed.seconds ?? 0}s`;
    case "KICK":
    case "BAN":
      return parsed.reason ? `raison : ${parsed.reason}` : "sans raison";
    default:
      return "";
  }
}

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

async function addAction(guildId: string, customCommandId: number, formData: FormData) {
  "use server";
  const type = formData.get("type") as string;
  if (!type || !(type in ACTION_LABELS)) return;

  const config: Record<string, unknown> = {};
  if (type === "SEND_MESSAGE" || type === "SEND_DM") {
    const text = (formData.get("text") as string)?.trim();
    if (!text) return;
    config.text = text;
    const channelId = formData.get("channelId") as string;
    if (type === "SEND_MESSAGE" && channelId) config.channelId = channelId;
  } else if (type === "ADD_ROLE" || type === "REMOVE_ROLE") {
    const roleId = formData.get("roleId") as string;
    if (!roleId) return;
    config.roleId = roleId;
  } else if (type === "ADD_REACTION") {
    const emoji = (formData.get("emoji") as string)?.trim();
    if (!emoji) return;
    config.emoji = emoji;
  } else if (type === "WAIT") {
    config.seconds = Math.min(30, Math.max(0, Number(formData.get("seconds")) || 0));
  } else if (type === "KICK" || type === "BAN") {
    const reason = (formData.get("reason") as string)?.trim();
    if (reason) config.reason = reason;
  }

  const highest = await prisma.customCommandAction.aggregate({ where: { customCommandId }, _max: { order: true } });
  await prisma.customCommandAction.create({
    data: { customCommandId, type, order: (highest._max.order ?? -1) + 1, config: JSON.stringify(config) },
  });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteAction(guildId: string, actionId: number) {
  "use server";
  await prisma.customCommandAction.delete({ where: { id: actionId } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function moveAction(guildId: string, actionId: number, direction: "up" | "down") {
  "use server";
  const action = await prisma.customCommandAction.findUnique({ where: { id: actionId } });
  if (!action) return;

  const siblings = await prisma.customCommandAction.findMany({
    where: { customCommandId: action.customCommandId },
    orderBy: { order: "asc" },
  });
  const index = siblings.findIndex((a) => a.id === actionId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await prisma.$transaction([
    prisma.customCommandAction.update({ where: { id: action.id }, data: { order: swapWith.order } }),
    prisma.customCommandAction.update({ where: { id: swapWith.id }, data: { order: action.order } }),
  ]);
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
  const [commands, guild, autoResponses, channels, roles] = await Promise.all([
    prisma.customCommand.findMany({ where: { guildId }, orderBy: { name: "asc" }, include: { actions: { orderBy: { order: "asc" } } } }),
    prisma.guild.findUnique({ where: { id: guildId } }),
    prisma.autoResponse.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } }),
    getGuildChannels(guildId, 0),
    getGuildRoles(guildId),
  ]);
  const prefix = guild?.prefix ?? "!";

  const add = addCommand.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={Keyboard} title={`Commandes Perso (${commands.length})`} subtitle="Commandes texte et chaines d'actions" />

      <form action={add} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom (sans prefixe)</label>
          <input name="name" required placeholder="regles" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse simple (utilisee si aucune etape n&apos;est ajoutee)</label>
          <input name="response" required placeholder="Consulte le reglement dans #regles" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="space-y-4">
        {commands.length === 0 && (
          <div className="glass-panel rounded-aero p-4 shadow-glass">
            <p className="text-sm text-lavender-600">Aucune commande personnalisee pour le moment.</p>
            <p className="mt-1 text-xs text-lavender-500">
              Cree-en une avec le formulaire ci-dessus (nom + reponse simple). Une fois creee, sa carte apparait ici avec
              en dessous le constructeur de chaine d&apos;actions (envoyer un message, ajouter un role, attendre, etc.).
            </p>
          </div>
        )}
        {commands.map((c) => (
          <div key={c.id} className="glass-panel rounded-aero p-4 shadow-glass">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-lavender-900">
                  {prefix}
                  {c.name}
                </p>
                {c.actions.length === 0 && <p className="text-sm text-lavender-600">{c.response}</p>}
                {c.actions.length > 0 && (
                  <p className="text-xs text-discord-500">
                    Chaine de {c.actions.length} etape{c.actions.length > 1 ? "s" : ""} (la reponse simple est ignoree)
                  </p>
                )}
              </div>
              <form action={deleteCommand.bind(null, guildId, c.id)}>
                <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                  Supprimer
                </button>
              </form>
            </div>

            {c.actions.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {c.actions.map((a, index) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/50 px-3 py-2 text-xs">
                    <div>
                      <span className="mr-2 rounded-full bg-discord-100 px-2 py-0.5 font-medium text-discord-500">
                        {index + 1}. {ACTION_LABELS[a.type] ?? a.type}
                      </span>
                      <span className="text-lavender-600">{describeAction(a.type, a.config)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <form action={moveAction.bind(null, guildId, a.id, "up")}>
                        <button type="submit" disabled={index === 0} className="flex h-6 w-6 items-center justify-center rounded-full text-lavender-500 hover:bg-white disabled:opacity-30">
                          <ArrowUp size={13} aria-hidden="true" />
                        </button>
                      </form>
                      <form action={moveAction.bind(null, guildId, a.id, "down")}>
                        <button
                          type="submit"
                          disabled={index === c.actions.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-lavender-500 hover:bg-white disabled:opacity-30"
                        >
                          <ArrowDown size={13} aria-hidden="true" />
                        </button>
                      </form>
                      <form action={deleteAction.bind(null, guildId, a.id)}>
                        <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-full text-coral-500 hover:bg-white">
                          <X size={13} aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ActionForm action={addAction.bind(null, guildId, c.id)} channels={channels} roles={roles} />
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
