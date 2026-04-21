import { LayoutListIcon, RouteIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { type SidebarTab, useUiStateStore } from "../../uiStateStore";

const tabs: readonly { key: SidebarTab; label: string; icon: typeof LayoutListIcon }[] = [
  { key: "threads", label: "Threads", icon: LayoutListIcon },
  { key: "workflows", label: "Workflows", icon: RouteIcon },
];

export function SidebarTabBar() {
  const sidebarTab = useUiStateStore((s) => s.sidebarTab);
  const setSidebarTab = useUiStateStore((s) => s.setSidebarTab);

  return (
    <div className="shrink-0 px-3 pt-2 pb-1">
      <div className="flex items-center gap-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSidebarTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              sidebarTab === key
                ? "bg-accent/15 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
            )}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
