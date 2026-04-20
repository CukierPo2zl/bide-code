import { Schema, Context } from "effect";
import type { Effect } from "effect";

import type { ListAgentsInput, ListAgentsResult } from "@bide/contracts";

export class AgentDefinitionsError extends Schema.TaggedErrorClass<AgentDefinitionsError>()(
  "AgentDefinitionsError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface AgentDefinitionsShape {
  readonly listAgents: (
    input: ListAgentsInput,
  ) => Effect.Effect<ListAgentsResult, AgentDefinitionsError>;
}

export class AgentDefinitions extends Context.Service<AgentDefinitions, AgentDefinitionsShape>()(
  "t3/agents/Services/AgentDefinitions",
) {}
