import { useCallback, useMemo, useState } from "react";
import { CircleDotIcon, NetworkIcon, SearchIcon, XIcon } from "lucide-react";
import { useWorkflowStore } from "~/workflowStore";
import type { ThreadNodeKind } from "~/types/lraGraph";

export const LRA_DRAG_MIME = "application/bidecode-lra-node";

export interface LraDragPayload {
  nodeType: "thread";
  label: string;
  description?: string;
  kind: ThreadNodeKind;
}

function encodePayload(payload: LraDragPayload): string {
  return JSON.stringify(payload);
}

function PaletteItem({
  label,
  description,
  icon: Icon,
  payload,
}: {
  label: string;
  description?: string;
  icon: typeof CircleDotIcon;
  payload: LraDragPayload;
}) {
  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(LRA_DRAG_MIME, encodePayload(payload));
      e.dataTransfer.effectAllowed = "move";
    },
    [payload],
  );
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-accent/30 active:cursor-grabbing"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{label}</p>
        {description && (
          <p className="truncate text-[10px] text-muted-foreground/50">{description}</p>
        )}
      </div>
    </div>
  );
}

export function LraPalette() {
  const templates = useWorkflowStore((s) => s.templates);
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
    );
  }, [templates, search]);

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <NetworkIcon className="size-3.5 text-muted-foreground/60" />
        <span className="text-xs font-medium text-muted-foreground">Threads palette</span>
      </div>

      <div className="px-2 pt-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
          <SearchIcon className="size-3 shrink-0 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter workflows…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
              New thread
            </p>
            <div className="space-y-1">
              <PaletteItem
                label="Blank thread"
                description="Empty prompt to fill in later"
                icon={CircleDotIcon}
                payload={{
                  nodeType: "thread",
                  label: "New thread",
                  kind: { kind: "blank" },
                }}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Prompt templates
            </p>
            <p className="px-1 text-[10px] text-muted-foreground/40">
              Coming soon — drop a saved prompt to seed a thread.
            </p>
          </div>

          <div>
            <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Workflows
            </p>
            {filteredTemplates.length === 0 ? (
              <p className="px-1 text-[10px] text-muted-foreground/40">
                {search ? "No matching workflows" : "No workflows yet"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredTemplates.map((t) => (
                  <PaletteItem
                    key={t.id}
                    label={t.name}
                    {...(t.description ? { description: t.description } : {})}
                    icon={NetworkIcon}
                    payload={{
                      nodeType: "thread",
                      label: t.name,
                      ...(t.description ? { description: t.description } : {}),
                      kind: { kind: "workflowRef", workflowTemplateId: t.id },
                    }}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
