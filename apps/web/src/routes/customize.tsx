import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { isElectron } from "../env";

function CustomizeContentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const titleForPath =
    location.pathname === "/customize/installed"
      ? "Installed plugins"
      : location.pathname === "/customize/agents"
        ? "Agents"
        : "Marketplaces";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        void navigate({ to: "/" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex min-h-7 items-center gap-2 sm:min-h-6">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">Customize</span>
              <span className="text-xs text-muted-foreground">/ {titleForPath}</span>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5 wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Customize
            </span>
            <span className="ms-2 text-xs text-muted-foreground/60">/ {titleForPath}</span>
          </div>
        )}

        <div className="min-h-0 flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/customize")({
  beforeLoad: async ({ context, location }) => {
    if (context.authGateState.status !== "authenticated") {
      throw redirect({ to: "/pair", replace: true });
    }

    if (location.pathname === "/customize") {
      throw redirect({ to: "/customize/marketplaces", replace: true });
    }
  },
  component: CustomizeContentLayout,
});
