import { ArchiveIcon, PlusIcon, SearchIcon } from "lucide-react";
import { shortcutLabelForCommand } from "~/keybindings";
import { useServerKeybindings } from "~/rpc/serverState";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useWorkflowStore } from "~/workflowStore";
import { resolveThreadRowClassName } from "../Sidebar.logic";
import { CommandDialogTrigger } from "../ui/command";
import { Kbd } from "../ui/kbd";
import {
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function WorkflowsSidebarPanel() {
  const templates = useWorkflowStore((s) => s.templates);
  const activeTemplateId = useWorkflowStore((s) => s.activeTemplateId);
  const createTemplate = useWorkflowStore((s) => s.createTemplate);
  const deleteTemplate = useWorkflowStore((s) => s.deleteTemplate);
  const setActiveTemplate = useWorkflowStore((s) => s.setActiveTemplate);
  const keybindings = useServerKeybindings();
  const commandPaletteShortcutLabel = shortcutLabelForCommand(
    keybindings,
    "commandPalette.toggle",
    {
      platform: typeof navigator !== "undefined" ? navigator.platform : "",
      context: { terminalFocus: false, terminalOpen: false },
    },
  );

  return (
    <SidebarContent className="gap-0">
      <SidebarGroup className="px-2 pt-2 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <CommandDialogTrigger
              render={
                <SidebarMenuButton
                  size="sm"
                  className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground focus-visible:ring-0"
                />
              }
            >
              <SearchIcon className="size-3.5" />
              <span className="flex-1 truncate text-left text-xs">Search</span>
              {commandPaletteShortcutLabel ? (
                <Kbd className="h-4 min-w-0 rounded-sm px-1.5 text-[10px]">
                  {commandPaletteShortcutLabel}
                </Kbd>
              ) : null}
            </CommandDialogTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="px-2 py-2">
        <div className="mb-1 flex items-center justify-between pl-2 pr-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Workflows
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="New workflow"
                    className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => createTemplate("Untitled Workflow")}
                  />
                }
              >
                <PlusIcon className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup side="right">New workflow</TooltipPopup>
            </Tooltip>
          </div>
        </div>

        <SidebarMenuSub className="mx-0 border-l-0 px-0">
          {templates.map((t) => {
            const isActive = activeTemplateId === t.id;
            return (
              <SidebarMenuSubItem key={t.id} className="w-full">
                <SidebarMenuSubButton
                  render={<div role="button" tabIndex={0} />}
                  size="sm"
                  isActive={isActive}
                  className={`${resolveThreadRowClassName({ isActive, isSelected: false })} relative isolate`}
                  onClick={() => setActiveTemplate(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveTemplate(t.id);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {t.name}
                          </span>
                        }
                      />
                      <TooltipPopup
                        side="top"
                        className="max-w-80 whitespace-normal leading-tight"
                      >
                        {t.name}
                      </TooltipPopup>
                    </Tooltip>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <div className="flex min-w-12 justify-end">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <div className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover/menu-sub-item:pointer-events-auto group-hover/menu-sub-item:opacity-100 group-focus-within/menu-sub-item:pointer-events-auto group-focus-within/menu-sub-item:opacity-100">
                              <button
                                type="button"
                                aria-label={`Delete ${t.name}`}
                                className="inline-flex size-5 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteTemplate(t.id);
                                }}
                              >
                                <ArchiveIcon className="size-3.5" />
                              </button>
                            </div>
                          }
                        />
                        <TooltipPopup side="top">Delete</TooltipPopup>
                      </Tooltip>
                      <span className="pointer-events-none transition-opacity duration-150 group-hover/menu-sub-item:opacity-0 group-focus-within/menu-sub-item:opacity-0">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`text-[10px] ${
                              isActive
                                ? "text-foreground/72 dark:text-foreground/82"
                                : "text-muted-foreground/40"
                            }`}
                          >
                            {formatRelativeTimeLabel(new Date(t.updatedAt).toISOString())}
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>

        {templates.length === 0 && (
          <div className="px-2 pt-4 text-center text-xs text-muted-foreground/60">
            No workflows yet
          </div>
        )}
      </SidebarGroup>
    </SidebarContent>
  );
}
