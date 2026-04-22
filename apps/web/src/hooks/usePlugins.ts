import { useCallback, useEffect, useState } from "react";
import type {
  AddMarketplaceInput,
  InstallPluginInput,
  InstalledPlugin,
  Marketplace,
  MarketplacePlugin,
  MarketplacePluginDetails,
  RemoveMarketplaceInput,
  UninstallPluginInput,
} from "@t3tools/contracts";
import { getPrimaryEnvironmentConnection } from "../environments/runtime";

export function useMarketplaces() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const client = getPrimaryEnvironmentConnection().client;
      const result = await client.plugins.listMarketplaces({});
      setMarketplaces([...result.marketplaces]);
    } catch (error) {
      console.error("[useMarketplaces] Failed to load marketplaces:", error);
      setMarketplaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { marketplaces, loading, refresh };
}

export function useInstalledPlugins() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const client = getPrimaryEnvironmentConnection().client;
      const result = await client.plugins.listInstalled({});
      setPlugins([...result.plugins]);
    } catch (error) {
      console.error("[useInstalledPlugins] Failed to load plugins:", error);
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plugins, loading, refresh };
}

export async function addMarketplace(
  input: AddMarketplaceInput,
): Promise<{ ok: true; marketplace: Marketplace } | { ok: false; message: string; detail?: string }> {
  try {
    const client = getPrimaryEnvironmentConnection().client;
    const result = await client.plugins.addMarketplace(input);
    return { ok: true, marketplace: result.marketplace };
  } catch (error) {
    const err = error as { message?: string; detail?: string };
    return {
      ok: false,
      message: err?.message ?? "Failed to add marketplace",
      ...(err?.detail !== undefined && { detail: err.detail }),
    };
  }
}

export async function removeMarketplace(
  input: RemoveMarketplaceInput,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  try {
    const client = getPrimaryEnvironmentConnection().client;
    const result = await client.plugins.removeMarketplace(input);
    return { ok: true, name: result.name };
  } catch (error) {
    const err = error as { message?: string };
    return { ok: false, message: err?.message ?? "Failed to remove marketplace" };
  }
}

export function usePluginDetails(
  marketplaceName: string | undefined,
  pluginName: string | undefined,
) {
  const [details, setDetails] = useState<MarketplacePluginDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!marketplaceName || !pluginName) {
      setDetails(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = getPrimaryEnvironmentConnection().client;
      const result = await client.plugins.getPluginDetails({
        marketplaceName,
        pluginName,
      });
      setDetails(result.plugin);
    } catch (e) {
      const err = e as { message?: string };
      console.error("[usePluginDetails] Failed:", e);
      setError(err?.message ?? "Failed to load plugin details");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [marketplaceName, pluginName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { details, loading, error, refresh };
}

export function useMarketplacePlugins(marketplaceName: string | undefined) {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!marketplaceName) {
      setPlugins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = getPrimaryEnvironmentConnection().client;
      const result = await client.plugins.listMarketplacePlugins({ marketplaceName });
      setPlugins([...result.plugins]);
    } catch (e) {
      const err = e as { message?: string };
      console.error("[useMarketplacePlugins] Failed:", e);
      setError(err?.message ?? "Failed to load plugins");
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, [marketplaceName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plugins, loading, error, refresh };
}

export async function installPlugin(
  input: InstallPluginInput,
): Promise<
  | { ok: true; plugin: InstalledPlugin }
  | { ok: false; message: string; detail?: string }
> {
  try {
    const client = getPrimaryEnvironmentConnection().client;
    const result = await client.plugins.installPlugin(input);
    return { ok: true, plugin: result.plugin };
  } catch (error) {
    const err = error as { message?: string; detail?: string };
    return {
      ok: false,
      message: err?.message ?? "Failed to install plugin",
      ...(err?.detail !== undefined && { detail: err.detail }),
    };
  }
}

export async function uninstallPlugin(
  input: UninstallPluginInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const client = getPrimaryEnvironmentConnection().client;
    await client.plugins.uninstallPlugin(input);
    return { ok: true };
  } catch (error) {
    const err = error as { message?: string };
    return { ok: false, message: err?.message ?? "Failed to uninstall plugin" };
  }
}
