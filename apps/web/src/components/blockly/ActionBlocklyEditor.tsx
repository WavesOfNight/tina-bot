"use client";

import { useEffect, useRef, useState } from "react";
import type * as BlocklyType from "blockly";
import type { ActionNode, SubmittedAction } from "./action-types";
import { treeToBlocklyXml } from "./xml";

export function ActionBlocklyEditor({
  initialTree,
  channels,
  roles,
  onSave,
}: {
  initialTree: ActionNode[];
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  onSave: (actions: SubmittedAction[]) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<BlocklyType.WorkspaceSvg | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved">("loading");

  useEffect(() => {
    let disposed = false;

    (async () => {
      const Blockly = await import("blockly");
      const { registerBlocks, setBlocklyContext, TOOLBOX } = await import("./blocks");
      if (disposed || !containerRef.current) return;

      setBlocklyContext(channels, roles);
      registerBlocks();

      const workspace = Blockly.inject(containerRef.current, {
        toolbox: TOOLBOX,
        trashcan: true,
        scrollbars: true,
        zoom: { controls: true, wheel: true, startScale: 0.85 },
      });
      workspaceRef.current = workspace;

      const xml = treeToBlocklyXml(initialTree);
      const dom = Blockly.utils.xml.textToDom(xml);
      Blockly.Xml.domToWorkspace(dom, workspace);

      if (!disposed) setStatus("idle");
    })();

    return () => {
      disposed = true;
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!workspaceRef.current) return;
    setStatus("saving");
    const { workspaceToTree } = await import("./workspace");
    const actions = workspaceToTree(workspaceRef.current);
    await onSave(actions);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height: 480, width: "100%" }}
        className="overflow-hidden rounded-xl border border-lavender-200 bg-white"
      />
      {status === "loading" && <p className="mt-2 text-xs text-lavender-500">Chargement de l&apos;editeur de blocs...</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving" || status === "loading"}
        className="bubble-btn mt-3 rounded-full bg-discord-400 px-5 py-2 text-sm font-medium text-white shadow-glass disabled:opacity-60"
      >
        {status === "saving" ? "Enregistrement..." : status === "saved" ? "Enregistre !" : "Enregistrer les blocs"}
      </button>
    </div>
  );
}
