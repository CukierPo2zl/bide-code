import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const MarketplaceSourceGithub = Schema.Struct({
  kind: Schema.Literal("github"),
  owner: TrimmedNonEmptyString,
  repo: TrimmedNonEmptyString,
  ref: Schema.optional(Schema.String),
});
export type MarketplaceSourceGithub = typeof MarketplaceSourceGithub.Type;

export const MarketplaceSourceGit = Schema.Struct({
  kind: Schema.Literal("git"),
  url: TrimmedNonEmptyString,
  ref: Schema.optional(Schema.String),
});
export type MarketplaceSourceGit = typeof MarketplaceSourceGit.Type;

export const MarketplaceSource = Schema.Union([MarketplaceSourceGithub, MarketplaceSourceGit]);
export type MarketplaceSource = typeof MarketplaceSource.Type;

export const Marketplace = Schema.Struct({
  name: TrimmedNonEmptyString,
  source: MarketplaceSource,
  installLocation: Schema.String,
  lastUpdated: Schema.NullOr(Schema.String),
});
export type Marketplace = typeof Marketplace.Type;

export const InstalledPlugin = Schema.Struct({
  name: TrimmedNonEmptyString,
  marketplaceName: Schema.String,
  version: Schema.String,
  installPath: Schema.String,
  agentCount: Schema.Number,
});
export type InstalledPlugin = typeof InstalledPlugin.Type;

/**
 * Classification of a plugin's source as declared in the marketplace's
 * `marketplace.json`. Computed server-side from the raw JSON, which can be
 * either a string (in-repo path) or a tagged object.
 */
export const PluginSourceKind = Schema.Literals(["inRepo", "externalGit", "gitSubdir", "unknown"]);
export type PluginSourceKind = typeof PluginSourceKind.Type;

export const MarketplacePlugin = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  homepage: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  sourceKind: PluginSourceKind,
  /** Human-readable source hint for the UI (e.g. "./plugins/foo", "github.com/…"). */
  sourceSummary: Schema.String,
  /** True if this plugin currently appears in installed_plugins.json. */
  isInstalled: Schema.Boolean,
  /** Only present when `isInstalled`. */
  installedVersion: Schema.optional(Schema.String),
});
export type MarketplacePlugin = typeof MarketplacePlugin.Type;

export const PluginAgentSummary = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(Schema.String),
});
export type PluginAgentSummary = typeof PluginAgentSummary.Type;

export const PluginCommandSummary = Schema.Struct({
  name: TrimmedNonEmptyString,
});
export type PluginCommandSummary = typeof PluginCommandSummary.Type;

/**
 * Richer view of a single plugin. Includes everything in `MarketplacePlugin`
 * plus file-derived data (agents, commands, readme, installPath) — which is
 * only populated when we can access the plugin's files on disk: either the
 * plugin is installed, or its `sourceKind` is `inRepo` (so the files live
 * inside the marketplace we already have cloned locally).
 */
export const MarketplacePluginDetails = Schema.Struct({
  ...MarketplacePlugin.fields,
  marketplaceName: Schema.String,
  /** Directory where the plugin files are readable (if any). */
  filesPath: Schema.optional(Schema.String),
  /** Version from the plugin's own `.claude-plugin/plugin.json`, if found. */
  manifestVersion: Schema.optional(Schema.String),
  /** Agents shipped by the plugin (from `<filesPath>/agents/*.md`). */
  agents: Schema.Array(PluginAgentSummary),
  /** Commands shipped by the plugin (from `<filesPath>/commands/*.md`). */
  commands: Schema.Array(PluginCommandSummary),
  /** First ~4 KB of README.md, if present. */
  readme: Schema.optional(Schema.String),
});
export type MarketplacePluginDetails = typeof MarketplacePluginDetails.Type;

export const GetPluginDetailsInput = Schema.Struct({
  marketplaceName: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
});
export type GetPluginDetailsInput = typeof GetPluginDetailsInput.Type;

export const GetPluginDetailsResult = Schema.Struct({
  plugin: MarketplacePluginDetails,
});
export type GetPluginDetailsResult = typeof GetPluginDetailsResult.Type;

export const ListMarketplacesInput = Schema.Struct({});
export type ListMarketplacesInput = typeof ListMarketplacesInput.Type;

export const ListMarketplacesResult = Schema.Struct({
  marketplaces: Schema.Array(Marketplace),
});
export type ListMarketplacesResult = typeof ListMarketplacesResult.Type;

export const AddMarketplaceInput = Schema.Struct({
  sourceInput: TrimmedNonEmptyString,
});
export type AddMarketplaceInput = typeof AddMarketplaceInput.Type;

export const AddMarketplaceResult = Schema.Struct({
  marketplace: Marketplace,
});
export type AddMarketplaceResult = typeof AddMarketplaceResult.Type;

export const RemoveMarketplaceInput = Schema.Struct({
  name: TrimmedNonEmptyString,
});
export type RemoveMarketplaceInput = typeof RemoveMarketplaceInput.Type;

export const RemoveMarketplaceResult = Schema.Struct({
  name: Schema.String,
});
export type RemoveMarketplaceResult = typeof RemoveMarketplaceResult.Type;

export const ListInstalledPluginsInput = Schema.Struct({});
export type ListInstalledPluginsInput = typeof ListInstalledPluginsInput.Type;

export const ListInstalledPluginsResult = Schema.Struct({
  plugins: Schema.Array(InstalledPlugin),
});
export type ListInstalledPluginsResult = typeof ListInstalledPluginsResult.Type;

export const ListMarketplacePluginsInput = Schema.Struct({
  marketplaceName: TrimmedNonEmptyString,
});
export type ListMarketplacePluginsInput = typeof ListMarketplacePluginsInput.Type;

export const ListMarketplacePluginsResult = Schema.Struct({
  marketplaceName: Schema.String,
  plugins: Schema.Array(MarketplacePlugin),
});
export type ListMarketplacePluginsResult = typeof ListMarketplacePluginsResult.Type;

export const InstallPluginInput = Schema.Struct({
  marketplaceName: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
});
export type InstallPluginInput = typeof InstallPluginInput.Type;

export const InstallPluginResult = Schema.Struct({
  plugin: InstalledPlugin,
});
export type InstallPluginResult = typeof InstallPluginResult.Type;

export const UninstallPluginInput = Schema.Struct({
  marketplaceName: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
});
export type UninstallPluginInput = typeof UninstallPluginInput.Type;

export const UninstallPluginResult = Schema.Struct({
  marketplaceName: Schema.String,
  pluginName: Schema.String,
});
export type UninstallPluginResult = typeof UninstallPluginResult.Type;

export const PluginsErrorKind = Schema.Literals([
  "parse",
  "clone",
  "manifest",
  "validate",
  "collision",
  "notFound",
  "io",
  "unsupported",
  "alreadyInstalled",
]);
export type PluginsErrorKind = typeof PluginsErrorKind.Type;

export class PluginsServiceError extends Schema.TaggedErrorClass<PluginsServiceError>()(
  "PluginsServiceError",
  {
    kind: PluginsErrorKind,
    message: TrimmedNonEmptyString,
    detail: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Defect),
  },
) {}
