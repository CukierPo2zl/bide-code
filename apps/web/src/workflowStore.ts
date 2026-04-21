import { Debouncer } from "@tanstack/react-pacer";
import type { WorkflowSubscribeEvent, WorkflowTemplate as ServerWorkflowTemplate } from "@t3tools/contracts";
import { create } from "zustand";

import { getPrimaryEnvironmentConnection } from "./environments/runtime";
import type { CanvasEdge, CanvasNode, WorkflowTemplate } from "./types/workflow";

const LEGACY_STORAGE_KEY = "t3code:workflows:v1";
const POSITIONS_STORAGE_KEY = "t3code:workflows:positions:v1";

// ───────────────────────────────────────────────────────────
// Position map persisted client-side only
// ───────────────────────────────────────────────────────────

type PositionMap = Record<string, Record<string, { x: number; y: number }>>;

function readPositionMap(): PositionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as PositionMap) : {};
  } catch {
    return {};
  }
}

function writePositionMap(map: PositionMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

let positionMapCache: PositionMap = readPositionMap();

function getNodePosition(templateId: string, nodeId: string): { x: number; y: number } | null {
  return positionMapCache[templateId]?.[nodeId] ?? null;
}

function setNodePosition(
  templateId: string,
  nodeId: string,
  position: { x: number; y: number },
): void {
  const forTemplate = positionMapCache[templateId] ?? {};
  positionMapCache = {
    ...positionMapCache,
    [templateId]: { ...forTemplate, [nodeId]: position },
  };
  writePositionMap(positionMapCache);
}

function prunePositionsForTemplate(templateId: string, keepIds: Set<string>): void {
  const forTemplate = positionMapCache[templateId];
  if (!forTemplate) return;
  const next: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of Object.entries(forTemplate)) {
    if (keepIds.has(id)) next[id] = pos;
  }
  positionMapCache = { ...positionMapCache, [templateId]: next };
  writePositionMap(positionMapCache);
}

function dropPositionsForTemplate(templateId: string): void {
  if (!(templateId in positionMapCache)) return;
  const { [templateId]: _dropped, ...rest } = positionMapCache;
  positionMapCache = rest;
  writePositionMap(positionMapCache);
}

// ───────────────────────────────────────────────────────────
// Discard legacy local templates on boot
// ───────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ───────────────────────────────────────────────────────────
// Helpers to convert server <-> client shapes
// ───────────────────────────────────────────────────────────

function makeStartNode(): CanvasNode {
  return {
    id: crypto.randomUUID(),
    type: "start",
    position: { x: 100, y: 200 },
    data: { label: "Start" },
  };
}

function stripPositionsForServer(nodes: CanvasNode[]): ServerWorkflowTemplate["nodes"] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data,
  })) as unknown as ServerWorkflowTemplate["nodes"];
}

function templateToServer(template: WorkflowTemplate): ServerWorkflowTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    nodes: stripPositionsForServer(template.nodes),
    edges: template.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
    })),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function mergePositions(
  templateId: string,
  nodes: ServerWorkflowTemplate["nodes"],
): CanvasNode[] {
  return nodes.map((n, idx) => {
    const stored = getNodePosition(templateId, n.id);
    return {
      id: n.id,
      type: n.type,
      position: stored ?? { x: 120 + idx * 180, y: 120 },
      data: n.data as CanvasNode["data"],
    };
  });
}

function templateFromServer(t: ServerWorkflowTemplate): WorkflowTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    nodes: mergePositions(t.id, t.nodes),
    edges: t.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// Stable structural hash excluding positions
function structuralHash(template: WorkflowTemplate): string {
  const nodes = template.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data,
  }));
  const edges = template.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));
  return JSON.stringify({
    name: template.name,
    description: template.description,
    nodes,
    edges,
  });
}

// ───────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────

interface WorkflowState {
  templates: WorkflowTemplate[];
  activeTemplateId: string | null;
  hydrated: boolean;
}

interface WorkflowActions {
  createTemplate: (name: string) => WorkflowTemplate;
  deleteTemplate: (id: string) => void;
  setActiveTemplate: (id: string | null) => void;
  updateTemplateName: (id: string, name: string) => void;
  updateTemplateNodes: (id: string, nodes: CanvasNode[]) => void;
  updateTemplateEdges: (id: string, edges: CanvasEdge[]) => void;
  addNode: (id: string, node: CanvasNode) => void;
  removeNode: (id: string, nodeId: string) => void;
}

type WorkflowStore = WorkflowState & WorkflowActions;

// Tracks last-saved structural hash per template, so we debounce only when
// structural change actually occurs.
const lastStructuralHash = new Map<string, string>();

async function dispatchSave(templateId: string): Promise<void> {
  const state = useWorkflowStore.getState();
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return;
  try {
    const connection = getPrimaryEnvironmentConnection();
    await connection.client.workflow.save(templateToServer(template));
  } catch (error) {
    console.error("[workflowStore] Failed to save workflow template:", error);
  }
}

const saveDebouncer = new Debouncer((templateId: string) => dispatchSave(templateId), {
  wait: 300,
});

