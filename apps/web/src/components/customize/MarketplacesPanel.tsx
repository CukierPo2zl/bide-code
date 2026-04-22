import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import type { Marketplace } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { removeMarketplace, useMarketplaces } from "../../hooks/usePlugins";
import { AddMarketplaceDialog } from "./AddMarketplaceDialog";

function sourceLabel(source: Marketplace["source"]): string {
  if (source.kind === "github") {
    return `github:${source.owner}/${source.repo}${source.ref ? `@${source.ref}` : ""}`;
  }
  return `git:${source.url}${source.ref ? `#${source.ref}` : ""}`;
}

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function MarketplacesPanel() {
  const { marketplaces, loading, refresh } = useMarketplaces();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const handleRemove = async (name: string) => {
    setPendingRemoval(name);
    const result = await removeMarketplace({ name });
    if (result.ok) {
      toastManager.add({ type: "success", title: `Removed "${name}"` });
      await refresh();
    } else {
      toastManager.add({ type: "error", title: "Remove failed", description: result.message });
    }
    setPendingRemoval(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-medium">Marketplaces</h2>
          <p className="text-xs text-muted-foreground">
            Registered plugin marketplaces. Shared with the Claude CLI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
          <Button size="xs" onClick={() => setAddOpen(true)}>
            <PlusIcon className="size-3.5" />
            Add marketplace
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-xs text-muted-foreground">Loading…</div>
        ) : marketplaces.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground">
            No marketplaces registered. Click{" "}
            <span className="font-medium">Add marketplace</span> to get started.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {marketplaces.map((mp) => (
              <li key={mp.name} className="flex items-stretch gap-2 px-1 py-0">
                <Link
                  to="/customize/marketplaces/$name"
                  params={{ name: mp.name }}
                  className="group flex min-w-0 flex-1 items-start gap-3 rounded px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{mp.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {mp.source.kind}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {sourceLabel(mp.source)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                      Updated {formatLastUpdated(mp.lastUpdated)} · {mp.installLocation}
                    </div>
                  </div>
                  <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                </Link>
                <Button
                  size="xs"
                  variant="ghost"
                  className="my-3 mr-3"
                  disabled={pendingRemoval === mp.name}
                  onClick={() => void handleRemove(mp.name)}
                  aria-label={`Remove ${mp.name}`}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddMarketplaceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => void refresh()}
      />
    </div>
  );
}
