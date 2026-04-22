import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BoxIcon,
  CodeIcon,
  CpuIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  PlugIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentDefinition } from "@t3tools/contracts";
import { isElectron } from "~/env";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { cn } from "~/lib/utils";
import { openInPreferredEditor } from "~/editorPreferences";
import { readLocalApi } from "~/localApi";
import { useAgentDefinitions } from "~/hooks/useAgentDefinitions";
import { useWorkflowStore } from "~/workflowStore";
import { generateOrchestrationPrompt } from "~/lib/workflowPrompt";
import { useArtifactFileUpload } from "~/hooks/useArtifactFileUpload";
import type { AgentNodeData, ArtifactNodeData, CanvasEdge, CanvasNode } from "~/types/workflow";
import type { WorkflowTemplate } from "~/types/workflow";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail, SidebarTrigger } from "../ui/sidebar";
import { Sheet, SheetPopup } from "../ui/sheet";
import { StartNode } from "./nodes/StartNode";
import { AgentNode } from "./nodes/AgentNode";
import { ArtifactNode } from "./nodes/ArtifactNode";

const DRAG_MIME = "application/t3code-node";

const markdownStyles =
  "[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_strong]:font-semibold";

const PROMPT_PANEL_SHEET_MEDIA_QUERY = "(max-width: 1180px)";
const PROMPT_PANEL_DEFAULT_WIDTH = "clamp(24rem,40vw,38rem)";
const PROMPT_PANEL_MIN_WIDTH = 22 * 16;

function PanelCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={onClose}
      aria-label="Close panel"
    >
      <XIcon />
    </Button>
  );
}

function PromptPreviewContent({
  template,
  onClose,
}: {
  template: WorkflowTemplate;
  onClose: () => void;
}) {
  const prompt = useMemo(() => generateOrchestrationPrompt(template), [template]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3",
          isElectron
            ? "h-[52px] wco:h-[env(titlebar-area-height)]"
            : "min-h-[53px] py-2 sm:py-3",
        )}
      >
        <FileTextIcon className="size-4 text-muted-foreground/60" />
        <span className="text-sm font-medium text-muted-foreground">Orchestration Prompt</span>
        <div className="flex-1" />
        <PanelCloseButton onClose={onClose} />
      </div>
      <ScrollArea className="flex-1" scrollFade>
        <div className={cn("p-4 text-sm text-foreground/90", markdownStyles)}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt}</ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  );
}

function reconstructAgentMarkdown(agent: AgentDefinition): string {
  const frontmatter: string[] = ["---", `name: ${agent.name}`];
  if (agent.description) frontmatter.push(`description: ${agent.description}`);
  if (agent.model) frontmatter.push(`model: ${agent.model}`);
  if (agent.tools && agent.tools.length > 0)
    frontmatter.push(`tools: [${agent.tools.join(", ")}]`);
  frontmatter.push("---", "");
  return frontmatter.join("\n") + (agent.body ?? "");
}

