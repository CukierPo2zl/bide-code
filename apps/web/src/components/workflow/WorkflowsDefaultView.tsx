import { PlusIcon, RouteIcon } from "lucide-react";
import { useWorkflowStore } from "~/workflowStore";
import { SidebarInset, SidebarTrigger } from "../ui/sidebar";

/**
 * Default screen shown in the main pane when the user is on the "workflows"
 * sidebar tab but has no workflow template selected yet.
 *
 * Mirrors the chrome (SidebarInset + SidebarTrigger) used by WorkflowCanvas
 * and AgentDetailView so the main pane stays visually consistent when the
 * user toggles the sidebar tabs.
 */
export function WorkflowsDefaultView() {
  const templates = useWorkflowStore((s) => s.templates);
  const createTemplate = useWorkflowStore((s) => s.createTemplate);

  const handleCreate = () => {
    createTemplate("Untitled Workflow");
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        <h1 className="text-sm font-medium">Workflows</h1>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {/*
          TODO(you): Design the empty-state content for the workflows landing
          screen. Consider:
          - What does a new user need to understand in 3 seconds?
          - Primary CTA (`handleCreate` wired above) vs. secondary links
            (docs, templates gallery)?
          - Should this change shape when `templates.length > 0` but none is
            selected — e.g. a "pick one from the sidebar" hint vs. the true
            first-run empty state?
          Keep it ~5-10 lines of JSX. The `RouteIcon`, `PlusIcon`, and
          `templates` count are available.
        */}
        <div className="flex flex-col items-center gap-3 text-center">
          <RouteIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {/* Replace with your copy */}
            Select a workflow from the sidebar or create a new one.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="size-3.5" />
            New Workflow
          </button>
        </div>
      </div>
    </SidebarInset>
  );
}
