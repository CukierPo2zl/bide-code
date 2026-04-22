import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import type { MarketplacePlugin } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import {
  installPlugin,
  uninstallPlugin,
  useMarketplacePlugins,
} from "../../hooks/usePlugins";

interface MarketplacePluginsPanelProps {
  marketplaceName: string;
}

function sourceBadgeLabel(kind: MarketplacePlugin["sourceKind"]): string {
  switch (kind) {
    case "inRepo":
      return "in-repo";
    case "externalGit":
      return "git";
    case "gitSubdir":
      return "git-subdir";
    default:
      return "unknown";
  }
}

export function MarketplacePluginsPanel({ marketplaceName }: MarketplacePluginsPanelProps) {
  const { plugins, loading, error, refresh } = useMarketplacePlugins(marketplaceName);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleInstall = async (plugin: MarketplacePlugin) => {
    const id = plugin.name;
    setPendingId(id);
    const result = await installPlugin({
      marketplaceName,
      pluginName: plugin.name,
    });
    if (result.ok) {
      toastManager.add({
        type: "success",
        title: `Installed ${plugin.name}`,
        description: `v${result.plugin.version} · ${result.plugin.agentCount} agent${
          result.plugin.agentCount === 1 ? "" : "s"
        }`,
      });
      await refresh();
    } else {
      toastManager.add({
        type: "error",
        title: "Install failed",
        description: result.detail ? `${result.message} — ${result.detail}` : result.message,
      });
    }
    setPendingId(null);
  };

  const handleUninstall = async (plugin: MarketplacePlugin) => {
    const id = plugin.name;
    setPendingId(id);
    const result = await uninstallPlugin({
      marketplaceName,
      pluginName: plugin.name,
    });
    if (result.ok) {
      toastManager.add({ type: "success", title: `Uninstalled ${plugin.name}` });
      await refresh();
    } else {
      toastManager.add({ type: "error", title: "Uninstall failed", description: result.message });
    }
    setPendingId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to="/customize/marketplaces"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to marketplaces"
            >
              <ArrowLeftIcon className="size-3.5" />
            </Link>
            <h2 className="truncate text-sm font-medium">{marketplaceName}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Plugins declared by this marketplace.
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
        ) : error ? (
          <div className="p-6 text-xs text-destructive">{error}</div>
        ) : plugins.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">
            This marketplace doesn't declare any plugins.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {plugins.map((plugin) => {
              const busy = pendingId === plugin.name;
              const unsupported = plugin.sourceKind === "gitSubdir" || plugin.sourceKind === "unknown";
              return (
                <li key={plugin.name} className="flex items-stretch gap-2 px-1 py-0">
                  <Link
                    to="/customize/marketplaces/$name/$plugin"
                    params={{ name: marketplaceName, plugin: plugin.name }}
                    className="group flex min-w-0 flex-1 items-start gap-3 rounded px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13px]">{plugin.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {sourceBadgeLabel(plugin.sourceKind)}
                        </span>
                        {plugin.isInstalled ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            installed{plugin.installedVersion ? ` v${plugin.installedVersion}` : ""}
                          </span>
                        ) : null}
                      </div>
                      {plugin.description ? (
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {plugin.description}
                        </div>
                      ) : null}
                      <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80">
                        {plugin.sourceSummary}
                      </div>
                      {plugin.author || plugin.category ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                          {plugin.author ? `by ${plugin.author}` : ""}
                          {plugin.author && plugin.category ? " · " : ""}
                          {plugin.category ?? ""}
                        </div>
                      ) : null}
                    </div>
                    <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                  </Link>
                  <div className="my-3 mr-3 flex shrink-0 items-center gap-2">
                    {plugin.isInstalled ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void handleUninstall(plugin)}
                        aria-label={`Uninstall ${plugin.name}`}
                      >
                        <Trash2Icon className="size-3.5" />
                        Uninstall
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        disabled={busy || unsupported}
                        onClick={() => void handleInstall(plugin)}
                        title={
                          unsupported
                            ? "This plugin's source type is not supported yet"
                            : undefined
                        }
                      >
                        <DownloadIcon className="size-3.5" />
                        Install
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
