import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const AgentScope = Schema.Union([
  Schema.Literal("global"),
  Schema.Literal("project"),
  Schema.Literal("plugin"),
  Schema.Literal("builtin"),
]);
export type AgentScope = typeof AgentScope.Type;

export const AgentDefinition = Schema.Struct({
  name: TrimmedNonEmptyString,
  fileName: TrimmedNonEmptyString,
  scope: AgentScope,
  description: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  tools: Schema.optional(Schema.Array(Schema.String)),
  pluginName: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  /** Full filesystem path to the agent's .md file. */
  path: Schema.optional(Schema.String),
});
export type AgentDefinition = typeof AgentDefinition.Type;

export const ListAgentsInput = Schema.Struct({
  projectCwd: Schema.optional(Schema.String),
});
export type ListAgentsInput = typeof ListAgentsInput.Type;

export const ListAgentsResult = Schema.Struct({
  agents: Schema.Array(AgentDefinition),
});
export type ListAgentsResult = typeof ListAgentsResult.Type;

export class ListAgentsError extends Schema.TaggedErrorClass<ListAgentsError>()(
  "ListAgentsError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const CreateGlobalAgentInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  tools: Schema.optional(Schema.Array(Schema.String)),
  body: TrimmedNonEmptyString,
});
export type CreateGlobalAgentInput = typeof CreateGlobalAgentInput.Type;

export const CreateGlobalAgentResult = Schema.Struct({
  agent: AgentDefinition,
});
export type CreateGlobalAgentResult = typeof CreateGlobalAgentResult.Type;

export class CreateGlobalAgentError extends Schema.TaggedErrorClass<CreateGlobalAgentError>()(
  "CreateGlobalAgentError",
  {
    kind: Schema.Union([
      Schema.Literal("validation"),
      Schema.Literal("collision"),
      Schema.Literal("io"),
    ]),
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}
