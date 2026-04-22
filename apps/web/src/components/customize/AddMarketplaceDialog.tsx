import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toastManager } from "../ui/toast";
import { addMarketplace } from "../../hooks/usePlugins";

interface AddMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddMarketplaceDialog({ open, onOpenChange, onAdded }: AddMarketplaceDialogProps) {
  const [sourceInput, setSourceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  const reset = () => {
    setSourceInput("");
    setBusy(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = sourceInput.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const result = await addMarketplace({ sourceInput: trimmed });
    if (result.ok) {
      toastManager.add({
        type: "success",
        title: "Marketplace added",
        description: `Registered "${result.marketplace.name}".`,
      });
      onAdded();
      reset();
      onOpenChange(false);
      return;
    }
    setError({ message: result.message, ...(result.detail !== undefined && { detail: result.detail }) });
    setBusy(false);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(92vw,520px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <DialogPrimitive.Title className="font-heading font-semibold text-lg leading-tight">
                  Add marketplace
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                  Register a plugin marketplace. It will be cloned to{" "}
                  <code className="font-mono text-[11px]">~/.claude/plugins/marketplaces/</code>{" "}
                  and also usable from the <code className="font-mono text-[11px]">claude</code>{" "}
                  CLI.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                render={<Button size="icon" variant="ghost" type="button" />}
              >
                <XIcon />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-5">
              <Label htmlFor="marketplace-source">Source</Label>
              <Input
                id="marketplace-source"
                autoFocus
                disabled={busy}
                placeholder="owner/repo  or  https://host/path.git"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Accepted: <code className="font-mono">owner/repo</code>,{" "}
                <code className="font-mono">owner/repo@ref</code>,{" "}
                <code className="font-mono">https://…​.git</code>,{" "}
                <code className="font-mono">git@host:…​.git</code> (optionally{" "}
                <code className="font-mono">#ref</code>).
              </p>
              {error ? (
                <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <div className="font-medium">{error.message}</div>
                  {error.detail ? (
                    <div className="mt-0.5 text-[11px] opacity-80">{error.detail}</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !sourceInput.trim()}>
                {busy ? "Adding…" : "Add marketplace"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
