import { CpuIcon, LibraryIcon, PlugIcon, RefreshCwIcon } from "lucide-react";
import type { AgentDefinition } from "@t3tools/contracts";
import { useAgentDefinitions } from "~/hooks/useAgentDefinitions";
import { useUiStateStore } from "~/uiStateStore";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar";

function AgentRow({ agent, onSelect }: { agent: AgentDefinition; onSelect: () => void }) {
  const isPlugin = agent.scope === "plugin";
  const selectedAgent = useUiStateStore((s) => s.selectedAgent);
  const isActive =
    selectedAgent?.fileName === agent.fileName && selectedAgent?.scope === agent.scope;

  return (
    <SidebarMenuItem>
      <button
        type="button"
        onClick={onSelect}
        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        {isPlugin ? (
          <PlugIcon className="size-4 shrink-0 text-muted-foreground/60" />
        ) : (
          <CpuIcon className="size-4 shrink-0 text-muted-foreground/60" />
        )}
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm">{agent.name}</span>
          {agent.description && (
            <p className="truncate text-xs text-muted-foreground/60">{agent.description}</p>
          )}
        </div>
      </button>
    </SidebarMenuItem>
  );
}

function AgentList({
  agents,
  onSelect,
}: {
  agents: AgentDefinition[];
  onSelect: (agent: AgentDefinition) => void;
}) {
  const globalAgents = agents.filter((a) => a.scope === "global");
  const pluginAgents = agents.filter((a) => a.scope === "plugin");

  const pluginGroups = new Map<string, AgentDefinition[]>();
  for (const agent of pluginAgents) {
    const key = agent.pluginName ?? "unknown";
    const group = pluginGroups.get(key) ?? [];
    group.push(agent);
    pluginGroups.set(key, group);
  }

  return (
    <>
      {globalAgents.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Global Agents</SidebarGroupLabel>
          <SidebarMenu>
            {globalAgents.map((agent) => (
              <AgentRow
                key={`global:${agent.fileName}`}
                agent={agent}
                onSelect={() => onSelect(agent)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {pluginGroups.size > 0 &&
        [...pluginGroups.entries()].map(([pluginName, agents]) => (
          <SidebarGroup key={pluginName}>
            <SidebarGroupLabel>{pluginName}</SidebarGroupLabel>
            <SidebarMenu>
              {agents.map((agent) => (
                <AgentRow
                  key={`plugin:${pluginName}:${agent.fileName}`}
                  agent={agent}
                  onSelect={() => onSelect(agent)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
    </>
  );
}

export function LibrarySidebarPanel() {
  const { agents, loading, refresh } = useAgentDefinitions();
  const setSelectedAgent = useUiStateStore((s) => s.setSelectedAgent);

  if (loading) {
    return (
      <SidebarContent>
        <SidebarGroup className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-xs text-muted-foreground/60">Loading agents...</p>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  if (agents.length === 0) {
    return (
      <SidebarContent>
        <SidebarGroup className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <LibraryIcon className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No agents found</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Add agent definitions to ~/.claude/agents/
          </p>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent>
      <SidebarGroup className="pb-0">
        <div className="flex items-center justify-between">
          <SidebarGroupLabel>
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </SidebarGroupLabel>
          <button
            onClick={refresh}
            className="mr-2 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-muted-foreground"
          >
            <RefreshCwIcon className="size-3" />
          </button>
        </div>
      </SidebarGroup>
      <AgentList agents={agents} onSelect={setSelectedAgent} />
    </SidebarContent>
  );
}
