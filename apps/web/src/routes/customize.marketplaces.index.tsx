import { createFileRoute } from "@tanstack/react-router";

import { MarketplacesPanel } from "../components/customize/MarketplacesPanel";

export const Route = createFileRoute("/customize/marketplaces/")({
  component: MarketplacesPanel,
});
