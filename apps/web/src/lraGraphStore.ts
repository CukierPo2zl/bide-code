import { Debouncer } from "@tanstack/react-pacer";
import { create } from "zustand";

import type { LraGraph, LraGraphEdge, LraGraphNode } from "./types/lraGraph";

const STORAGE_KEY = "bidecode:lra-graphs:v1";

// ───────────────────────────────────────────────────────────
// localStorage persistence (client-only for PR 1)
// ───────────────────────────────────────────────────────────

function readStoredGraphs(): Record<string, LraGraph> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, LraGraph> = {};
    for (const [threadId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const graph = value as Partial<LraGraph>;
      if (typeof graph.threadId !== "string" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        continue;
      }
      out[threadId] = {
        threadId: graph.threadId,
        nodes: graph.nodes as LraGraphNode[],
        edges: graph.edges as LraGraphEdge[],
        updatedAt: typeof graph.updatedAt === "number" ? graph.updatedAt : Date.now(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredGraphs(graphs: Record<string, LraGraph>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
  } catch {
    // ignore quota errors
  }
}

const debouncedPersist = new Debouncer(writeStoredGraphs, { wait: 300 });

// ───────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────

interface LraGraphState {
  graphByThreadId: Record<string, LraGraph>;
}

interface LraGraphActions {
  getOrCreate: (threadId: string, startLabel?: string) => LraGraph;
  updateNodes: (threadId: string, nodes: LraGraphNode[]) => void;
  updateEdges: (threadId: string, edges: LraGraphEdge[]) => void;
  addNode: (threadId: string, node: LraGraphNode) => void;
  removeNode: (threadId: string, nodeId: string) => void;
  clearGraph: (threadId: string) => void;
}

type LraGraphStore = LraGraphState & LraGraphActions;

function makeStartNode(label: string): LraGraphNode {
  return {
    id: crypto.randomUUID(),
    type: "start",
    position: { x: 100, y: 200 },
    data: { label },
  };
}

export const useLraGraphStore = create<LraGraphStore>((set, get) => ({
  graphByThreadId: readStoredGraphs(),

  getOrCreate: (threadId, startLabel = "Start") => {
    const existing = get().graphByThreadId[threadId];
    if (existing) return existing;
    const graph: LraGraph = {
      threadId,
      nodes: [makeStartNode(startLabel)],
      edges: [],
      updatedAt: Date.now(),
    };
    set((state) => ({
      graphByThreadId: { ...state.graphByThreadId, [threadId]: graph },
    }));
    return graph;
  },

  updateNodes: (threadId, nodes) => {
    set((state) => {
      const existing = state.graphByThreadId[threadId];
      if (!existing) return state;
      return {
        graphByThreadId: {
          ...state.graphByThreadId,
          [threadId]: { ...existing, nodes, updatedAt: Date.now() },
        },
      };
    });
  },

  updateEdges: (threadId, edges) => {
    set((state) => {
      const existing = state.graphByThreadId[threadId];
      if (!existing) return state;
      return {
        graphByThreadId: {
          ...state.graphByThreadId,
          [threadId]: { ...existing, edges, updatedAt: Date.now() },
        },
      };
    });
  },

  addNode: (threadId, node) => {
    set((state) => {
      const existing = state.graphByThreadId[threadId];
      if (!existing) return state;
      return {
        graphByThreadId: {
          ...state.graphByThreadId,
          [threadId]: {
            ...existing,
            nodes: [...existing.nodes, node],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  removeNode: (threadId, nodeId) => {
    set((state) => {
      const existing = state.graphByThreadId[threadId];
      if (!existing) return state;
      return {
        graphByThreadId: {
          ...state.graphByThreadId,
          [threadId]: {
            ...existing,
            nodes: existing.nodes.filter((n) => n.id !== nodeId),
            edges: existing.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  clearGraph: (threadId) => {
    set((state) => {
      if (!(threadId in state.graphByThreadId)) return state;
      const next = { ...state.graphByThreadId };
      delete next[threadId];
      return { graphByThreadId: next };
    });
  },
}));

useLraGraphStore.subscribe((state) => {
  debouncedPersist.maybeExecute(state.graphByThreadId);
});

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    debouncedPersist.flush();
  });
}
