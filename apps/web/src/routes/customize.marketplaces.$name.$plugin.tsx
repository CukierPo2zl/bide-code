import { createFileRoute } from "@tanstack/react-router";

import { PluginDetailsPanel } from "../components/customize/PluginDetailsPanel";

function PluginDetailsRoute() {
  const { name, plugin } = Route.useParams();
  return <PluginDetailsPanel marketplaceName={name} pluginName={plugin} />;
}

export const Route = createFileRoute("/customize/marketplaces/$name/$plugin")({
  component: PluginDetailsRoute,
});
