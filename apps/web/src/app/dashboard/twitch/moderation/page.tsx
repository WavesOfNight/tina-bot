import { revalidatePath } from "next/cache";
import { prisma, setTwitchBotSettings, setTwitchModeration } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { ShieldCheck, CaseUpper, Smile, Link2Off, Asterisk, Repeat, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const AUTOMOD_LEVELS = [
  { value: "OFF", label: "Desactivee", description: "Aucun filtre de mots, tout passe." },
  { value: "LOW", label: "Faible", description: "Filtre uniquement les propos les plus graves (racisme, insultes extremes), en FR/EN/DE/ES/IT." },
  { value: "MEDIUM", label: "Moyenne", description: "Filtre les insultes courantes (putain, connard, fuck, scheisse, puta, cazzo...), en FR/EN/DE/ES/IT." },
  { value: "HIGH", label: "Stricte", description: "Filtre tout, y compris le langage grossier leger, en FR/EN/DE/ES/IT." },
];

async function saveAutoModLevel(formData: FormData) {
  "use server";
  const autoModLevel = (formData.get("autoModLevel") as string) || "OFF";
  await setTwitchBotSettings({ autoModLevel });
  revalidatePath("/dashboard/twitch/moderation");
}

async function saveFilters(formData: FormData) {
  "use server";
  await setTwitchModeration({
    filterLinksEnabled: formData.get("filterLinksEnabled") === "on",
    linkWhitelist: (formData.get("linkWhitelist") as string)?.trim() ?? "",
    filterCapsEnabled: formData.get("filterCapsEnabled") === "on",
    filterEmotesEnabled: formData.get("filterEmotesEnabled") === "on",
    maxEmotes: Math.max(1, Number(formData.get("maxEmotes")) || 5),
    filterSymbolsEnabled: formData.get("filterSymbolsEnabled") === "on",
    filterRepetitionEnabled: formData.get("filterRepetitionEnabled") === "on",
    filterSharedChatEnabled: formData.get("filterSharedChatEnabled") === "on",
  });
  revalidatePath("/dashboard/twitch/moderation");
}

export default async function TwitchModerationPage() {
  const config = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });

  return (
    <div>
      <PageHeader icon={ShieldCheck} title="Moderation" subtitle="Filtres automatiques du chat Twitch et escalade avertissement / timeout / ban" />

      <form action={saveAutoModLevel} className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <h2 className="mb-2 text-sm font-medium text-lavender-800">Filtre de mots automatique</h2>
        <div className="mb-4 space-y-2">
          {AUTOMOD_LEVELS.map((level) => (
            <label key={level.value} className="flex items-start gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
              <input
                type="radio"
                name="autoModLevel"
                value={level.value}
                defaultChecked={(config?.autoModLevel ?? "OFF") === level.value}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-lavender-900">{level.label}</span>
                <span className="block text-xs text-lavender-600">{level.description}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Filtres de chat</h2>
      <p className="mb-3 text-xs text-lavender-500">
        Un message qui declenche un de ces filtres est supprime et suit la meme escalade que le filtre de mots
        (avertissement, puis timeout 10 min au 3e, puis ban au 4e), sauf le filtre &quot;Chat partage&quot; qui se contente
        de supprimer le message.
      </p>
      <form action={saveFilters} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <Link2Off size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Liens</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Supprime les liens qui ne sont pas dans la liste blanche ci-dessous.</p>
          <label className="mb-2 flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterLinksEnabled" defaultChecked={config?.filterLinksEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
          <label className="mb-1 block text-xs text-lavender-600">Domaines autorises (separes par une virgule)</label>
          <input
            name="linkWhitelist"
            defaultValue={config?.linkWhitelist ?? ""}
            placeholder="twitch.tv, discord.gg, youtube.com"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>

        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <CaseUpper size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Majuscules excessives</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Supprime les messages ecrits majoritairement EN MAJUSCULES.</p>
          <label className="flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterCapsEnabled" defaultChecked={config?.filterCapsEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
        </div>

        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <Smile size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Emotes excessifs</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Supprime les messages qui abusent des emotes.</p>
          <label className="mb-2 flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterEmotesEnabled" defaultChecked={config?.filterEmotesEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
          <label className="mb-1 block text-xs text-lavender-600">Nombre maximum d&apos;emotes par message</label>
          <input
            name="maxEmotes"
            type="number"
            min={1}
            defaultValue={config?.maxEmotes ?? 5}
            className="w-24 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>

        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <Asterisk size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Symboles excessifs</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Supprime les messages remplis de symboles/ponctuation (ex: !!!***###).</p>
          <label className="flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterSymbolsEnabled" defaultChecked={config?.filterSymbolsEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
        </div>

        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <Repeat size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Repetitions</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Supprime les messages qui repetent le meme mot/phrase, ou qu&apos;un chatteur spam en boucle.</p>
          <label className="flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterRepetitionEnabled" defaultChecked={config?.filterRepetitionEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
        </div>

        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <div className="mb-2 flex items-center gap-2">
            <Users size={16} className="text-lavender-500" aria-hidden="true" />
            <p className="text-sm font-medium text-lavender-900">Chat partage</p>
          </div>
          <p className="mb-2 text-xs text-lavender-600">Filtre les messages provenant d&apos;autres chaines via le Shared Chat de Twitch (suppression uniquement, sans avertissement).</p>
          <label className="flex items-center gap-2 text-sm text-lavender-800">
            <input type="checkbox" name="filterSharedChatEnabled" defaultChecked={config?.filterSharedChatEnabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
            Active
          </label>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            Enregistrer les filtres
          </button>
        </div>
      </form>
    </div>
  );
}
