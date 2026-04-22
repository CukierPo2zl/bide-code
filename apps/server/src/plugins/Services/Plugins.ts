import { Context } from "effect";
import type { Effect } from "effect";

import type {
  AddMarketplaceInput,
  AddMarketplaceResult,
  GetPluginDetailsInput,
  GetPluginDetailsResult,
  InstallPluginInput,
  InstallPluginResult,
  ListInstalledPluginsInput,
  ListInstalledPluginsResult,
  ListMarketplacePluginsInput,
  ListMarketplacePluginsResult,
  ListMarketplacesInput,
  ListMarketplacesResult,
  PluginsServiceError,
  RemoveMarketplaceInput,
  RemoveMarketplaceResult,
  UninstallPluginInput,
  UninstallPluginResult,
} from "@t3tools/contracts";

export interface PluginsShape {
  readonly listMarketplaces: (
    input: ListMarketplacesInput,
  ) => Effect.Effect<ListMarketplacesResult, PluginsServiceError>;
  readonly addMarketplace: (
    input: AddMarketplaceInput,
  ) => Effect.Effect<AddMarketplaceResult, PluginsServiceError>;
  readonly removeMarketplace: (
    input: RemoveMarketplaceInput,
  ) => Effect.Effect<RemoveMarketplaceResult, PluginsServiceError>;
  readonly listInstalled: (
    input: ListInstalledPluginsInput,
  ) => Effect.Effect<ListInstalledPluginsResult, PluginsServiceError>;
  readonly listMarketplacePlugins: (
    input: ListMarketplacePluginsInput,
  ) => Effect.Effect<ListMarketplacePluginsResult, PluginsServiceError>;
  readonly getPluginDetails: (
    input: GetPluginDetailsInput,
  ) => Effect.Effect<GetPluginDetailsResult, PluginsServiceError>;
  readonly installPlugin: (
    input: InstallPluginInput,
  ) => Effect.Effect<InstallPluginResult, PluginsServiceError>;
  readonly uninstallPlugin: (
    input: UninstallPluginInput,
  ) => Effect.Effect<UninstallPluginResult, PluginsServiceError>;
}

export class Plugins extends Context.Service<Plugins, PluginsShape>()(
  "t3/plugins/Services/Plugins",
) {}
