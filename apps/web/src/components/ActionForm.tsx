"use client";

import { useState } from "react";

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: "Envoyer un message",
  SEND_DM: "Envoyer un message prive",
  SEND_EMBED: "Envoyer un embed",
  ADD_ROLE: "Ajouter un role",
  REMOVE_ROLE: "Retirer un role",
  ADD_REACTION: "Ajouter une reaction",
  WAIT: "Attendre",
  SET_VARIABLE: "Definir une variable",
  IF: "Condition (SI / SINON)",
  REPEAT: "Repeter",
  KICK: "Expulser l'auteur",
  BAN: "Bannir l'auteur",
};

const CONDITION_LABELS: Record<string, string> = {
  HAS_ROLE: "L'auteur a le role",
  IS_ADMIN: "L'auteur est administrateur",
  MESSAGE_CONTAINS: "Le message contient",
  VARIABLE_EQUALS: "La variable est egale a",
  VARIABLE_GREATER: "La variable est superieure a",
  RANDOM_CHANCE: "Chance aleatoire (%)",
};

const OPERATION_LABELS: Record<string, string> = {
  SET: "Definir (=)",
  ADD: "Ajouter (+)",
  SUBTRACT: "Soustraire (-)",
  RANDOM: "Nombre aleatoire entre (min,max)",
  APPEND: "Ajouter du texte a la fin",
};

export function ActionForm({
  action,
  channels,
  roles,
  compact = false,
}: {
  action: (formData: FormData) => void;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  compact?: boolean;
}) {
  const [type, setType] = useState("SEND_MESSAGE");
  const [conditionType, setConditionType] = useState("HAS_ROLE");
  const [operation, setOperation] = useState("SET");

  return (
    <form action={action} className={`flex flex-wrap items-end gap-2 rounded-xl bg-white/60 p-3 ${compact ? "text-xs" : ""}`}>
      <div>
        <label className="mb-1 block text-xs text-lavender-600">Bloc</label>
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
            placeholder="Salut {user.mention}, tu as {arg1} ! (variables : {var:nom}, arguments : {arg1} {args})"
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

      {type === "SEND_EMBED" && (
        <>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-lavender-600">Titre</label>
            <input name="title" placeholder="Titre de l'embed" className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-lavender-600">Description</label>
            <input name="description" placeholder="Salut {user.mention} !" className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Couleur</label>
            <input name="color" placeholder="#5865F2" className="w-24 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Image (URL, optionnel)</label>
            <input name="imageUrl" placeholder="https://..." className="w-40 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
          </div>
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
        </>
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

      {type === "SET_VARIABLE" && (
        <>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Nom de la variable</label>
            <input name="name" placeholder="score" className="w-28 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Operation</label>
            <select
              name="operation"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
            >
              {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-lavender-600">
              Valeur {operation === "RANDOM" ? "(min,max — ex: 1,100)" : ""}
            </label>
            <input
              name="value"
              placeholder={operation === "RANDOM" ? "1,100" : "10 ou {arg1}"}
              className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
            />
          </div>
        </>
      )}

      {type === "IF" && (
        <>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Condition</label>
            <select
              name="conditionType"
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value)}
              className="rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs"
            >
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {conditionType === "HAS_ROLE" && (
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
          {conditionType === "MESSAGE_CONTAINS" && (
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs text-lavender-600">Texte recherche</label>
              <input name="text" className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
            </div>
          )}
          {(conditionType === "VARIABLE_EQUALS" || conditionType === "VARIABLE_GREATER") && (
            <>
              <div>
                <label className="mb-1 block text-xs text-lavender-600">Variable</label>
                <input name="variableName" placeholder="score" className="w-24 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-lavender-600">Valeur de comparaison</label>
                <input name="compareValue" placeholder="10 ou {arg1}" className="w-28 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
              </div>
            </>
          )}
          {conditionType === "RANDOM_CHANCE" && (
            <div>
              <label className="mb-1 block text-xs text-lavender-600">Pourcentage</label>
              <input name="percent" type="number" min={0} max={100} defaultValue={50} className="w-20 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
            </div>
          )}
        </>
      )}

      {type === "REPEAT" && (
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nombre de repetitions (max 20)</label>
          <input name="count" type="number" min={1} max={20} defaultValue={3} className="w-24 rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
        </div>
      )}

      {(type === "KICK" || type === "BAN") && (
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Raison (optionnel)</label>
          <input name="reason" className="w-full rounded-lg border border-lavender-200 bg-white px-2 py-1.5 text-xs" />
        </div>
      )}

      <button type="submit" className="bubble-btn rounded-full bg-discord-400 px-4 py-1.5 text-xs font-medium text-white shadow-glass">
        Ajouter le bloc
      </button>
    </form>
  );
}
