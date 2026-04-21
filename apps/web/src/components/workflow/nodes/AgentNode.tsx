import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { SparklesIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import type { AgentNodeData } from "~/types/workflow";

export const AgentNode = memo(function AgentNode({
  data,
  selected,
}: NodeProps & { data: AgentNodeData }) {
  return (
    <div
      className={cn(
        "group min-w-[180px] max-w-[220px] rounded-xl border bg-card shadow-sm transition-all duration-150",
        selected ? "border-indigo-500 shadow-md" : "border-border/60 hover:border-border",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-card !bg-indigo-500"
      />

      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
          <SparklesIcon className="size-3" />
        </div>
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {data.label || "New Agent"}
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
