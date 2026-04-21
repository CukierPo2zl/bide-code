import { Schema } from "effect";
import * as Rpc from "effect/unstable/rpc/Rpc";

export const WORKFLOW_WS_METHODS = {
  workflowList: "workflow.list",
  workflowSave: "workflow.save",
  workflowDelete: "workflow.delete",
  subscribeWorkflows: "subscribeWorkflows",
} as const;

export const WorkflowNodeType = Schema.Literals(["agent", "artifact", "start"]);
export type WorkflowNodeType = typeof WorkflowNodeType.Type;

export const WorkflowEdgeType = Schema.Literals(["data", "execution"]);
export type WorkflowEdgeType = typeof WorkflowEdgeType.Type;

/**
 * Server-side node shape. Positions are intentionally stripped - they live only
 * on the client so dragging does not round-trip through the server.
 */
export const WorkflowNode = Schema.Struct({
  id: Schema.String,
  type: WorkflowNodeType,
  data: Schema.Record(Schema.String, Schema.Unknown),
});
export type WorkflowNode = typeof WorkflowNode.Type;

export const WorkflowEdge = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  target: Schema.String,
  type: WorkflowEdgeType,
});
export type WorkflowEdge = typeof WorkflowEdge.Type;

export const WorkflowTemplate = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  nodes: Schema.Array(WorkflowNode),
  edges: Schema.Array(WorkflowEdge),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type WorkflowTemplate = typeof WorkflowTemplate.Type;

export const WorkflowSaveInput = WorkflowTemplate;
export type WorkflowSaveInput = typeof WorkflowSaveInput.Type;

export const WorkflowDeleteInput = Schema.Struct({ id: Schema.String });
export type WorkflowDeleteInput = typeof WorkflowDeleteInput.Type;

export const WorkflowListInput = Schema.Struct({});
export type WorkflowListInput = typeof WorkflowListInput.Type;

export const WorkflowListResult = Schema.Array(WorkflowTemplate);
export type WorkflowListResult = typeof WorkflowListResult.Type;

export const WorkflowDeleteResult = Schema.Struct({ id: Schema.String });
export type WorkflowDeleteResult = typeof WorkflowDeleteResult.Type;

export const WorkflowSubscribeInput = Schema.Struct({});
export type WorkflowSubscribeInput = typeof WorkflowSubscribeInput.Type;

export const WorkflowSubscribeEvent = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("snapshot"),
    templates: Schema.Array(WorkflowTemplate),
  }),
  Schema.Struct({
    kind: Schema.Literal("upsert"),
    template: WorkflowTemplate,
  }),
  Schema.Struct({
    kind: Schema.Literal("delete"),
    id: Schema.String,
  }),
]);
export type WorkflowSubscribeEvent = typeof WorkflowSubscribeEvent.Type;

export class WorkflowServiceError extends Schema.TaggedErrorClass<WorkflowServiceError>()(
  "WorkflowServiceError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const WsWorkflowListRpc = Rpc.make(WORKFLOW_WS_METHODS.workflowList, {
  payload: WorkflowListInput,
  success: WorkflowListResult,
  error: WorkflowServiceError,
});

export const WsWorkflowSaveRpc = Rpc.make(WORKFLOW_WS_METHODS.workflowSave, {
  payload: WorkflowSaveInput,
  success: WorkflowTemplate,
  error: WorkflowServiceError,
});

export const WsWorkflowDeleteRpc = Rpc.make(WORKFLOW_WS_METHODS.workflowDelete, {
  payload: WorkflowDeleteInput,
  success: WorkflowDeleteResult,
  error: WorkflowServiceError,
});

export const WsSubscribeWorkflowsRpc = Rpc.make(WORKFLOW_WS_METHODS.subscribeWorkflows, {
  payload: WorkflowSubscribeInput,
  success: WorkflowSubscribeEvent,
  error: WorkflowServiceError,
  stream: true,
});
