import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ComponentIcon, FileIcon, LoaderIcon, PaperclipIcon, XIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { useArtifactFileUpload } from "~/hooks/useArtifactFileUpload";
import { useWorkflowStore } from "~/workflowStore";
import type { ArtifactFileAttachment, ArtifactNodeData } from "~/types/workflow";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ArtifactNode = memo(function ArtifactNode({
  id,
  data,
  selected,
}: NodeProps & { data: ArtifactNodeData }) {
  const { upload, uploading, error, clearError } = useArtifactFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const updateFileAttachment = useCallback(
    (fileAttachment: ArtifactFileAttachment | undefined) => {
      const store = useWorkflowStore.getState();
      const template = store.templates.find((t) =>
        t.nodes.some((n) => n.id === id),
      );
      if (!template) return;
      const updatedNodes = template.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, fileAttachment } } : n,
      );
      store.updateTemplateNodes(template.id, updatedNodes);
    },
    [id],
  );

  const handleFile = useCallback(
    async (file: File) => {
      clearError();
      const result = await upload(file);
      if (result) {
        updateFileAttachment(result);
      }
    },
    [upload, clearError, updateFileAttachment],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    // Only handle file drops, not palette node drags
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onBrowseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const onDetach = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateFileAttachment(undefined);
    },
    [updateFileAttachment],
  );

  const attachment = data.fileAttachment;

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "group min-w-[180px] max-w-[220px] rounded-xl border bg-card shadow-sm transition-all duration-150",
        selected ? "border-amber-500 shadow-md" : "border-border/60 hover:border-border",
        dragOver && "border-amber-400 bg-amber-500/5",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-card !bg-amber-500"
      />

      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
          <ComponentIcon className="size-3" />
        </div>
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {data.label || "New Artifact"}
        </span>
      </div>

      {/* File attachment chip */}
      {attachment && (
        <div className="border-t border-border/40 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <FileIcon className="size-3 shrink-0 text-amber-500/70" />
            <span className="flex-1 truncate text-[10px] font-medium text-foreground/70">
              {attachment.fileName}
            </span>
            <span className="shrink-0 text-[9px] text-muted-foreground/40">
              {formatSize(attachment.sizeBytes)}
            </span>
            <button
              type="button"
              onClick={onDetach}
              className="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <XIcon className="size-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="border-t border-border/40 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <LoaderIcon className="size-3 animate-spin" />
            Uploading…
          </div>
        </div>
      )}

      {/* Drop zone / attach button (shown when no file and not uploading) */}
      {!attachment && !uploading && (
        <div className="border-t border-border/40 px-2 py-1.5">
          <button
            type="button"
            onClick={onBrowseClick}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/50 px-2 py-1 text-[10px] text-muted-foreground/40 transition-colors hover:border-amber-500/40 hover:text-amber-500/60"
          >
            <PaperclipIcon className="size-2.5" />
            {dragOver ? "Drop file here" : "Attach file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileInputChange}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="border-t border-border/40 px-3 py-1">
          <p className="text-[9px] text-destructive">{error}</p>
        </div>
      )}

      {/* Existing text content preview */}
      {data.content && !attachment && (
        <div className="border-t border-border/40 px-3 py-1.5">
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/35">
            {data.content}
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-card !bg-amber-500"
      />
    </div>
  );
});
