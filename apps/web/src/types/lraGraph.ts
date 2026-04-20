import type { ArtifactNodeData, StartNodeData } from "./workflow";

export type ThreadNodeKind =
  | { kind: "blank" }
  | { kind: "promptTemplate"; templateId: string }
  | { kind: "workflowRef"; workflowTemplateId: string };

export type ThreadNodeState =
  | "draft"
  | "ready"
  | "blocked"
  | "running"
  | "done"
  | "failed";

export interface ThreadNodeData {
  [key: string]: unknown;
  label: string;
  description?: string;
  kind: ThreadNodeKind;
  state: ThreadNodeState;
}

export type LraNodeType = "start" | "thread" | "artifact";

export interface LraGraphNode {
  id: string;
  type: LraNodeType;
  position: { x: number; y: number };
  data: StartNodeData | ThreadNodeData | ArtifactNodeData;
}

export type LraEdgeType = "data" | "execution";

export interface LraGraphEdge {
  id: string;
  source: string;
  target: string;
  type: LraEdgeType;
}

export interface LraGraph {
  threadId: string;
  nodes: LraGraphNode[];
  edges: LraGraphEdge[];
  updatedAt: number;
}
