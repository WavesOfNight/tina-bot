import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildMemberDisplayNames } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { ShieldCheck } from "lucide-react";

async function saveModConfig(guildId: string, formData: FormData) {
  "use server";
  const modLogChannelId = (formData.get("modLogChannelId") as string) || null;
  const autoModLevel = (formData.get("autoModLevel") as string) || "OFF";
  const filterInvites = formData.get("filterInvites") === "on";
  const filterLinks = formData.get("filterLinks") === "on";
  const filterCaps = formData.get("filterCaps") === "on";
  const filterSpam = formData.get("filterSpam") === "on";
  const logMessageDelete = formData.get("logMessageDelete") === "on";
  const logMessageEdit = formData.get("logMessageEdit") === "on";
  const logMemberJoin = formData.get("logMemberJoin") === "on";
  const logMemberLeave = formData.get("logMemberLeave") === "on";
  const parseThreshold = (name: string) => {
    const raw = (formData.get(name) as string)?.trim();
    return raw ? Number(raw) : null;
  };
  const warnMuteThreshold = parseThreshold("warnMuteThreshold");
  const warnKickThreshold = parseThreshold("warnKickThreshold");
  const warnBanThreshold = parseThreshold("warnBanThreshold");

  const data = {
    modLogChannelId,
    autoModLevel,
    filterInvites,
    filterLinks,
    filterCaps,
    filterSpam,
    warnMuteThreshold,
    warnKickThreshold,
    warnBanThreshold,
    logMessageDelete,
    logMessageEdit,
    logMemberJoin,
    logMemberLeave,
  };

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, ...data },
    update: data,
  });
  revalidatePath(`/dashboard/${guildId}/moderation`);
}

const TYPE_LABELS: Record<string, string> = {
  WARN: "Avertissement",
  MUTE: "Mute",
  UNMUTE: "Fin de mute",
  KICK: "Expulsion",
  BAN: "Bannissement",
  UNBAN: "Fin de ban",
  AUTOMOD: "Filtre automatique",
};

const AUTOMOD_LEVELS = [
  { value: "OFF", label: "Desactivee", description: "Aucun filtre de mots, tout passe." },
  { value: "LOW", label: "Faible", description: "Filtre uniquement les propos les plus graves (racisme, insultes extremes), en FR/EN/DE/ES/IT." },
  { value: "MEDIUM", label: "Moyenne", description: "Filtre les insultes courantes (putain, connard, fuck, scheisse, puta, cazzo...), en FR/EN/DE/ES/IT. Laisse passer le langage familier leger." },
  { value: "HIGH", label: "Stricte", description: "Filtre tout, y compris le langage grossier leger (pipi, caca, merde, damn, mierda...), en FR/EN/DE/ES/IT. Ideal pour un serveur familial." },
];

export default async function ModerationPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, channels, cases] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId),
    prisma.moderationCase.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const displayNames = await getGuildMemberDisplayNames(guildId, cases.map((c) => c.userId));
  const save = saveModConfig.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={ShieldCheck} title="Moderation" subtitle="Filtres automatiques, escalade et logs" />

      <form action={save} className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <label className="mb-1 block text-xs text-lavender-600">Salon de logs de moderation</label>
        <select name="modLogChannelId" defaultValue={guild?.modLogChannelId ?? ""} className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
          <option value="">Aucun</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              # {c.name}
            </option>
          ))}
        </select>

        <h2 className="mb-2 text-sm font-medium text-lavender-800">Filtre de mots automatique</h2>
        <div className="mb-4 space-y-2">
          {AUTOMOD_LEVELS.map((level) => (
            <label key={level.value} className="flex items-start gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
              <input
                type="radio"
                name="autoModLevel"
                value={level.value}
                defaultChecked={(guild?.autoModLevel ?? "OFF") === level.value}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-lavender-900">{level.label}</span>
                <span className="block text-xs text-lavender-600">{level.description}</span>
              </span>
            </label>
          ))}
        </div>

        <h2 className="mb-2 text-sm font-medium text-lavender-800">Autres filtres</h2>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="filterInvites" defaultChecked={guild?.filterInvites ?? false} /> Bloquer les invitations Discord
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="filterLinks" defaultChecked={guild?.filterLinks ?? false} /> Bloquer tous les liens externes
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="filterCaps" defaultChecked={guild?.filterCaps ?? false} /> Bloquer les MAJUSCULES excessives
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="filterSpam" defaultChecked={guild?.filterSpam ?? false} /> Bloquer le spam (messages repetes)
          </label>
        </div>

        <h2 className="mb-2 text-sm font-medium text-lavender-800">Logs (dans le salon de logs ci-dessus)</h2>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="logMessageDelete" defaultChecked={guild?.logMessageDelete ?? false} /> Messages supprimes
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="logMessageEdit" defaultChecked={guild?.logMessageEdit ?? false} /> Messages modifies
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="logMemberJoin" defaultChecked={guild?.logMemberJoin ?? false} /> Arrivees de membres
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
            <input type="checkbox" name="logMemberLeave" defaultChecked={guild?.logMemberLeave ?? false} /> Departs de membres
          </label>
        </div>

        <h2 className="mb-2 text-sm font-medium text-lavender-800">Escalade automatique des avertissements</h2>
        <p className="mb-2 text-xs text-lavender-500">
          Les avertissements manuels (/warn) et automatiques (filtres ci-dessus) comptent ensemble. Laisse vide pour
          desactiver un palier.
        </p>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Mute (24h) apres</label>
            <input type="number" name="warnMuteThreshold" min={1} defaultValue={guild?.warnMuteThreshold ?? ""} placeholder="ex: 2" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Kick apres</label>
            <input type="number" name="warnKickThreshold" min={1} defaultValue={guild?.warnKickThreshold ?? ""} placeholder="ex: 4" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Ban apres</label>
            <input type="number" name="warnBanThreshold" min={1} defaultValue={guild?.warnBanThreshold ?? ""} placeholder="ex: 6" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        <p className="border-b border-lavender-100 px-4 py-2 text-xs text-lavender-500">
          Commandes disponibles : /ban /kick /mute /warn /warnings /clear
        </p>
        {cases.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun cas de moderation enregistre.</p>}
        {cases.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="text-sm font-medium text-lavender-900">
                #{c.id} - {TYPE_LABELS[c.type] ?? c.type} - {displayNames.get(c.userId) ?? c.userId}
              </p>
              <p className="text-xs text-lavender-600">{c.reason ?? "Aucune raison fournie"}</p>
            </div>
            <span className="text-xs text-lavender-400">{c.createdAt.toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
