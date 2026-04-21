import type { AgentDefinition } from "@t3tools/contracts";

/**
 * Subagents that ship inside the Claude Code CLI itself.
 * They have no .md file on disk, so the filesystem scanner can't see them —
 * we surface them here so the workflow builder can drop them onto the canvas.
 */
export const BUILTIN_AGENTS: ReadonlyArray<AgentDefinition> = [
  {
    name: "general-purpose",
    fileName: "general-purpose",
    scope: "builtin",
    description:
      "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. Use when you need a flexible worker that has access to all tools.",
  },
  {
    name: "Explore",
    fileName: "Explore",
    scope: "builtin",
    description:
      "Fast agent specialized for exploring codebases — finding files by patterns, searching code for keywords, and answering questions about the codebase.",
  },
  {
    name: "Plan",
    fileName: "Plan",
    scope: "builtin",
    description:
      "Software architect agent for designing implementation plans. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. Use before starting non-trivial implementation work.",
  },
];
