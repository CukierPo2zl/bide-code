import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotIcon, PlugIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

import type { AgentDefinition, AgentScope } from "@t3tools/contracts";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { useAgentDefinitions } from "../../hooks/useAgentDefinitions";
import { cn } from "~/lib/utils";
import { AddAgentDialog } from "./AddAgentDialog";

const SCOPE_ORDER: AgentScope[] = ["builtin", "plugin", "global", "project"];

const SCOPE_LABEL: Record<AgentScope, string> = {
  builtin: "Built-in",
  plugin: "From plugins",
  global: "User",
  project: "Project",
};

function scopeBadgeClass(scope: AgentScope): string {
  switch (scope) {
    case "builtin":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "plugin":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "global":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "project":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
}

const markdownStyles =
  "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_hr]:my-6 [&_hr]:border-muted-foreground/20";

function AgentCard({
  agent,
  onClick,
}: {
  agent: AgentDefinition;
  onClick: () => void;
}) {
  const Icon = agent.scope === "plugin" ? PlugIcon : BotIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col rounded-lg border border-border bg-card p-3 text-left transition hover:border-foreground/20 hover:bg-muted/40"
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 group-hover:text-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{agent.name}</div>
          {agent.pluginName ? (
            <div className="truncate text-[11px] text-muted-foreground/80">
              {agent.pluginName}
            </div>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
            scopeBadgeClass(agent.scope),
          )}
        >
          {agent.scope}
        </span>
      </div>
      {agent.description ? (
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
          {agent.description}
        </p>
      ) : (
        <p className="mt-2 text-[12px] italic text-muted-foreground/50">No description</p>
      )}
      {agent.model ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {agent.model}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function AgentDetailDialog({
  agent,
  onClose,
}: {
  agent: AgentDefinition | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={agent !== null} onOpenChange={(open) => !open && onClose()}>
      {agent ? (
        <DialogPopup className="h-[80vh] max-w-3xl">
          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-border px-6 pb-4 pt-6">
              <div className="flex items-start gap-3 pr-10">
                {agent.scope === "plugin" ? (
                  <PlugIcon className="mt-1 size-5 shrink-0 text-muted-foreground/70" />
                ) : (
                  <BotIcon className="mt-1 size-5 shrink-0 text-muted-foreground/70" />
                )}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-base">{agent.name}</DialogTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px]",
                        scopeBadgeClass(agent.scope),
                      )}
                    >
                      {agent.scope}
                    </span>
                    {agent.pluginName ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {agent.pluginName}
                      </span>
                    ) : null}
                    {agent.model ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {agent.model}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {agent.description ? (
                <p className="mt-3 text-[13px] text-muted-foreground">{agent.description}</p>
              ) : null}
              {agent.tools && agent.tools.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              ) : null}
              {agent.path ? (
                <div className="mt-3 truncate font-mono text-[10.5px] text-muted-foreground/70">
                  {agent.path}
                </div>
              ) : null}
            </div>

            <ScrollArea className="min-h-0 flex-1" scrollFade>
              <div className="px-6 py-5">
                {agent.body ? (
                  <div className={cn("text-[13px] text-foreground/90", markdownStyles)}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.body}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    No content available for this agent.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogClose className="sr-only">Close</DialogClose>
        </DialogPopup>
      ) : null}
    </Dialog>
  );
}

export function AgentsPanel() {
  const { agents, loading, refresh } = useAgentDefinitions();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgentDefinition | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((a) => {
      const haystack = [a.name, a.description ?? "", a.pluginName ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [agents, search]);

  const grouped = useMemo(() => {
    const buckets = new Map<AgentScope, AgentDefinition[]>();
    for (const scope of SCOPE_ORDER) buckets.set(scope, []);
    for (const agent of filtered) {
      const bucket = buckets.get(agent.scope);
      if (bucket) bucket.push(agent);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return buckets;
  }, [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-medium">Agents</h2>
          <p className="text-xs text-muted-foreground">
            Every agent Claude can delegate to — built-ins, user-level, plugin-provided, and
            project-scoped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={() => setAddOpen(true)}>
            <PlusIcon className="size-3.5" />
            Add agent
          </Button>
          <Button size="xs" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-border px-5 py-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && agents.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">
            {search ? "No agents match your search." : "No agents available."}
          </div>
        ) : (
          <div className="flex flex-col">
            {SCOPE_ORDER.map((scope) => {
              const list = grouped.get(scope) ?? [];
              if (list.length === 0) return null;
              return (
                <section key={scope} className="border-b border-border last:border-b-0">
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/40 px-5 py-1.5 backdrop-blur">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {SCOPE_LABEL[scope]}
                    </h3>
                    <span className="text-[11px] text-muted-foreground/70">{list.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((agent) => (
                      <AgentCard
                        key={`${agent.scope}:${agent.pluginName ?? ""}:${agent.name}`}
                        agent={agent}
                        onClick={() => setSelected(agent)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <AgentDetailDialog agent={selected} onClose={() => setSelected(null)} />
      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void refresh()}
      />
    </div>
  );
}
