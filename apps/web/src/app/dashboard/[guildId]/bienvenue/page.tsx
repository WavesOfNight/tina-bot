import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildRoles } from "@/lib/discord";

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");
const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function saveWelcomeConfig(guildId: string, formData: FormData) {
  "use server";
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

  const channelId = (formData.get("channelId") as string) || null;
  const message = (formData.get("message") as string) || "{user.mention} a rejoint le serveur {server.name} !";
  const imageText = (formData.get("imageText") as string) || "Bienvenue {user} !";
  const dmMessage = (formData.get("dmMessage") as string) || "Bienvenue sur {server.name}, {user.name} !";
  const imageEnabled = formData.get("welcomeType") === "image";
  const dmEnabled = formData.get("dmEnabled") === "on";
  const reactionRoleEnabled = formData.get("reactionRoleEnabled") === "on";
  const reactionRoleId = (formData.get("reactionRoleId") as string) || null;
  const autoRoleEnabled = formData.get("autoRoleEnabled") === "on";
  const autoRoleId = (formData.get("autoRoleId") as string) || null;
  const removeBackground = formData.get("removeBackground") === "on";

  const existing = await prisma.welcomeConfig.findUnique({ where: { guildId } });
  let imageBackgroundUrl = removeBackground ? null : (existing?.imageBackgroundUrl ?? null);

  const file = formData.get("backgroundImage") as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_BACKGROUND_BYTES) {
      redirect(`/dashboard/${guildId}/bienvenue?error=trop_lourd`);
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      redirect(`/dashboard/${guildId}/bienvenue?error=format`);
    }
    try {
      await mkdir(UPLOADS_DIR, { recursive: true });
      const filename = `welcome-${guildId}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(UPLOADS_DIR, filename), buffer);
      const baseUrl = process.env.NEXTAUTH_URL ?? "";
      imageBackgroundUrl = `${baseUrl}/uploads/${filename}?v=${Date.now()}`;
    } catch (error) {
      console.error("Echec de l'upload du fond de bienvenue", error);
      redirect(`/dashboard/${guildId}/bienvenue?error=upload`);
    }
  }

  await prisma.welcomeConfig.upsert({
    where: { guildId },
    create: { guildId, channelId, message, imageText, imageBackgroundUrl, dmMessage, imageEnabled, dmEnabled, reactionRoleEnabled, reactionRoleId, autoRoleEnabled, autoRoleId },
    update: { channelId, message, imageText, imageBackgroundUrl, dmMessage, imageEnabled, dmEnabled, reactionRoleEnabled, reactionRoleId, autoRoleEnabled, autoRoleId },
  });

  revalidatePath(`/dashboard/${guildId}/bienvenue`);
  redirect(`/dashboard/${guildId}/bienvenue?saved=1`);
}

const ERROR_MESSAGES: Record<string, string> = {
  trop_lourd: "Image trop lourde (max 10 Mo).",
  format: "Format non supporte. Utilise PNG, JPG, WEBP ou GIF.",
  upload: "Echec de l'enregistrement de l'image sur le serveur.",
};

export default async function BienvenuePage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { error?: string; saved?: string };
}) {
  const guildId = params.guildId;
  const [config, channels, roles] = await Promise.all([
    prisma.welcomeConfig.findUnique({ where: { guildId } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId),
  ]);

  const save = saveWelcomeConfig.bind(null, guildId);

  return (
    <div>
      <h1 className="font-display mb-4 flex items-center gap-2 text-xl font-semibold text-lavender-900">
        <span aria-hidden="true">🎁</span> Configuration : Bienvenue
      </h1>

      {searchParams.error && (
        <p className="mb-4 rounded-xl bg-coral-100 px-4 py-2 text-sm text-coral-600">
          {ERROR_MESSAGES[searchParams.error] ?? "Une erreur est survenue."}
        </p>
      )}
      {searchParams.saved && (
        <p className="mb-4 rounded-xl bg-aqua-100 px-4 py-2 text-sm text-aqua-800">Configuration enregistree.</p>
      )}

      <div className="glass-panel mb-4 rounded-aero p-6 shadow-glass" style={{ background: "linear-gradient(135deg,#FAECE7,#FBEAF0)" }}>
        <div className="flex flex-wrap items-center gap-5">
          <svg width="110" height="130" viewBox="0 0 110 130" aria-hidden="true" className="flex-shrink-0">
            <ellipse cx="55" cy="122" rx="30" ry="6" fill="#F0997B" opacity="0.4" />
            <path d="M25 85 Q20 60 55 58 Q90 60 85 85 L88 118 L22 118 Z" fill="#7F77DD" />
            <circle cx="55" cy="55" r="34" fill="#FAEEDA" />
            <path
              d="M18 48 Q22 8 55 10 Q92 8 94 48 Q97 65 85 65 Q88 42 68 30 Q55 48 42 30 Q22 42 25 65 Q13 65 18 48 Z"
              fill="#993C1D"
            />
            <circle cx="40" cy="60" r="2" fill="#854F0B" />
            <circle cx="47" cy="64" r="2" fill="#854F0B" />
            <circle cx="66" cy="64" r="2" fill="#854F0B" />
            <circle cx="37" cy="66" r="4.5" fill="#F4C0D1" />
            <circle cx="70" cy="66" r="4.5" fill="#F4C0D1" />
            <ellipse cx="41" cy="57" rx="11" ry="9" fill="#E6F1FB" stroke="#444441" strokeWidth="2.5" />
            <ellipse cx="68" cy="57" rx="11" ry="9" fill="#E6F1FB" stroke="#444441" strokeWidth="2.5" />
            <line x1="52" y1="57" x2="57" y2="57" stroke="#444441" strokeWidth="2.5" />
          </svg>
          <div className="flex-1">
            <div className="mb-2 inline-block rounded-full border border-coral-400 bg-white px-4 py-1.5 text-sm font-medium text-coral-600">
              BIENVENUE !
            </div>
            <p className="text-sm text-coral-600">
              Salut <span className="rounded bg-coral-200 px-1.5">[Nom_utilisateur]</span> ! Bienvenue sur{" "}
              <span className="rounded bg-coral-200 px-1.5">[Nom_serveur]</span> !
            </p>
          </div>
        </div>
      </div>

      <form action={save} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <label className="mb-1 block text-xs text-lavender-600">Canal de bienvenue</label>
          <select name="channelId" defaultValue={config?.channelId ?? ""} className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs text-lavender-600">Type de bienvenue</label>
          <div className="mb-3 flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-lavender-800">
              <input type="radio" name="welcomeType" value="text" defaultChecked={!(config?.imageEnabled ?? true)} /> Texte
            </label>
            <label className="flex items-center gap-1.5 text-sm text-lavender-800">
              <input type="radio" name="welcomeType" value="image" defaultChecked={config?.imageEnabled ?? true} /> Image
            </label>
          </div>

          <label className="mb-1 block text-xs text-lavender-600">Message dans le salon (mode Texte)</label>
          <textarea
            name="message"
            defaultValue={config?.message ?? "{user.mention} a rejoint le serveur {server.name} !"}
            rows={2}
            className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs text-lavender-600">Texte sur l&apos;image (mode Image)</label>
          <input
            name="imageText"
            defaultValue={config?.imageText ?? "Bienvenue {user} !"}
            className="mb-1 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
          <p className="mb-4 text-[11px] text-lavender-500">Variables : {"{user}"} (pseudo), {"{server}"} (nom du serveur)</p>

          <label className="mb-1 block text-xs text-lavender-600">Fond personnalise de l&apos;image (mode Image)</label>
          {config?.imageBackgroundUrl && (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.imageBackgroundUrl} alt="Fond actuel" className="h-12 w-24 rounded-lg object-cover" />
              <label className="flex items-center gap-1.5 text-xs text-coral-600">
                <input type="checkbox" name="removeBackground" /> Retirer le fond actuel
              </label>
            </div>
          )}
          <input
            type="file"
            name="backgroundImage"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-lavender-100 file:px-3 file:py-1 file:text-xs file:text-lavender-800"
          />
          <p className="text-[11px] text-lavender-500">PNG, JPG, WEBP ou GIF. Remplace le fond pastel par defaut.</p>
        </div>

        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <label className="mb-1 flex items-center gap-2 text-xs text-lavender-600">
            <input type="checkbox" name="dmEnabled" defaultChecked={config?.dmEnabled ?? false} /> Message Prive
          </label>
          <textarea
            name="dmMessage"
            defaultValue={config?.dmMessage ?? "Bienvenue sur {server.name}, {user.name} !"}
            rows={2}
            className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />

          <label className="mb-1 flex items-center gap-2 text-xs text-lavender-600">
            <input type="checkbox" name="reactionRoleEnabled" defaultChecked={config?.reactionRoleEnabled ?? false} /> Bouton de Reaction (donne un role au clic)
          </label>
          <select name="reactionRoleId" defaultValue={config?.reactionRoleId ?? ""} className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <label className="mb-1 flex items-center gap-2 text-xs text-lavender-600">
            <input type="checkbox" name="autoRoleEnabled" defaultChecked={config?.autoRoleEnabled ?? false} /> Roles auto (attribue automatiquement)
          </label>
          <select name="autoRoleId" defaultValue={config?.autoRoleId ?? ""} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <button type="submit" className="bubble-btn rounded-full bg-blush-400 px-6 py-2.5 text-sm font-medium text-white shadow-glass">
            Enregistrer la configuration
          </button>
        </div>
      </form>
    </div>
  );
}
