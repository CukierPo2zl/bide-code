import { useCallback, useEffect, useState } from "react";
import type { AgentDefinition, CreateGlobalAgentInput } from "@t3tools/contracts";
import { getPrimaryEnvironmentConnection } from "../environments/runtime";

export async function createGlobalAgent(
  input: CreateGlobalAgentInput,
): Promise<
  | { ok: true; agent: AgentDefinition }
  | { ok: false; message: string; kind?: "validation" | "collision" | "io" }
> {
  try {
    const client = getPrimaryEnvironmentConnection().client;
    const result = await client.agents.createGlobalAgent(input);
    return { ok: true, agent: result.agent };
  } catch (error) {
    const err = error as { message?: string; kind?: "validation" | "collision" | "io" };
    return {
      ok: false,
      message: err?.message ?? "Failed to create agent",
      ...(err?.kind !== undefined && { kind: err.kind }),
    };
  }
}

export function useAgentDefinitions() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const client = getPrimaryEnvironmentConnection().client;
      const result = await client.agents.listAgents({});
      setAgents([...result.agents]);
    } catch (error) {
      console.error("[useAgentDefinitions] Failed to load agents:", error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, loading, refresh };
}
