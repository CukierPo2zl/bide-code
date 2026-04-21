import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { PlayIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export const StartNode = memo(function StartNode({ selected }: NodeProps) {
  return (
    <div
      className={cn(
        "flex size-10 items-center justify-center rounded-full border-2 shadow-md transition-all",
        selected
          ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/20"
          : "border-emerald-500/60 bg-emerald-500/10",
      )}
    >
      <PlayIcon className="ml-0.5 size-4 text-emerald-500" />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-card !bg-emerald-500"
      />
    </div>
  );
});
