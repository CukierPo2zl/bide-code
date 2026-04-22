import * as OS from "node:os";
import fsPromises from "node:fs/promises";
import nodePath from "node:path";

import { Effect, Layer } from "effect";

import {
  CreateGlobalAgentError,
  type AgentDefinition,
  type AgentScope,
  type CreateGlobalAgentInput,
} from "@t3tools/contracts";

import {
  AgentDefinitions,
  AgentDefinitionsError,
  type AgentDefinitionsShape,
} from "../Services/AgentDefinitions.ts";
import { BUILTIN_AGENTS } from "../builtinAgents.ts";

interface InstalledPluginsFile {
  version: number;
  plugins: Record<
    string,
    Array<{
      scope: string;
      installPath: string;
      version: string;
    }>
  >;
}

function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { body: content };
  }
  const [, header, body] = match;
  const result: ReturnType<typeof parseFrontmatter> = { body: body ?? "" };

  for (const line of (header ?? "").split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    switch (key) {
      case "name":
        result.name = value;
        break;
      case "description":
        result.description = value;
        break;
      case "model":
        result.model = value;
        break;
      case "tools": {
        const bracketMatch = value.match(/^\[(.+)]$/);
        if (bracketMatch) {
          result.tools = bracketMatch[1]!
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
        break;
      }
    }
  }
  return result;
}

async function readAgentsFromDir(
  dirPath: string,
  scope: AgentScope,
  pluginName?: string,
): Promise<AgentDefinition[]> {
  let entries;
  try {
    entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const agents: AgentDefinition[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    try {
      const filePath = nodePath.join(dirPath, entry.name);
      const content = await fsPromises.readFile(filePath, "utf-8");
      const meta = parseFrontmatter(content);
      agents.push({
        name: meta.name ?? entry.name.replace(/\.md$/, ""),
        fileName: entry.name,
        scope,
        ...(meta.description !== undefined && { description: meta.description }),
        ...(meta.model !== undefined && { model: meta.model }),
        ...(meta.tools !== undefined && { tools: meta.tools }),
        ...(pluginName !== undefined && { pluginName }),
        ...(meta.body.trim() !== "" && { body: meta.body.trim() }),
        path: filePath,
      });
    } catch {
      // Skip files that can't be read
    }
  }
  return agents;
}

async function readPluginAgents(): Promise<AgentDefinition[]> {
  const installedPluginsPath = nodePath.join(
    OS.homedir(),
    ".claude",
    "plugins",
    "installed_plugins.json",
  );

  let installedPlugins: InstalledPluginsFile;
  try {
    const raw = await fsPromises.readFile(installedPluginsPath, "utf-8");
    installedPlugins = JSON.parse(raw) as InstalledPluginsFile;
  } catch {
    return [];
  }

  const agents: AgentDefinition[] = [];
  for (const [pluginId, installations] of Object.entries(installedPlugins.plugins)) {
    // Use the first (most recent) installation
    const install = installations[0];
    if (!install?.installPath) continue;

    // Plugin ID format: "name@marketplace" — extract just the name
    const pluginName = pluginId.split("@")[0] ?? pluginId;
    const agentsDir = nodePath.join(install.installPath, "agents");
    const pluginAgents = await readAgentsFromDir(agentsDir, "plugin", pluginName);
    agents.push(...pluginAgents);
  }

  return agents;
}

const AGENT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function escapeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[:\n#"'\\]/.test(trimmed) || /^[\s{\[]/.test(trimmed)) {
    return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return trimmed;
}

function buildAgentFile(input: CreateGlobalAgentInput): string {
  const lines: string[] = ["---", `name: ${input.name}`];
  if (input.description && input.description.trim()) {
    lines.push(`description: ${escapeFrontmatterValue(input.description)}`);
  }
  if (input.model && input.model.trim()) {
    lines.push(`model: ${escapeFrontmatterValue(input.model)}`);
  }
  if (input.tools && input.tools.length > 0) {
    const toolsList = input.tools.map((t) => t.trim()).filter(Boolean);
    if (toolsList.length > 0) {
      lines.push(`tools: [${toolsList.join(", ")}]`);
    }
  }
  lines.push("---", "", input.body.trim(), "");
  return lines.join("\n");
}

async function createGlobalAgentFile(
  input: CreateGlobalAgentInput,
): Promise<AgentDefinition> {
  if (!AGENT_NAME_PATTERN.test(input.name)) {
    throw new CreateGlobalAgentError({
      kind: "validation",
      message:
        "Agent name must be kebab-case: lowercase letters, digits, and hyphens only (e.g., code-reviewer).",
    });
  }

  const globalAgentsDir = nodePath.join(OS.homedir(), ".claude", "agents");
  const fileName = `${input.name}.md`;
  const filePath = nodePath.join(globalAgentsDir, fileName);

  const resolved = nodePath.resolve(filePath);
  if (!resolved.startsWith(nodePath.resolve(globalAgentsDir) + nodePath.sep)) {
    throw new CreateGlobalAgentError({
      kind: "validation",
      message: "Resolved agent path escapes the global agents directory.",
    });
  }

  await fsPromises.mkdir(globalAgentsDir, { recursive: true });

  try {
    await fsPromises.access(filePath);
    throw new CreateGlobalAgentError({
      kind: "collision",
      message: `An agent named "${input.name}" already exists at ${filePath}.`,
    });
  } catch (err) {
    if (err instanceof CreateGlobalAgentError) throw err;
    // ENOENT — file doesn't exist, proceed
  }

  const content = buildAgentFile(input);
  await fsPromises.writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });

  return {
    name: input.name,
    fileName,
    scope: "global",
    ...(input.description?.trim() && { description: input.description.trim() }),
    ...(input.model?.trim() && { model: input.model.trim() }),
    ...(input.tools && input.tools.length > 0 && { tools: [...input.tools] }),
    body: input.body.trim(),
    path: filePath,
  };
}

