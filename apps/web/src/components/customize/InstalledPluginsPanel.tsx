import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "../ui/button";
import { useInstalledPlugins } from "../../hooks/usePlugins";

export function InstalledPluginsPanel() {
  const { plugins, loading, refresh } = useInstalledPlugins();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-medium">Installed plugins</h2>
          <p className="text-xs text-muted-foreground">
            Plugins available to Claude. Shared with the Claude CLI.
          </p>
        </div>
        <Button size="xs" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCwIcon className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-xs text-muted-foreground">Loading…</div>
        ) : plugins.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">No plugins installed yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {plugins.map((plugin) => {
              const key = `${plugin.name}@${plugin.marketplaceName}`;
              const rowBody = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{plugin.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        v{plugin.version}
                      </span>
                      {plugin.marketplaceName ? (
                        <span className="text-[11px] text-muted-foreground">
                          from {plugin.marketplaceName}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {plugin.installPath}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <div>
                      {plugin.agentCount} agent{plugin.agentCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </>
              );
              if (plugin.marketplaceName) {
                return (
                  <li key={key} className="px-1 py-0">
                    <Link
                      to="/customize/marketplaces/$name/$plugin"
                      params={{ name: plugin.marketplaceName, plugin: plugin.name }}
                      className="group flex items-start gap-4 rounded px-4 py-3 hover:bg-muted/50"
                    >
                      {rowBody}
                      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={key} className="flex items-start justify-between gap-4 px-5 py-3">
                  {rowBody}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
