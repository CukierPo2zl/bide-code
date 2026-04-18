import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeftIcon, CodeIcon, CpuIcon, EyeIcon, PlugIcon, XIcon } from "lucide-react";
import type { AgentDefinition } from "@bide/contracts";
import { isElectron } from "../env";
import { cn } from "~/lib/utils";
import { useUiStateStore } from "~/uiStateStore";
import { Button } from "./ui/button";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { ScrollArea } from "./ui/scroll-area";

const markdownStyles =
  "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_hr]:my-6 [&_hr]:border-muted-foreground/20 [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-sm [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm";

function AgentMeta({ agent }: { agent: AgentDefinition }) {
  const tags: { label: string; value: string }[] = [];
  if (agent.model) tags.push({ label: "Model", value: agent.model });
  if (agent.scope === "plugin" && agent.pluginName)
    tags.push({ label: "Plugin", value: agent.pluginName });
  if (agent.tools && agent.tools.length > 0)
    tags.push({ label: "Tools", value: agent.tools.join(", ") });

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.label}
          className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
        >
          <span className="font-medium">{tag.label}:</span> {tag.value}
        </span>
      ))}
    </div>
  );
}

export function AgentDetailView({ agent }: { agent: AgentDefinition }) {
  const [viewRaw, setViewRaw] = useState(false);
  const setSelectedAgent = useUiStateStore((s) => s.setSelectedAgent);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "border-b border-border px-3 sm:px-5",
            isElectron
              ? "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]"
              : "py-2 sm:py-3",
          )}
        >
          <div className="flex w-full items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0 md:hidden" />
            <Button variant="outline" size="xs" onClick={() => setSelectedAgent(null)}>
              <ArrowLeftIcon />
              Back
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            {agent.scope === "plugin" ? (
              <PlugIcon className="size-4 text-muted-foreground/60" />
            ) : (
              <CpuIcon className="size-4 text-muted-foreground/60" />
            )}
            <span className="text-sm font-medium">{agent.name}</span>
            <div className="flex-1" />
            {agent.body && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setViewRaw((v) => !v)}
              >
                {viewRaw ? <><EyeIcon /> Pretty</> : <><CodeIcon /> Raw</>}
              </Button>
            )}
            <Button variant="outline" size="xs" onClick={() => setSelectedAgent(null)}>
              <XIcon />
              Close
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1" scrollFade>
          <div className="mx-auto w-full max-w-3xl px-6 py-6 sm:px-10 sm:py-8">
            {agent.description && (
              <p className="mb-4 text-sm text-muted-foreground">{agent.description}</p>
            )}
            <AgentMeta agent={agent} />
            {(agent.description || (agent.tools && agent.tools.length > 0) || agent.model) &&
              agent.body && <hr className="my-6 border-muted-foreground/20" />}
            {agent.body ? (
              viewRaw ? (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
                  {agent.body}
                </pre>
              ) : (
                <div className={cn("text-sm text-foreground/90", markdownStyles)}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.body}</ReactMarkdown>
                </div>
              )
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No content available for this agent.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
