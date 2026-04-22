import { createFileRoute } from "@tanstack/react-router";

import { InstalledPluginsPanel } from "../components/customize/InstalledPluginsPanel";

export const Route = createFileRoute("/customize/installed")({
  component: InstalledPluginsPanel,
});
