import { useCallback, useEffect, useState } from "react";
import type { AgentDefinition } from "@bide/contracts";
import { getPrimaryEnvironmentConnection } from "../environments/runtime";

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