function requestDebouncedSave(templateId: string): void {
  const template = useWorkflowStore.getState().templates.find((t) => t.id === templateId);
  if (!template) return;
  const nextHash = structuralHash(template);
  const prevHash = lastStructuralHash.get(templateId);
  if (prevHash === nextHash) return;
  lastStructuralHash.set(templateId, nextHash);
  saveDebouncer.maybeExecute(templateId);
}

async function dispatchImmediateSave(templateId: string): Promise<void> {
  const template = useWorkflowStore.getState().templates.find((t) => t.id === templateId);
  if (!template) return;
  lastStructuralHash.set(templateId, structuralHash(template));
  await dispatchSave(templateId);
}

async function dispatchDelete(templateId: string): Promise<void> {
  try {
    const connection = getPrimaryEnvironmentConnection();
    await connection.client.workflow.delete({ id: templateId });
  } catch (error) {
    console.error("[workflowStore] Failed to delete workflow template:", error);
  }
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  templates: [],
  activeTemplateId: null,
  hydrated: false,

  createTemplate: (name) => {
    const template: WorkflowTemplate = {
      id: crypto.randomUUID(),
      name,
      description: "",
      nodes: [makeStartNode()],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      templates: [...state.templates, template],
      activeTemplateId: template.id,
    }));
    // immediate save on create
    void dispatchImmediateSave(template.id);
    return template;
  },

  deleteTemplate: (id) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      activeTemplateId: state.activeTemplateId === id ? null : state.activeTemplateId,
    }));
    lastStructuralHash.delete(id);
    dropPositionsForTemplate(id);
    void dispatchDelete(id);
  },

  setActiveTemplate: (id) => {
    set({ activeTemplateId: id });
  },

  updateTemplateName: (id, name) => {
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, name, updatedAt: Date.now() } : t,
      ),
    }));
    requestDebouncedSave(id);
  },

  updateTemplateNodes: (id, nodes) => {
    // Persist positions client-side for every node
    for (const node of nodes) {
      setNodePosition(id, node.id, node.position);
    }
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, nodes, updatedAt: Date.now() } : t,
      ),
    }));
    requestDebouncedSave(id);
  },

  updateTemplateEdges: (id, edges) => {
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, edges, updatedAt: Date.now() } : t,
      ),
    }));
    requestDebouncedSave(id);
  },

  addNode: (id, node) => {
    setNodePosition(id, node.id, node.position);
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, nodes: [...t.nodes, node], updatedAt: Date.now() } : t,
      ),
    }));
    requestDebouncedSave(id);
  },

  removeNode: (templateId, nodeId) => {
    set((state) => {
      const next = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        return {
          ...t,
          nodes: t.nodes.filter((n) => n.id !== nodeId),
          edges: t.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          updatedAt: Date.now(),
        };
      });
      return { templates: next };
    });
    const remaining = new Set(
      get().templates.find((t) => t.id === templateId)?.nodes.map((n) => n.id) ?? [],
    );
    prunePositionsForTemplate(templateId, remaining);
    requestDebouncedSave(templateId);
  },
}));

// ───────────────────────────────────────────────────────────
// Subscription bootstrap
// ───────────────────────────────────────────────────────────

let subscriptionStarted = false;

function applySubscriptionEvent(event: WorkflowSubscribeEvent): void {
  if (event.kind === "snapshot") {
    const templates = event.templates.map(templateFromServer);
    for (const t of templates) {
      lastStructuralHash.set(t.id, structuralHash(t));
    }
    useWorkflowStore.setState({ templates, hydrated: true });
    // After hydrating, flush any legacy storage keys that may still exist.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return;
  }
  if (event.kind === "upsert") {
    const incoming = templateFromServer(event.template);
    useWorkflowStore.setState((state) => {
      const existingIdx = state.templates.findIndex((t) => t.id === incoming.id);
      if (existingIdx === -1) {
        return { templates: [...state.templates, incoming] };
      }
      // Preserve client-side positions by not overwriting full template if
      // local state is structurally equivalent; otherwise adopt server shape.
      const merged = [...state.templates];
      merged[existingIdx] = incoming;
      return { templates: merged };
    });
    lastStructuralHash.set(incoming.id, structuralHash(incoming));
    return;
  }
  if (event.kind === "delete") {
    useWorkflowStore.setState((state) => ({
      templates: state.templates.filter((t) => t.id !== event.id),
      activeTemplateId: state.activeTemplateId === event.id ? null : state.activeTemplateId,
    }));
    lastStructuralHash.delete(event.id);
    dropPositionsForTemplate(event.id);
  }
}

export function startWorkflowSync(): void {
  if (subscriptionStarted) return;
  if (typeof window === "undefined") return;
  subscriptionStarted = true;
  try {
    const connection = getPrimaryEnvironmentConnection();
    connection.client.workflow.subscribe((event) => {
      applySubscriptionEvent(event);
    });
  } catch (error) {
    console.error("[workflowStore] Failed to start workflow subscription:", error);
    subscriptionStarted = false;
  }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    saveDebouncer.flush();
  });
}
