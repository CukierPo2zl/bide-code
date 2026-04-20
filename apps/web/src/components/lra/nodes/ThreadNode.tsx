import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircleDotIcon, FileTextIcon, NetworkIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThreadNodeData, ThreadNodeKind, ThreadNodeState } from "~/types/lraGraph";

function kindIcon(kind: ThreadNodeKind) {
  switch (kind.kind) {
    case "blank":
      return CircleDotIcon;
    case "promptTemplate":
      return FileTextIcon;
    case "workflowRef":
      return NetworkIcon;
  }
}

function stateClasses(state: ThreadNodeState, selected: boolean): string {
  // PR 1 only exercises `draft`; other branches intentionally fall back to
  // draft styling so PR 2 can fill them in without touching the structure.
  const selectedRing = selected ? "ring-2 ring-indigo-500/30" : "";
  switch (state) {
    case "draft":
    case "ready":
    case "blocked":
    case "running":
    case "done":
    case "failed":
    default:
      return cn(
        "border-dashed border-border/60 bg-card hover:border-border",
        selected && "border-indigo-500",
        selectedRing,
      );
  }
}

function stateLabel(state: ThreadNodeState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export const ThreadNode = memo(function ThreadNode({
  data,
  selected,
}: NodeProps & { data: ThreadNodeData }) {
  const Icon = kindIcon(data.kind);
  return (
    <div
      className={cn(
        "group min-w-[200px] max-w-[240px] rounded-xl border shadow-sm transition-all duration-150",
        stateClasses(data.state, Boolean(selected)),
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-card !bg-indigo-500"
      />

      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
          <Icon className="size-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {data.label || "New thread"}
          </p>
          {data.description && (
            <p className="truncate text-[10px] text-muted-foreground/60">{data.description}</p>
          )}
        </div>
        <span className="shrink-0 rounded-sm bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70">
          {stateLabel(data.state)}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-card !bg-indigo-500"
      />
    </div>
  );
});
