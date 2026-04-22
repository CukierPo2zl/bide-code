# T3 Code

T3 Code is a minimal web GUI for coding agents (currently Codex and Claude, more coming soon).

## Installation

> [!WARNING]
> T3 Code currently supports Codex and Claude.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://github.com/openai/codex) and run `codex login`
> - Claude: install Claude Code and run `claude auth login`

## Features

On top of vanilla T3 Code we've added two features:

### Workflow Templates

Workflow Templates let you define a reusable graph of agent steps and run them on demand. Each template is a set of nodes (start, agent, and artifact nodes) connected by edges, authored on a visual canvas.

How it works:

- **Author**: Open the Workflows tab, create a template, and drag nodes onto the canvas. An agent node is bound to a provider (Codex or Claude) and carries the prompt that will be sent when the step runs.
- **Wire**: Connect nodes with edges to describe the order of execution. Artifact nodes represent files or outputs that flow between steps.
- **Persist**: Templates are stored locally and can be edited, duplicated, or deleted at any time.
- **Run**: Trigger a template to spawn the configured agent sessions in sequence, passing artifacts along the edges.

### Marketplace

The Marketplace is where you discover and install plugins that extend T3 Code. A marketplace is a Git or GitHub repository that publishes a catalog of plugins; registering one makes its plugins browsable from the Customize tab.

How it works:

- **Register**: Add a marketplace by pointing at a `github:owner/repo` or a Git URL (optionally pinned to a ref). Registered marketplaces are shared with the Claude CLI.
- **Browse**: Open a marketplace to see its plugins, read descriptions, and inspect details before installing.
- **Install**: Install a plugin from its details page to make it available to your agents.
- **Manage**: Refresh a marketplace to pull the latest catalog, or remove it when you no longer need it.
