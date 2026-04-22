import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/customize/marketplaces")({
  component: () => <Outlet />,
});
