import { useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { UploadIcon, XIcon } from "lucide-react";
import type { CreateGlobalAgentInput } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { createGlobalAgent } from "../../hooks/useAgentDefinitions";
import { cn } from "~/lib/utils";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ParsedAgentMarkdown {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  body: string;
}

// Mirrors apps/server/src/agents/Layers/AgentDefinitions.ts#parseFrontmatter
// so the client interprets the upload exactly how the server reads the file back.
function parseAgentMarkdown(content: string): ParsedAgentMarkdown {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { body: content };

  const [, header, body] = match;
  const result: ParsedAgentMarkdown = { body: body ?? "" };

  for (const line of (header ?? "").split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    switch (key) {
      case "name":
        result.name = value;
        break;
      case "description":
        result.description = value;
        break;
      case "model":
        result.model = value;
        break;
      case "tools": {
        const bracketMatch = value.match(/^\[(.+)]$/);
        if (bracketMatch) {
          result.tools = bracketMatch[1]!
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
        break;
      }
    }
  }
  return result;
}

const AGENT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function buildCreateInput(
  parsed: ParsedAgentMarkdown,
): { ok: true; input: CreateGlobalAgentInput } | { ok: false; message: string } {
  const name = parsed.name?.trim();
  if (!name) {
    return {
      ok: false,
      message:
        "This file is missing a `name:` field in its frontmatter. Agent files must start with `---` / `name: …` / `---`.",
    };
  }
  if (!AGENT_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      message: `The \`name\` "${name}" is not kebab-case. Use lowercase letters, digits, and hyphens only (e.g. code-reviewer).`,
    };
  }
  if (!parsed.body.trim()) {
    return { ok: false, message: "This agent file has no body — the system prompt is empty." };
  }

  return {
    ok: true,
    input: {
      name,
      body: parsed.body.trim(),
      ...(parsed.description?.trim() && { description: parsed.description.trim() }),
      ...(parsed.model?.trim() && { model: parsed.model.trim() }),
      ...(parsed.tools && parsed.tools.length > 0 && { tools: parsed.tools }),
    },
  };
}

export function AddAgentDialog({ open, onOpenChange, onCreated }: AddAgentDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedAgentMarkdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setBusy(false);
    setError(null);
    setIsDragging(false);
    dragDepth.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSubmit = parsed !== null && !busy;

  const ingestFile = async (file: File) => {
    setError(null);
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setError(`"${file.name}" is not a Markdown file. Expected a .md file.`);
      return;
    }
    try {
      const text = await file.text();
      setFileName(file.name);
      setParsed(parseAgentMarkdown(text));
    } catch (err) {
      setError(`Could not read file: ${err instanceof Error ? err.message : String(err)}`);
      setFileName(null);
      setParsed(null);
    }
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await ingestFile(file);
  };

  const onDragEnter = (event: React.DragEvent) => {
    if (busy) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (event: React.DragEvent) => {
    if (busy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await ingestFile(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !parsed || !fileName) return;

    const built = buildCreateInput(parsed);
    if (!built.ok) {
      setError(built.message);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await createGlobalAgent(built.input);

    if (result.ok) {
      toastManager.add({
        type: "success",
        title: "Agent created",
        description: `Saved "${result.agent.name}" to ~/.claude/agents/`,
      });
      onCreated();
      reset();
      onOpenChange(false);
      return;
    }

    setError(result.message);
    setBusy(false);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(92vw,560px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <DialogPrimitive.Title className="font-heading font-semibold text-lg leading-tight">
                  Add global agent
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                  Upload an agent <code className="font-mono text-[11px]">.md</code> file. It will
                  be saved to{" "}
                  <code className="font-mono text-[11px]">~/.claude/agents/</code> and shared with
                  the <code className="font-mono text-[11px]">claude</code> CLI.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                render={<Button size="icon" variant="ghost" type="button" />}
              >
                <XIcon />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={(e) => {
                  void onDrop(e);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  isDragging
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border bg-background/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground/80",
                )}
              >
                <UploadIcon className="size-5 pointer-events-none" />
                {fileName ? (
                  <span className="font-mono text-xs text-foreground pointer-events-none">
                    {fileName}
                  </span>
                ) : (
                  <span className="pointer-events-none">
                    {isDragging ? "Drop to upload" : "Click or drag a .md file here"}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground pointer-events-none">
                  Expected:{" "}
                  <code className="font-mono">--- name: … ---</code> frontmatter + body.
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                className="hidden"
                onChange={(e) => {
                  void onFileChange(e);
                }}
              />

              {parsed ? (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 text-muted-foreground">name</span>
                    <span className="font-mono">{parsed.name ?? "—"}</span>
                  </div>
                  {parsed.description ? (
                    <div className="flex gap-2">
                      <span className="w-20 shrink-0 text-muted-foreground">description</span>
                      <span className="truncate">{parsed.description}</span>
                    </div>
                  ) : null}
                  {parsed.model ? (
                    <div className="flex gap-2">
                      <span className="w-20 shrink-0 text-muted-foreground">model</span>
                      <span className="font-mono">{parsed.model}</span>
                    </div>
                  ) : null}
                  {parsed.tools && parsed.tools.length > 0 ? (
                    <div className="flex gap-2">
                      <span className="w-20 shrink-0 text-muted-foreground">tools</span>
                      <span className="font-mono">{parsed.tools.join(", ")}</span>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 text-muted-foreground">body</span>
                    <span className="text-muted-foreground">
                      {parsed.body.trim().length} chars
                    </span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {busy ? "Creating…" : "Create agent"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
