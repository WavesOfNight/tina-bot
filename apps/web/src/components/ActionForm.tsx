"use client";

import { useState } from "react";

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

export function ActionForm({
  action,
  channels,
  roles,
}: {
  action: (formData: FormData) => void;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const [type, setType] = useState("SEND_MESSAGE");

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl bg-white/60 p-3">
      <div>
        <label className="mb-1 block text-xs text-lavender-600">Etape</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
        >
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {(type === "SEND_MESSAGE" || type === "SEND_DM") && (
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Message</label>
          <input
            name="text"
            placeholder="Salut {user.mention}, bienvenue sur {server.name} !"
            className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
          />
        </div>
      )}

      {type === "SEND_MESSAGE" && (
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon</label>
          <select name="channelId" className="rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs">
            <option value="">Salon actuel</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(type === "ADD_ROLE" || type === "REMOVE_ROLE") && (
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Role</label>
          <select name="roleId" className="rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {type === "ADD_REACTION" && (
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Emoji</label>
          <input name="emoji" placeholder="🎉" className="w-20 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
        </div>
      )}

      {type === "WAIT" && (
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Secondes</label>
          <input
            name="seconds"
            type="number"
            min={0}
            max={30}
            defaultValue={2}
            className="w-20 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
          />
        </div>
      )}

      {(type === "KICK" || type === "BAN") && (
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Raison (optionnel)</label>
          <input name="reason" className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
        </div>
      )}

      <button type="submit" className="bubble-btn rounded-full bg-discord-400 px-4 py-1.5 text-xs font-medium text-white shadow-glass">
        Ajouter l&apos;etape
      </button>
    </form>
  );
}