export const makeAgentDefinitions = Effect.gen(function* () {
  const listAgents: AgentDefinitionsShape["listAgents"] = Effect.fn(
    "AgentDefinitions.listAgents",
  )(function* (input) {
    const globalAgentsDir = nodePath.join(OS.homedir(), ".claude", "agents");
    const globalAgents = yield* Effect.tryPromise({
      try: () => readAgentsFromDir(globalAgentsDir, "global"),
      catch: (cause) =>
        new AgentDefinitionsError({
          operation: "agentDefinitions.listAgents.global",
          detail: `Failed to read global agents: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        }),
    });

    const pluginAgents = yield* Effect.tryPromise({
      try: () => readPluginAgents(),
      catch: (cause) =>
        new AgentDefinitionsError({
          operation: "agentDefinitions.listAgents.plugins",
          detail: `Failed to read plugin agents: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        }),
    });

    let projectAgents: AgentDefinition[] = [];
    if (input.projectCwd) {
      const projectAgentsDir = nodePath.join(input.projectCwd, ".claude", "agents");
      projectAgents = yield* Effect.tryPromise({
        try: () => readAgentsFromDir(projectAgentsDir, "project"),
        catch: (cause) =>
          new AgentDefinitionsError({
            operation: "agentDefinitions.listAgents.project",
            detail: `Failed to read project agents: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          }),
      });
    }

    return {
      agents: [...globalAgents, ...pluginAgents, ...projectAgents, ...BUILTIN_AGENTS],
    };
  });

  const createGlobalAgent: AgentDefinitionsShape["createGlobalAgent"] = Effect.fn(
    "AgentDefinitions.createGlobalAgent",
  )(function* (input) {
    const agent = yield* Effect.tryPromise({
      try: () => createGlobalAgentFile(input),
      catch: (cause) => {
        if (cause instanceof CreateGlobalAgentError) return cause;
        return new CreateGlobalAgentError({
          kind: "io",
          message: `Failed to create agent: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        });
      },
    });
    return { agent };
  });

  return { listAgents, createGlobalAgent } satisfies AgentDefinitionsShape;
});

export const AgentDefinitionsLive = Layer.effect(AgentDefinitions, makeAgentDefinitions);
