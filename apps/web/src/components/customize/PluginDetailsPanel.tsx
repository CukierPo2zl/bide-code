import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import type { MarketplacePluginDetails } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { installPlugin, uninstallPlugin, usePluginDetails } from "../../hooks/usePlugins";

interface PluginDetailsPanelProps {
  marketplaceName: string;
  pluginName: string;
}

function sourceBadgeLabel(kind: MarketplacePluginDetails["sourceKind"]): string {
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

export function PluginDetailsPanel({ marketplaceName, pluginName }: PluginDetailsPanelProps) {
  const { details, loading, error, refresh } = usePluginDetails(marketplaceName, pluginName);
  const [busy, setBusy] = useState(false);

  const handleInstall = async () => {
    setBusy(true);
    const result = await installPlugin({ marketplaceName, pluginName });
    if (result.ok) {
      toastManager.add({
        type: "success",
        title: `Installed ${pluginName}`,
        description: `v${result.plugin.version}`,
      });
      await refresh();
    } else {
      toastManager.add({
        type: "error",
        title: "Install failed",
        description: result.detail ? `${result.message} — ${result.detail}` : result.message,
      });
    }
    setBusy(false);
  };

  const handleUninstall = async () => {
    setBusy(true);
    const result = await uninstallPlugin({ marketplaceName, pluginName });
    if (result.ok) {
      toastManager.add({ type: "success", title: `Uninstalled ${pluginName}` });
      await refresh();
    } else {
      toastManager.add({
        type: "error",
        title: "Uninstall failed",
        description: result.message,
      });
    }
    setBusy(false);
  };

  const unsupported =
    details?.sourceKind === "gitSubdir" || details?.sourceKind === "unknown";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to="/customize/marketplaces/$name"
              params={{ name: marketplaceName }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to marketplace"
            >
              <ArrowLeftIcon className="size-3.5" />
            </Link>
            <h2 className="truncate text-sm font-medium">{pluginName}</h2>
            {details ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {sourceBadgeLabel(details.sourceKind)}
              </span>
            ) : null}
            {details?.isInstalled ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                installed{details.installedVersion ? ` v${details.installedVersion}` : ""}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            from {marketplaceName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
          {details ? (
            details.isInstalled ? (
              <Button size="xs" variant="outline" disabled={busy} onClick={() => void handleUninstall()}>
                <Trash2Icon className="size-3.5" />
                Uninstall
              </Button>
            ) : (
              <Button
                size="xs"
                disabled={busy || unsupported}
                onClick={() => void handleInstall()}
                title={unsupported ? "This plugin's source type is not supported yet" : undefined}
              >
                <DownloadIcon className="size-3.5" />
                Install
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-xs text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-6 text-xs text-destructive">{error}</div>
        ) : !details ? (
          <div className="p-6 text-xs text-muted-foreground">Plugin not found.</div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {details.description ? (
              <section className="px-5 py-4">
                <p className="text-[13px] text-foreground/90">{details.description}</p>
              </section>
            ) : null}

            <section className="px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Metadata
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                {details.author ? (
                  <>
                    <dt className="text-muted-foreground">Author</dt>
                    <dd>{details.author}</dd>
                  </>
                ) : null}
                {details.category ? (
                  <>
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{details.category}</dd>
                  </>
                ) : null}
                {details.homepage ? (
                  <>
                    <dt className="text-muted-foreground">Homepage</dt>
                    <dd>
                      <a
                        href={details.homepage}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        {details.homepage}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Source</dt>
                <dd className="truncate font-mono text-[11px]">{details.sourceSummary}</dd>
                {details.manifestVersion ? (
                  <>
                    <dt className="text-muted-foreground">Version</dt>
                    <dd className="font-mono text-[11px]">{details.manifestVersion}</dd>
                  </>
                ) : null}
                {details.filesPath ? (
                  <>
                    <dt className="text-muted-foreground">Files</dt>
                    <dd className="truncate font-mono text-[11px]">{details.filesPath}</dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section className="px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Agents ({details.agents.length})
              </h3>
              {!details.filesPath ? (
                <p className="text-[12px] text-muted-foreground">
                  Install the plugin to see the agents it provides.
                </p>
              ) : details.agents.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  This plugin doesn't ship any agents.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {details.agents.map((agent) => (
                    <li key={agent.name} className="text-[12px]">
                      <div className="font-medium">{agent.name}</div>
                      {agent.description ? (
                        <div className="text-muted-foreground">{agent.description}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {details.commands.length > 0 ? (
              <section className="px-5 py-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Commands ({details.commands.length})
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {details.commands.map((cmd) => (
                    <li
                      key={cmd.name}
                      className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
                    >
                      /{cmd.name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {details.readme ? (
              <section className="px-5 py-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  README
                </h3>
                <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-3 text-[11px] leading-relaxed text-foreground/80">
                  {details.readme}
                </pre>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
