import { createFileRoute } from "@tanstack/react-router";

import { AgentsPanel } from "../components/customize/AgentsPanel";

export const Route = createFileRoute("/customize/agents")({
  component: AgentsPanel,
});