function AgentPreviewContent({
  agent,
  onClose,
}: {
  agent: AgentDefinition;
  onClose: () => void;
}) {
  const [viewRaw, setViewRaw] = useState(false);

  const handleOpenInEditor = useCallback(() => {
    if (!agent.path) return;
    const api = readLocalApi();
    if (!api) return;
    void openInPreferredEditor(api, agent.path).catch((error) => {
      console.error("Failed to open agent in editor:", error);
    });
  }, [agent.path]);

  const metaTags: { label: string; value: string }[] = [];
  if (agent.model) metaTags.push({ label: "Model", value: agent.model });
  if (agent.scope === "plugin" && agent.pluginName)
    metaTags.push({ label: "Plugin", value: agent.pluginName });
  if (agent.tools && agent.tools.length > 0)
    metaTags.push({ label: "Tools", value: agent.tools.join(", ") });

  const rawMarkdown = useMemo(() => reconstructAgentMarkdown(agent), [agent]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3",
          isElectron
            ? "h-[52px] wco:h-[env(titlebar-area-height)]"
            : "min-h-[53px] py-2 sm:py-3",
        )}
      >
        {agent.scope === "plugin" ? (
          <PlugIcon className="size-4 text-muted-foreground/60" />
        ) : (
          <CpuIcon className="size-4 text-muted-foreground/60" />
        )}
        <span className="truncate text-sm font-medium text-muted-foreground">{agent.name}</span>
        <div className="flex-1" />
        {agent.path && (
          <Button
            variant="outline"
            size="xs"
            onClick={handleOpenInEditor}
            aria-label="Open in editor"
            title="Open in editor"
          >
            <ExternalLinkIcon />
            Edit
          </Button>
        )}
        {agent.body && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setViewRaw((v) => !v)}
            aria-label={viewRaw ? "Show rendered markdown" : "Show raw markdown"}
          >
            {viewRaw ? (
              <>
                <EyeIcon />
                Pretty
              </>
            ) : (
              <>
                <CodeIcon />
                Raw
              </>
            )}
          </Button>
        )}
        <PanelCloseButton onClose={onClose} />
      </div>
      <ScrollArea className="flex-1" scrollFade>
        <div className="p-4">
          {viewRaw ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
              {rawMarkdown}
            </pre>
          ) : (
            <>
              {agent.description && (
                <p className="mb-3 text-sm text-muted-foreground">{agent.description}</p>
              )}
              {metaTags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {metaTags.map((tag) => (
                    <span
                      key={tag.label}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <span className="font-medium">{tag.label}:</span> {tag.value}
                    </span>
                  ))}
                </div>
              )}
              {(agent.description || metaTags.length > 0) && agent.body && (
                <hr className="my-3 border-muted-foreground/20" />
              )}
              {agent.body ? (
                <div className={cn("text-sm text-foreground/90", markdownStyles)}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.body}</ReactMarkdown>
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No content available for this agent.
                </p>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PromptPreviewInlineSidebar({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <SidebarProvider
      defaultOpen={false}
      open={open}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": PROMPT_PANEL_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-card text-foreground"
        resizable={{ minWidth: PROMPT_PANEL_MIN_WIDTH }}
      >
        {children}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}

function PromptPreviewSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(88vw,700px)] max-w-[700px] p-0"
      >
        {children}
      </SheetPopup>
    </Sheet>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode as unknown as NodeTypes["start"],
  agent: AgentNode as unknown as NodeTypes["agent"],
  artifact: ArtifactNode as unknown as NodeTypes["artifact"],
};

function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
  }));
}

function toFlowEdges(edges: CanvasEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.type === "data" && { style: { strokeDasharray: "6 3" } }),
    animated: e.type === "execution",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }));
}

function fromFlowNodes(nodes: Node[]): CanvasNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type as CanvasNode["type"],
    position: n.position,
    data: n.data,
  })) as unknown as CanvasNode[];
}

// ─── Right sidebar: Agent palette ───

function AgentPaletteItem({
  agent,
  onShowDetails,
}: {
  agent: AgentDefinition;
  onShowDetails: (agent: AgentDefinition) => void;
}) {
  const Icon =
    agent.scope === "plugin" ? PlugIcon : agent.scope === "builtin" ? BoxIcon : CpuIcon;

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const payload = JSON.stringify({
        type: "agent" as const,
        label: agent.name,
        description: agent.description,
        model: agent.model,
      });
      e.dataTransfer.setData(DRAG_MIME, payload);
      e.dataTransfer.effectAllowed = "move";
    },
    [agent],
  );

  const handleDoubleClick = useCallback(() => {
    onShowDetails(agent);
  }, [agent, onShowDetails]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={handleDoubleClick}
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-accent/30 active:cursor-grabbing"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{agent.name}</p>
        {agent.description && (
          <p className="truncate text-[10px] text-muted-foreground/50">{agent.description}</p>
        )}
      </div>
    </div>
  );
}

