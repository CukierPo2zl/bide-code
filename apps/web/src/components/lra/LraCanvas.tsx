import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLraGraphStore } from "~/lraGraphStore";
import type {
  LraGraphEdge,
  LraGraphNode,
  ThreadNodeData,
} from "~/types/lraGraph";
import { StartNode } from "../workflow/nodes/StartNode";
import { ThreadNode } from "./nodes/ThreadNode";
import { LraPalette, LRA_DRAG_MIME, type LraDragPayload } from "./LraPalette";

const nodeTypes: NodeTypes = {
  start: StartNode as unknown as NodeTypes["start"],
  thread: ThreadNode as unknown as NodeTypes["thread"],
};

function toFlowNodes(nodes: LraGraphNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
  }));
}

function toFlowEdges(edges: LraGraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.type === "data" && { style: { strokeDasharray: "6 3" } }),
    animated: e.type === "execution",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }));
}

function fromFlowNodes(nodes: Node[]): LraGraphNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type as LraGraphNode["type"],
    position: n.position,
    data: n.data,
  })) as unknown as LraGraphNode[];
}

export function LraCanvas({
  threadId,
  startLabel,
}: {
  threadId: string;
  startLabel?: string;
}) {
  const graph = useLraGraphStore((s) => s.graphByThreadId[threadId]);
  const getOrCreate = useLraGraphStore((s) => s.getOrCreate);
  const updateNodes = useLraGraphStore((s) => s.updateNodes);
  const updateEdges = useLraGraphStore((s) => s.updateEdges);
  const addNode = useLraGraphStore((s) => s.addNode);
  const removeNode = useLraGraphStore((s) => s.removeNode);

  useEffect(() => {
    if (!graph) getOrCreate(threadId, startLabel ?? "Start");
  }, [graph, getOrCreate, threadId, startLabel]);

  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    nodeId?: string;
  } | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => toFlowNodes(graph?.nodes ?? []), [graph?.nodes]);
  const edges = useMemo(() => toFlowEdges(graph?.edges ?? []), [graph?.edges]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!graph) return;
      const meaningful = changes.filter((c) => c.type === "position" || c.type === "remove");
      if (meaningful.length === 0) return;
      const updated = applyNodeChanges(meaningful, nodes);
      updateNodes(threadId, fromFlowNodes(updated));
    },
    [graph, nodes, threadId, updateNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!graph) return;
      const updated = applyEdgeChanges(changes, edges);
      const next: LraGraphEdge[] = updated.map((e) => {
        const existing = graph.edges.find((ce) => ce.id === e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: existing?.type ?? "execution",
        };
      });
      updateEdges(threadId, next);
    },
    [graph, edges, threadId, updateEdges],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!graph || !connection.source || !connection.target) return;
      const sourceNode = graph.nodes.find((n) => n.id === connection.source);
      const targetNode = graph.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;
      const edgeType: LraGraphEdge["type"] =
        sourceNode.type === "artifact" && targetNode.type === "thread" ? "data" : "execution";
      const newEdge: LraGraphEdge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: edgeType,
      };
      updateEdges(threadId, [...graph.edges, newEdge]);
    },
    [graph, threadId, updateEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!graph || !flowInstance) return;
      const raw = event.dataTransfer.getData(LRA_DRAG_MIME);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LraDragPayload;
      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const id = crypto.randomUUID();
      const data: ThreadNodeData = {
        label: parsed.label,
        kind: parsed.kind,
        state: "draft",
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      };
      addNode(threadId, { id, type: "thread", position, data });
    },
    [graph, flowInstance, addNode, threadId],
  );

  const onPaneClick = useCallback(() => setContextMenu(null), []);

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

  const addContextThread = useCallback(() => {
    if (!graph || !contextMenu || !flowInstance) return;
    const position = flowInstance.screenToFlowPosition({
      x: contextMenu.screenX,
      y: contextMenu.screenY,
    });
    addNode(threadId, {
      id: crypto.randomUUID(),
      type: "thread",
      position,
      data: {
        label: "New thread",
        kind: { kind: "blank" },
        state: "draft",
      },
    });
    setContextMenu(null);
  }, [graph, contextMenu, flowInstance, addNode, threadId]);

  const deleteContextNode = useCallback(() => {
    if (!graph || !contextMenu?.nodeId) return;
    const node = graph.nodes.find((n) => n.id === contextMenu.nodeId);
    if (!node || node.type === "start") return;
    removeNode(threadId, contextMenu.nodeId);
    setContextMenu(null);
  }, [graph, contextMenu, removeNode, threadId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="relative min-w-0 flex-1" ref={flowRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
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

        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div
              className="absolute z-50 min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.nodeId ? (
                (() => {
                  const targetNode = graph?.nodes.find((n) => n.id === contextMenu.nodeId);
                  if (!targetNode || targetNode.type === "start") return null;
                  return (
                    <button
                      onClick={deleteContextNode}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={addContextThread}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  Add Thread
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <LraPalette />
    </div>
  );
}
