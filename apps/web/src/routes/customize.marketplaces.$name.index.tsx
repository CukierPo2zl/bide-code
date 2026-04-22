import { createFileRoute } from "@tanstack/react-router";

import { MarketplacePluginsPanel } from "../components/customize/MarketplacePluginsPanel";

function MarketplacePluginsRoute() {
  const { name } = Route.useParams();
  return <MarketplacePluginsPanel marketplaceName={name} />;
}

export const Route = createFileRoute("/customize/marketplaces/$name/")({
  component: MarketplacePluginsRoute,
});
