// ─── Canvas node types ───

export type WorkflowNodeType = "agent" | "artifact" | "start";

export interface StartNodeData {
  [key: string]: unknown;
  label: string;
}

export interface AgentNodeData {
  [key: string]: unknown;
  label: string;
  description?: string;
  model?: string;
}

export interface ArtifactFileAttachment {
  /** Server-assigned attachment ID used for retrieval */
  id: string;
  /** Original file name from disk */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ArtifactNodeData {
  [key: string]: unknown;
  label: string;
  content?: string;
  fileAttachment?: ArtifactFileAttachment;
}

export interface CanvasNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: StartNodeData | AgentNodeData | ArtifactNodeData;
}

// ─── Canvas edges ───

export type WorkflowEdgeType = "data" | "execution";

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: WorkflowEdgeType;
}

// ─── Workflow Template ───

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  createdAt: number;
  updatedAt: number;
}