function WorkflowRightSidebar({
  agents,
  loading,
  onShowDetails,
}: {
  agents: AgentDefinition[];
  loading: boolean;
  onShowDetails: (agent: AgentDefinition) => void;
}) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.pluginName?.toLowerCase().includes(q),
    );
  }, [agents, search]);

  const globalAgents = filtered.filter((a) => a.scope === "global");
  const pluginAgents = filtered.filter((a) => a.scope === "plugin");
  const builtinAgents = filtered.filter((a) => a.scope === "builtin");

  const pluginGroups = new Map<string, AgentDefinition[]>();
  for (const agent of pluginAgents) {
    const key = agent.pluginName ?? "unknown";
    const group = pluginGroups.get(key) ?? [];
    group.push(agent);
    pluginGroups.set(key, group);
  }

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <SparklesIcon className="size-3.5 text-muted-foreground/60" />
        <span className="text-xs font-medium text-muted-foreground">Agents</span>
      </div>

      <div className="px-2 pt-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
          <SearchIcon className="size-3 shrink-0 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter agents…"
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
        {loading ? (
          <p className="px-2 py-4 text-center text-[10px] text-muted-foreground/40">
            Loading agents...
          </p>
        ) : filtered.length === 0 ? (
          search ? (
            <p className="px-2 py-4 text-center text-[10px] text-muted-foreground/40">
              No matching agents
            </p>
          ) : (
            <div className="px-2 py-4 text-center">
              <p className="text-[10px] text-muted-foreground/60">No agents available.</p>
              <button
                type="button"
                onClick={() => void navigate({ to: "/customize/marketplaces" })}
                className="mt-2 rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-accent"
              >
                Browse marketplaces
              </button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {builtinAgents.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Built-in
                </p>
                <div className="space-y-1">
                  {builtinAgents.map((a) => (
                    <AgentPaletteItem
                      key={`builtin:${a.fileName}`}
                      agent={a}
                      onShowDetails={onShowDetails}
                    />
                  ))}
                </div>
              </div>
            )}

            {globalAgents.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Global
                </p>
                <div className="space-y-1">
                  {globalAgents.map((a) => (
                    <AgentPaletteItem
                      key={`global:${a.fileName}`}
                      agent={a}
                      onShowDetails={onShowDetails}
                    />
                  ))}
                </div>
              </div>
            )}

            {[...pluginGroups.entries()].map(([pluginName, pluginAgentGroup]) => (
              <div key={pluginName}>
                <p className="mb-1.5 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  {pluginName}
                </p>
                <div className="space-y-1">
                  {pluginAgentGroup.map((a) => (
                    <AgentPaletteItem
                      key={`plugin:${pluginName}:${a.fileName}`}
                      agent={a}
                      onShowDetails={onShowDetails}
                    />
                  ))}
                </div>
              </div>
            ))}

            {!search && globalAgents.length === 0 && pluginAgents.length === 0 ? (
              <div className="mt-2 rounded border border-dashed border-border/60 p-2 text-center">
                <p className="text-[10px] text-muted-foreground/60">
                  Want more agents? Install plugins from a marketplace.
                </p>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/customize/marketplaces" })}
                  className="mt-1.5 text-[10px] text-foreground underline-offset-2 hover:underline"
                >
                  Browse marketplaces
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main canvas ───

type PanelState =
  | { mode: "prompt" }
  | { mode: "agent"; agent: AgentDefinition }
  | null;

export function WorkflowCanvas({ templateId }: { templateId: string }) {
  const template = useWorkflowStore((s) => s.templates.find((t) => t.id === templateId));
  const updateTemplateName = useWorkflowStore((s) => s.updateTemplateName);
  const updateTemplateNodes = useWorkflowStore((s) => s.updateTemplateNodes);
  const updateTemplateEdges = useWorkflowStore((s) => s.updateTemplateEdges);
  const addNode = useWorkflowStore((s) => s.addNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const { agents, loading: agentsLoading } = useAgentDefinitions();

  const [panel, setPanel] = useState<PanelState>(null);
  const panelOpen = panel !== null;
  const promptOpen = panel?.mode === "prompt";
  const shouldUseSheet = useMediaQuery(PROMPT_PANEL_SHEET_MEDIA_QUERY);

  const togglePrompt = useCallback(() => {
    setPanel((current) => (current?.mode === "prompt" ? null : { mode: "prompt" }));
  }, []);

  const showAgentDetails = useCallback((agent: AgentDefinition) => {
    setPanel({ mode: "agent", agent });
  }, []);

  const closePanel = useCallback(() => setPanel(null), []);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    nodeId?: string;
  } | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const contextFileInputRef = useRef<HTMLInputElement>(null);
  const contextAttachNodeIdRef = useRef<string | null>(null);
  const { upload: uploadArtifactFile } = useArtifactFileUpload();

  const handleContextAttachFile = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    contextAttachNodeIdRef.current = contextMenu.nodeId;
    setContextMenu(null);
    contextFileInputRef.current?.click();
  }, [contextMenu]);

  const handleContextFileInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const nodeId = contextAttachNodeIdRef.current;
      e.target.value = "";
      if (!file || !nodeId || !template) return;
      const result = await uploadArtifactFile(file);
      if (result) {
        const updatedNodes = template.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, fileAttachment: result } } : n,
        );
        updateTemplateNodes(template.id, updatedNodes);
      }
    },
    [template, uploadArtifactFile, updateTemplateNodes],
  );

  const nodes = useMemo(() => toFlowNodes(template?.nodes ?? []), [template?.nodes]);
  const edges = useMemo(() => toFlowEdges(template?.edges ?? []), [template?.edges]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!template) return;
      const meaningful = changes.filter((c) => c.type === "position" || c.type === "remove");
      if (meaningful.length === 0) return;
      const updated = applyNodeChanges(meaningful, nodes);
      updateTemplateNodes(template.id, fromFlowNodes(updated));
    },
    [template, nodes, updateTemplateNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!template) return;
      const updated = applyEdgeChanges(changes, edges);
      const canvasEdges: CanvasEdge[] = updated.map((e) => {
        const existing = template.edges.find((ce) => ce.id === e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: existing?.type ?? "execution",
        };
      });
      updateTemplateEdges(template.id, canvasEdges);
    },
    [template, edges, updateTemplateEdges],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!template || !connection.source || !connection.target) return;
      const sourceNode = template.nodes.find((n) => n.id === connection.source);
      const targetNode = template.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const edgeType: CanvasEdge["type"] =
        sourceNode.type === "artifact" && targetNode.type === "agent" ? "data" : "execution";

      const newEdge: CanvasEdge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: edgeType,
      };
      updateTemplateEdges(template.id, [...template.edges, newEdge]);
    },
    [template, updateTemplateEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!template || !flowInstance) return;

      const raw = event.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        type: "agent" | "artifact";
        label: string;
        description?: string;
        model?: string;
        content?: string;
      };

      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = crypto.randomUUID();
      if (parsed.type === "agent") {
        const data: AgentNodeData = { label: parsed.label };
        if (parsed.description !== undefined) data.description = parsed.description;
        if (parsed.model !== undefined) data.model = parsed.model;
        addNode(template.id, {
          id,
          type: "agent",
          position,
          data,
        });
      } else {
        addNode(template.id, {
          id,
          type: "artifact",
          position,
          data: { label: parsed.label, content: parsed.content ?? "" },
        });
      }
    },
    [template, flowInstance, addNode],
  );

  const onPaneClick = useCallback(() => setContextMenu(null), []);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== "agent") return;
      const data = node.data as AgentNodeData;
      // Match canvas node back to its full AgentDefinition by name.
      // Falls back to global agents first if duplicate names exist across scopes.
      const matches = agents.filter((a) => a.name === data.label);
      const matched = matches.find((a) => a.scope === "global") ?? matches[0];
      if (matched) setPanel({ mode: "agent", agent: matched });
    },
    [agents],
  );

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    if (!flowRef.current) return;
    const bounds = flowRef.current.getBoundingClientRect();
    setContextMenu({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      screenX: event.clientX,
      screenY: event.clientY,
    });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (!flowRef.current) return;
    const bounds = flowRef.current.getBoundingClientRect();
    setContextMenu({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      screenX: event.clientX,
      screenY: event.clientY,
      nodeId: node.id,
    });
  }, []);

  const addContextNode = useCallback(
    (type: "agent" | "artifact") => {
      if (!template || !contextMenu || !flowInstance) return;
      const position = flowInstance.screenToFlowPosition({
        x: contextMenu.screenX,
        y: contextMenu.screenY,
      });
      const id = crypto.randomUUID();
      if (type === "agent") {
        addNode(template.id, {
          id,
          type: "agent",
          position,
          data: { label: "New Agent" },
        });
      } else {
        addNode(template.id, {
          id,
          type: "artifact",
          position,
          data: { label: "New Artifact", content: "" },
        });
      }
      setContextMenu(null);
    },
    [template, contextMenu, flowInstance, addNode],
  );

  const deleteContextNode = useCallback(() => {
    if (!template || !contextMenu?.nodeId) return;
    const node = template.nodes.find((n) => n.id === contextMenu.nodeId);
    if (!node || node.type === "start") return;
    removeNode(template.id, contextMenu.nodeId);
    setContextMenu(null);
  }, [template, contextMenu, removeNode]);

  if (!template) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground/60">Workflow not found</p>
        </div>
      </SidebarInset>
    );
  }

  const panelContent =
    panel?.mode === "agent" ? (
      <AgentPreviewContent agent={panel.agent} onClose={closePanel} />
    ) : (
      <PromptPreviewContent template={template} onClose={closePanel} />
    );

  const mainContent = (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
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
            <input
              className="w-auto min-w-[80px] max-w-[200px] rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-border focus:border-ring focus:bg-card"
              defaultValue={template.name}
              onBlur={(e) => {
                const val = e.currentTarget.value.trim();
                if (val && val !== template.name) {
                  updateTemplateName(template.id, val);
                } else {
                  e.currentTarget.value = template.name;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = template.name;
                  e.currentTarget.blur();
                }
              }}
            />
            <div className="flex-1" />
            <Button
              variant="outline"
              size="xs"
              onClick={togglePrompt}
              data-pressed={promptOpen ? "" : undefined}
            >
              <FileTextIcon />
              Prompt
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Canvas area */}
          <div className="relative min-w-0 flex-1" ref={flowRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={onPaneClick}
              onNodeClick={onNodeClick}
              onPaneContextMenu={onPaneContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onInit={setFlowInstance}
              fitView
              proOptions={{ hideAttribution: true }}
              className="bg-background"
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="hsl(var(--muted-foreground) / 0.08)"
              />
            </ReactFlow>

            {/* Context menu */}
            {contextMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                <div
                  className="absolute z-50 min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-lg"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                  {contextMenu.nodeId ? (
                    (() => {
                      const targetNode = template.nodes.find((n) => n.id === contextMenu.nodeId);
                      if (!targetNode || targetNode.type === "start") return null;
                      return (
                        <>
                          {targetNode.type === "artifact" && (
                            <button
                              onClick={handleContextAttachFile}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                            >
                              Attach File…
                            </button>
                          )}
                          <button
                            onClick={deleteContextNode}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Delete
                          </button>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <button
                        onClick={() => addContextNode("agent")}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                      >
                        Add Agent
                      </button>
                      <button
                        onClick={() => addContextNode("artifact")}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                      >
                        Add Artifact
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {/* Hidden file input for context-menu "Attach File" */}
            <input
              ref={contextFileInputRef}
              type="file"
              className="hidden"
              onChange={handleContextFileInputChange}
            />
          </div>

          {/* Right sidebar: agent palette */}
          <WorkflowRightSidebar
            agents={agents}
            loading={agentsLoading}
            onShowDetails={showAgentDetails}
          />
        </div>
      </div>
    </SidebarInset>
  );

  if (shouldUseSheet) {
    return (
      <>
        {mainContent}
        <PromptPreviewSheet open={panelOpen} onClose={closePanel}>
          {panelContent}
        </PromptPreviewSheet>
      </>
    );
  }

  return (
    <>
      {mainContent}
      <PromptPreviewInlineSidebar
        open={panelOpen}
        onOpenChange={(next) => {
          if (!next) closePanel();
        }}
      >
        {panelContent}
      </PromptPreviewInlineSidebar>
    </>
  );
}
