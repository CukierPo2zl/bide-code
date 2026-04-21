import type { ArtifactNodeData, WorkflowTemplate } from "~/types/workflow";

const USER_TASK_PLACEHOLDER = "(No specific task provided — execute as designed.)";
const CLOSING_LINE = "Begin execution now. Follow the execution plan above.";

/**
 * Generate an orchestration prompt from a workflow template.
 *
 * @param artifactContents - Optional map of node ID to pre-fetched file/text
 *   content. When provided, the content is emitted in an "Artifact Context"
 *   section so the executing agent has the actual data available.
 */
export function generateOrchestrationPrompt(
  template: WorkflowTemplate,
  artifactContents?: Map<string, string>,
): string {
  const agentNodes = template.nodes.filter((n) => n.type === "agent");
  const artifactNodes = template.nodes.filter((n) => n.type === "artifact");

  if (agentNodes.length === 0) {
    return "*No agent nodes in this workflow yet.* Add agents to the canvas to generate an orchestration prompt.";
  }

  const deps = new Map<string, string[]>();
  for (const edge of template.edges) {
    if (edge.type !== "execution") continue;
    const list = deps.get(edge.target) ?? [];
    list.push(edge.source);
    deps.set(edge.target, list);
  }

  const artifactContext = new Map<string, string[]>();
  for (const edge of template.edges) {
    if (edge.type !== "data") continue;
    const sourceNode = artifactNodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    const list = artifactContext.get(edge.target) ?? [];
    list.push(sourceNode.data.label);
    artifactContext.set(edge.target, list);
  }

  const inDegree = new Map<string, number>();
  for (const node of agentNodes) inDegree.set(node.id, 0);
  for (const edge of template.edges) {
    if (edge.type !== "execution") continue;
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }
  const parallelGroups: string[][] = [];
  const visited = new Set<string>();
  while (visited.size < agentNodes.length) {
    const group: string[] = [];
    for (const node of agentNodes) {
      if (!visited.has(node.id) && (inDegree.get(node.id) ?? 0) === 0) {
        group.push(node.id);
      }
    }
    if (group.length === 0) break;
    for (const id of group) visited.add(id);
    parallelGroups.push(group);
    for (const edge of template.edges) {
      if (edge.type !== "execution") continue;
      if (group.includes(edge.source) && inDegree.has(edge.target)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) - 1);
      }
    }
  }

  const nodeLabel = (id: string) =>
    template.nodes.find((n) => n.id === id)?.data.label ?? "Unknown";

  const lines: string[] = [];
  lines.push(
    "You are a workflow orchestrator. Execute the following workflow by delegating to the available agents.",
  );
  lines.push("Do NOT do the work yourself — always delegate to the appropriate agent.");
  lines.push("");
  lines.push("## Available Agents");
  for (const node of agentNodes) {
    const nodeDeps = deps.get(node.id);
    const depStr = nodeDeps?.length
      ? ` (depends on: ${nodeDeps.map(nodeLabel).join(", ")})`
      : " (no dependencies)";
    const artifacts = artifactContext.get(node.id);
    const artStr = artifacts?.length ? ` [context: ${artifacts.join(", ")}]` : "";
    lines.push(`- **${node.data.label}**${depStr}${artStr}`);
  }

  // Emit artifact content section when content is available
  const connectedArtifactIds = new Set<string>();
  for (const edge of template.edges) {
    if (edge.type !== "data") continue;
    if (artifactNodes.some((n) => n.id === edge.source)) {
      connectedArtifactIds.add(edge.source);
    }
  }

  const artifactSections: string[] = [];
  for (const node of artifactNodes) {
    if (!connectedArtifactIds.has(node.id)) continue;
    const nodeData = node.data as ArtifactNodeData;
    const content = artifactContents?.get(node.id) ?? nodeData.content;
    if (!content) continue;

    const fileNote = nodeData.fileAttachment
      ? ` (file: ${nodeData.fileAttachment.fileName})`
      : "";
    artifactSections.push(`### ${nodeData.label}${fileNote}`);
    artifactSections.push("<artifact-content>");
    artifactSections.push(content);
    artifactSections.push("</artifact-content>");
    artifactSections.push("");
  }

  if (artifactSections.length > 0) {
    lines.push("");
    lines.push("## Artifact Context");
    lines.push("");
    lines.push(...artifactSections);
  }

  lines.push("");
  lines.push("## Execution Plan");
  for (let i = 0; i < parallelGroups.length; i++) {
    const group = parallelGroups[i]!;
    const labels = group.map(nodeLabel);
    if (labels.length === 1) {
      lines.push(`Step ${i + 1}: Run **${labels[0]}**`);
    } else {
      lines.push(
        `Step ${i + 1}: Run IN PARALLEL: ${labels.map((l) => `**${l}**`).join(", ")}`,
      );
    }
  }
  lines.push("");
  lines.push("## Rules");
  lines.push("1. Launch agents that have no pending dependencies first.");
  lines.push("2. When multiple agents have no dependencies, launch them IN PARALLEL.");
  lines.push("3. Wait for agent results before launching dependent agents.");
  lines.push("4. Include upstream agent outputs as context when invoking dependent agents.");
  lines.push("");
  lines.push("## User Task");
  lines.push(USER_TASK_PLACEHOLDER);
  lines.push("");
  lines.push(CLOSING_LINE);

  return lines.join("\n");
}

export function buildWorkflowOrchestrationPrompt(
  template: WorkflowTemplate,
  userText: string,
  artifactContents?: Map<string, string>,
): string {
  const base = generateOrchestrationPrompt(template, artifactContents);
  if (!base.includes("## User Task")) {
    return base;
  }
  return base.replace(
    /## User Task\n.+/s,
    `## User Task\n${userText}\n\n${CLOSING_LINE}`,
  );
}
