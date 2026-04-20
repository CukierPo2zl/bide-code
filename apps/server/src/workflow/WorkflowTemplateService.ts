import {
  type WorkflowSubscribeEvent,
  type WorkflowTemplate,
  WorkflowServiceError,
} from "@bide/contracts";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

interface WorkflowTemplateRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodes_json: string;
  readonly edges_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToTemplate(row: WorkflowTemplateRow): WorkflowTemplate {
  const nodes = JSON.parse(row.nodes_json) as WorkflowTemplate["nodes"];
  const edges = JSON.parse(row.edges_json) as WorkflowTemplate["edges"];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nodes,
    edges,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const toWorkflowError = (message: string) =>
  (cause: unknown): WorkflowServiceError =>
    new WorkflowServiceError({ message, cause });

export interface WorkflowTemplateServiceShape {
  readonly list: () => Effect.Effect<ReadonlyArray<WorkflowTemplate>, WorkflowServiceError>;
  readonly save: (
    template: WorkflowTemplate,
  ) => Effect.Effect<WorkflowTemplate, WorkflowServiceError>;
  readonly delete: (id: string) => Effect.Effect<{ id: string }, WorkflowServiceError>;
  readonly changes: Stream.Stream<WorkflowSubscribeEvent>;
}

export class WorkflowTemplateService extends Context.Service<
  WorkflowTemplateService,
  WorkflowTemplateServiceShape
>()("t3/workflow/WorkflowTemplateService") {}

const makeWorkflowTemplateService = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const pubsub = yield* PubSub.unbounded<WorkflowSubscribeEvent>();

  const list: WorkflowTemplateServiceShape["list"] = () =>
    Effect.gen(function* () {
      const rows = yield* sql<WorkflowTemplateRow>`
        SELECT id, name, description, nodes_json, edges_json, created_at, updated_at
        FROM workflow_templates
        ORDER BY updated_at DESC
      `;
      return rows.map(rowToTemplate) as ReadonlyArray<WorkflowTemplate>;
    }).pipe(Effect.mapError(toWorkflowError("Failed to list workflow templates")));

  const save: WorkflowTemplateServiceShape["save"] = (template) =>
    Effect.gen(function* () {
      const nodesJson = JSON.stringify(template.nodes);
      const edgesJson = JSON.stringify(template.edges);
      const createdAt = String(template.createdAt);
      const updatedAt = String(template.updatedAt);
      yield* sql`
        INSERT INTO workflow_templates (
          id, name, description, nodes_json, edges_json, created_at, updated_at
        ) VALUES (
          ${template.id},
          ${template.name},
          ${template.description},
          ${nodesJson},
          ${edgesJson},
          ${createdAt},
          ${updatedAt}
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          nodes_json = excluded.nodes_json,
          edges_json = excluded.edges_json,
          updated_at = excluded.updated_at
      `;
      yield* PubSub.publish(pubsub, { kind: "upsert", template });
      return template;
    }).pipe(Effect.mapError(toWorkflowError("Failed to save workflow template")));

  const deleteTemplate: WorkflowTemplateServiceShape["delete"] = (id) =>
    Effect.gen(function* () {
      yield* sql`DELETE FROM workflow_templates WHERE id = ${id}`;
      yield* PubSub.publish(pubsub, { kind: "delete", id });
      return { id };
    }).pipe(Effect.mapError(toWorkflowError("Failed to delete workflow template")));

  return {
    list,
    save,
    delete: deleteTemplate,
    get changes() {
      return Stream.fromPubSub(pubsub);
    },
  } satisfies WorkflowTemplateServiceShape;
});

export const WorkflowTemplateServiceLive = Layer.effect(
  WorkflowTemplateService,
  makeWorkflowTemplateService,
);
