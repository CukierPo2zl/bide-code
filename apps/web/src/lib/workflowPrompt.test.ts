import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, WorkflowTemplate } from "~/types/workflow";
import {
  buildWorkflowOrchestrationPrompt,
  generateOrchestrationPrompt,
} from "./workflowPrompt";

function makeTemplate(params: {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}): WorkflowTemplate {
  return {
    id: "tpl",
    name: "Test",
    description: "",
    nodes: params.nodes ?? [],
    edges: params.edges ?? [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const agent = (id: string, label: string): CanvasNode => ({
  id,
  type: "agent",
  position: { x: 0, y: 0 },
  data: { label },
});

const artifact = (id: string, label: string, extra?: Partial<CanvasNode["data"]>): CanvasNode => ({
  id,
  type: "artifact",
  position: { x: 0, y: 0 },
  data: { label, ...extra },
});

const executionEdge = (id: string, source: string, target: string): CanvasEdge => ({
  id,
  source,
  target,
  type: "execution",
});

const dataEdge = (id: string, source: string, target: string): CanvasEdge => ({
  id,
  source,
  target,
  type: "data",
});

describe("generateOrchestrationPrompt", () => {
  it("returns a fallback message when the workflow has no agents", () => {
    const template = makeTemplate({ nodes: [] });
    const prompt = generateOrchestrationPrompt(template);
    expect(prompt).toMatch(/No agent nodes in this workflow yet/);
    expect(prompt).not.toContain("## User Task");
  });

  it("includes a ## User Task section with the placeholder copy", () => {
    const template = makeTemplate({ nodes: [agent("a", "Researcher")] });
    const prompt = generateOrchestrationPrompt(template);
    expect(prompt).toContain("## User Task");
    expect(prompt).toContain("(No specific task provided");
    expect(prompt.trim().endsWith("Begin execution now. Follow the execution plan above.")).toBe(
      true,
    );
  });

  it("orders agents into parallel groups based on execution edges", () => {
    const template = makeTemplate({
      nodes: [agent("a", "A"), agent("b", "B"), agent("c", "C")],
      edges: [executionEdge("e1", "a", "c"), executionEdge("e2", "b", "c")],
    });
    const prompt = generateOrchestrationPrompt(template);
    expect(prompt).toMatch(/Step 1: Run IN PARALLEL: \*\*A\*\*, \*\*B\*\*/);
    expect(prompt).toMatch(/Step 2: Run \*\*C\*\*/);
  });
});

describe("buildWorkflowOrchestrationPrompt", () => {
  it("injects single-line user text into the User Task section", () => {
    const template = makeTemplate({ nodes: [agent("a", "Researcher")] });
    const result = buildWorkflowOrchestrationPrompt(template, "Refactor the auth module");
    expect(result).toContain("## User Task\nRefactor the auth module\n");
    expect(result).not.toContain("(No specific task provided");
    expect(result.trim().endsWith("Begin execution now. Follow the execution plan above.")).toBe(
      true,
    );
  });

  it("injects multi-line user text without losing lines", () => {
    const template = makeTemplate({ nodes: [agent("a", "Researcher")] });
    const userText = "Do the following:\n1. Step one\n2. Step two";
    const result = buildWorkflowOrchestrationPrompt(template, userText);
    expect(result).toContain(`## User Task\n${userText}\n`);
    expect(result).toContain("1. Step one");
    expect(result).toContain("2. Step two");
  });

  it("returns the fallback prompt unchanged when the workflow has no agents", () => {
    const template = makeTemplate({ nodes: [] });
    const result = buildWorkflowOrchestrationPrompt(template, "some task");
    expect(result).toMatch(/No agent nodes in this workflow yet/);
    expect(result).not.toContain("some task");
  });

  it("includes artifact content when artifactContents map is provided", () => {
    const template = makeTemplate({
      nodes: [agent("a1", "Writer"), artifact("art1", "Guidelines", { content: "inline text" })],
      edges: [dataEdge("d1", "art1", "a1")],
    });
    const contents = new Map([["art1", "# Style Guide\nUse active voice."]]);
    const result = buildWorkflowOrchestrationPrompt(template, "Write docs", contents);
    expect(result).toContain("## Artifact Context");
    expect(result).toContain("### Guidelines");
    expect(result).toContain("<artifact-content>");
    expect(result).toContain("# Style Guide\nUse active voice.");
    expect(result).toContain("</artifact-content>");
  });

  it("falls back to inline content when artifactContents map is empty", () => {
    const template = makeTemplate({
      nodes: [agent("a1", "Writer"), artifact("art1", "Notes", { content: "some notes" })],
      edges: [dataEdge("d1", "art1", "a1")],
    });
    const result = buildWorkflowOrchestrationPrompt(template, "Go");
    expect(result).toContain("## Artifact Context");
    expect(result).toContain("some notes");
  });

  it("does not include unconnected artifact content", () => {
    const template = makeTemplate({
      nodes: [agent("a1", "Writer"), artifact("art1", "Notes", { content: "unused notes" })],
      edges: [],
    });
    const result = buildWorkflowOrchestrationPrompt(template, "Go");
    expect(result).not.toContain("## Artifact Context");
    expect(result).not.toContain("unused notes");
  });

  it("shows file name annotation for file attachments", () => {
    const template = makeTemplate({
      nodes: [
        agent("a1", "Coder"),
        artifact("art1", "Spec", {
          fileAttachment: { id: "wf-123", fileName: "spec.md", mimeType: "text/markdown", sizeBytes: 500 },
        }),
      ],
      edges: [dataEdge("d1", "art1", "a1")],
    });
    const contents = new Map([["art1", "# Feature Spec"]]);
    const result = buildWorkflowOrchestrationPrompt(template, "Build it", contents);
    expect(result).toContain("### Spec (file: spec.md)");
    expect(result).toContain("# Feature Spec");
  });
});
