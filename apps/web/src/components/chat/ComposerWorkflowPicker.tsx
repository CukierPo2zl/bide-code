import { WorkflowIcon } from "lucide-react";
import { useMemo } from "react";

import { useUiStateStore } from "~/uiStateStore";
import { useWorkflowStore } from "~/workflowStore";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";

const NONE_VALUE = "__none__";

export function ComposerWorkflowPicker({ threadKey }: { threadKey: string }) {
  const templates = useWorkflowStore((s) => s.templates);
  const selectedId = useUiStateStore((s) => s.workflowTemplateIdByThreadId[threadKey] ?? null);
  const setThreadWorkflowTemplate = useUiStateStore((s) => s.setThreadWorkflowTemplate);

  const selectedTemplate = useMemo(
    () => (selectedId ? templates.find((t) => t.id === selectedId) ?? null : null),
    [templates, selectedId],
  );

  const value = selectedId ?? NONE_VALUE;

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const nextId = typeof next === "string" && next !== NONE_VALUE ? next : null;
        setThreadWorkflowTemplate(threadKey, nextId);
      }}
    >
      <SelectTrigger
        variant="ghost"
        size="xs"
        className="font-medium"
        aria-label="Select workflow for thread"
      >
        <WorkflowIcon className="size-3" />
        <SelectValue>
          {`Workflow: ${selectedTemplate ? selectedTemplate.name : "none"}`}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false}>
        <SelectItem value={NONE_VALUE}>
          <span>None</span>
        </SelectItem>
        {templates.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            <span className="truncate">{template.name}</span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
