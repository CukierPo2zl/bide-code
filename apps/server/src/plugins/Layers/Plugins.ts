import * as OS from "node:os";
import fsPromises from "node:fs/promises";
import nodePath from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import { Effect, Layer } from "effect";

import type {
  InstalledPlugin,
  Marketplace,
  MarketplacePlugin,
  MarketplacePluginDetails,
  MarketplaceSource,
  PluginAgentSummary,
  PluginCommandSummary,
  PluginSourceKind,
} from "@t3tools/contracts";
import { PluginsServiceError } from "@t3tools/contracts";

import { Plugins, type PluginsShape } from "../Services/Plugins.ts";

// ---------------------------------------------------------------------------
// On-disk file shapes (what the Claude CLI actually writes)
// ---------------------------------------------------------------------------

/**
 * Shape of each entry in `~/.claude/plugins/known_marketplaces.json`.
 * Discriminator is `source.source` — a string tag, not a `kind`.
 * The github variant stores `owner/repo` as a single combined string.
 */
interface OnDiskMarketplaceEntry {
  source:
    | { source: "github"; repo: string; ref?: string }
    | { source: "git"; url: string; ref?: string };
  installLocation: string;
  lastUpdated: string | null;
}

type OnDiskKnownMarketplaces = Record<string, OnDiskMarketplaceEntry>;

interface OnDiskInstalledPluginsFile {
  version: number;
  plugins: Record<
    string,
    Array<{
      scope: string;
      installPath: string;
      version: string;
      installedAt?: string;
      lastUpdated?: string;
      gitCommitSha?: string;
    }>
  >;
}

interface OnDiskMarketplaceManifest {
  name?: string;
  owner?: { name?: string; email?: string };
  plugins?: Array<OnDiskMarketplacePluginEntry>;
}

/**
 * Raw plugin entry inside `marketplace.json` — the `source` field is
 * polymorphic (bare string OR tagged object) so we leave it as `unknown`
 * and let `resolvePluginFetchStrategy` normalize it.
 */
interface OnDiskMarketplacePluginEntry {
  name?: string;
  description?: string;
  category?: string;
  homepage?: string;
  author?: string | { name?: string; email?: string };
  source?: unknown;
}

/**
 * A typed description of how to fetch a plugin's files. Produced by
 * `resolvePluginFetchStrategy` from the raw `source` field.
 */
type PluginFetchStrategy =
  | { kind: "inRepo"; relativePath: string }
  | { kind: "externalGit"; url: string; sha?: string; ref?: string }
  | { kind: "gitSubdir"; url: string; subdir: string; sha?: string; ref?: string };

interface PluginJson {
  version?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const claudePluginsDir = nodePath.join(OS.homedir(), ".claude", "plugins");
const knownMarketplacesPath = nodePath.join(claudePluginsDir, "known_marketplaces.json");
const installedPluginsPath = nodePath.join(claudePluginsDir, "installed_plugins.json");
const marketplacesDir = nodePath.join(claudePluginsDir, "marketplaces");
const cacheDir = nodePath.join(claudePluginsDir, "cache");

// ---------------------------------------------------------------------------
// Boundary translators — on-disk format <-> contract format
// ---------------------------------------------------------------------------

function onDiskToContractSource(
  onDisk: OnDiskMarketplaceEntry["source"],
): MarketplaceSource | null {
  if (onDisk.source === "github") {
    const [owner, repo] = onDisk.repo.split("/");
    if (!owner || !repo) return null;
    return {
      kind: "github",
      owner,
      repo,
      ...(onDisk.ref !== undefined && { ref: onDisk.ref }),
    };
  }
  return {
    kind: "git",
    url: onDisk.url,
    ...(onDisk.ref !== undefined && { ref: onDisk.ref }),
  };
}

function contractToOnDiskSource(source: MarketplaceSource): OnDiskMarketplaceEntry["source"] {
  if (source.kind === "github") {
    return {
      source: "github",
      repo: `${source.owner}/${source.repo}`,
      ...(source.ref !== undefined && { ref: source.ref }),
    };
  }
  return {
    source: "git",
    url: source.url,
    ...(source.ref !== undefined && { ref: source.ref }),
  };
}

function sourceToCloneUrl(source: MarketplaceSource): string {
  if (source.kind === "github") {
    return `https://github.com/${source.owner}/${source.repo}.git`;
  }
  return source.url;
}

// ---------------------------------------------------------------------------
// User contributions — stubbed out for learning-mode implementation
// ---------------------------------------------------------------------------

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * TODO(user): Parse a user-provided marketplace source string.
 *
 * Accepted inputs (v1):
 *   - GitHub shorthand:     "owner/repo"          or "owner/repo@ref"
 *   - HTTPS git URL:        "https://host/x.git"  or with "#ref" suffix
 *   - SSH git URL:          "git@host:x/y.git"    or with "#ref" suffix
 *
 * Return the parsed discriminated union from @t3tools/contracts, or a string
 * describing why the input is invalid (shown to the user inline in the dialog).
 *
 * Suggested approach:
 *   1. Try the GitHub shorthand regex first — it's the simplest & most common case.
 *      Pattern: /^([a-z0-9][a-z0-9\-._]*)\/([a-z0-9][a-z0-9\-._]*)(?:@(.+))?$/i
 *   2. Otherwise, check for a git-like URL: must end in `.git` (with optional #ref).
 *      Pattern: /^(?:https?:\/\/|git@).+\.git(?:#(.+))?$/
 *   3. If neither matches, return an error.
 *
 * Trade-offs to think about:
 *   - Should "owner/repo" without a dot be treated as GitHub, or rejected?
 *     (claude CLI treats it as GitHub — we match that.)
 *   - Do we want to support bare `owner/repo.git`? The CLI doesn't — keep it simple.
 *   - Leading/trailing whitespace: the schema already trims, so you don't need to.
 */
function parseMarketplaceSource(input: string): Result<MarketplaceSource, string> {
  const trimmed = input.trim();
  const githubMatch = trimmed.match(
    /^([a-z0-9][a-z0-9\-._]*)\/([a-z0-9][a-z0-9\-._]*)(?:@(.+))?$/i,
  );
  if (githubMatch) {
    const [, owner, repo, ref] = githubMatch;
    return {
      ok: true,
      value: {
        kind: "github",
        owner: owner!,
        repo: repo!,
        ...(ref !== undefined && { ref }),
      },
    };
  }
  const gitMatch = trimmed.match(/^((?:https?:\/\/|git@).+\.git)(?:#(.+))?$/);
  if (gitMatch) {
    const [, url, ref] = gitMatch;
    return {
      ok: true,
      value: {
        kind: "git",
        url: url!,
        ...(ref !== undefined && { ref }),
      },
    };
  }
  return {
    ok: false,
    error: `Expected "owner/repo", "owner/repo@ref", or a git URL ending in .git (got: "${input}")`,
  };
}

/**
 * TODO(user): Validate a marketplace name against Claude Code's naming rules.
 *
 * The name is read from `<clone-root>/.claude-plugin/marketplace.json` after
 * cloning. Per https://code.claude.com/docs/en/plugin-marketplaces:
 *
 *   - Must be kebab-case: lowercase letters, digits, single hyphens between groups.
 *     Pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/
 *   - Must NOT start with "official-" or "anthropic-" (impersonation guard).
 *   - Must NOT be one of the reserved official names:
 *       "claude-code-marketplace", "claude-code-plugins",
 *       "claude-plugins-official", "anthropic-marketplace",
 *       "anthropic-plugins", "agent-skills",
 *       "knowledge-work-plugins", "life-sciences"
 *
 * Return `{ ok: true, value: undefined }` on success, or `{ ok: false, error }`
 * with a user-facing message explaining which rule was violated.
 *
 * Why this matters: the user will see your error text verbatim in the Add dialog,
 * so make it actionable — e.g. "Name must be kebab-case (got: 'Foo_Bar')", not
 * just "invalid".
 */
function validateMarketplaceName(name: string): Result<void, string> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return { ok: false, error: `Name must be kebab-case (got: "${name}")` };
  }
  if (/^(official-|anthropic-)/.test(name)) {
    return {
      ok: false,
      error: `Name cannot start with "official-" or "anthropic-" (got: "${name}")`,
    };
  }
  const reserved = new Set([
    "claude-code-marketplace",
    "claude-code-plugins",
    "claude-plugins-official",
    "anthropic-marketplace",
    "anthropic-plugins",
    "agent-skills",
    "knowledge-work-plugins",
    "life-sciences",
  ]);
  if (reserved.has(name)) {
    return { ok: false, error: `"${name}" is reserved for official marketplaces` };
  }
  return { ok: true, value: undefined };
}

/**
 * TODO(user): Normalize a plugin's `source` field into a typed fetch strategy.
 *
 * The `source` field in `marketplace.json` has three observed shapes:
 *
 *   A. A bare string like `"./plugins/agent-sdk-dev"` — the plugin's files live
 *      in a subdirectory of the cloned marketplace repo itself. Fastest path.
 *   B. An object with `source: "url"` — an independent git repo, clone it:
 *        { source: "url", url: "https://…​.git", sha?: "abc…" }
 *   C. An object with `source: "git-subdir"` — a subdirectory of another repo,
 *      requires sparse-checkout:
 *        { source: "git-subdir", url: "…​", path: "…​", ref?: "…​", sha?: "…​" }
 *
 * Return one of the three discriminated strategies below, or an error string.
 *
 * Suggested approach:
 *   1. If `typeof source === "string"`, treat it as shape A. Reject anything
 *      with `..` in the path — you'd be letting a malicious marketplace escape
 *      its own directory.
 *   2. If it's an object with `source === "url"`, read `url` + optional `sha`
 *      + optional `ref`. Fail if `url` is missing.
 *   3. If it's an object with `source === "git-subdir"`, read `url`, `path`,
 *      optional `ref`, optional `sha`. Fail if any required field is missing.
 *   4. Anything else → error. Include the raw shape in the message so the user
 *      can see what's going on (e.g. `JSON.stringify(source)` capped at 80 chars).
 *
 * Trade-offs to consider:
 *   - For the string form, `marketplace.json` files use both `"./plugins/foo"`
 *     and `"plugins/foo"` — should you normalize, reject one form, or accept
 *     both? (The Claude CLI accepts both.)
 *   - For `ref` on the externalGit shape, should `sha` imply `ref` too?
 *     Usually the caller pins with `sha` and skips `ref` — keep them independent.
 *
 * Why this matters: this is the *only* place where a hostile marketplace's
 * JSON can smuggle in something weird. The rest of the server trusts the
 * typed result. Path traversal here means cloning to (or copying from) a
 * directory outside the cache. Guard it.
 */
function resolvePluginFetchStrategy(
  source: unknown,
): Result<PluginFetchStrategy, string> {
  if (typeof source === "string") {
    const normalized = source.replace(/^\.\//, "").trim();
    if (!normalized) return { ok: false, error: "Empty source path" };
    if (normalized.startsWith("/") || nodePath.isAbsolute(normalized)) {
      return { ok: false, error: `Absolute paths not allowed: ${source}` };
    }
    const segments = normalized.split(/[\\/]/);
    if (segments.some((s) => s === "..")) {
      return { ok: false, error: `Path escapes marketplace dir: ${source}` };
    }
    return { ok: true, value: { kind: "inRepo", relativePath: normalized } };
  }

  if (!source || typeof source !== "object") {
    return { ok: false, error: `Unsupported source: ${rawSourceSummary(source)}` };
  }

  const o = source as Record<string, unknown>;
  const tag = o["source"];
  const url = typeof o["url"] === "string" ? (o["url"] as string) : undefined;
  const sha = typeof o["sha"] === "string" ? (o["sha"] as string) : undefined;
  const ref = typeof o["ref"] === "string" ? (o["ref"] as string) : undefined;

  if (tag === "url") {
    if (!url) return { ok: false, error: "git url source missing `url` field" };
    return {
      ok: true,
      value: {
        kind: "externalGit",
        url,
        ...(sha !== undefined && { sha }),
        ...(ref !== undefined && { ref }),
      },
    };
  }

  if (tag === "git-subdir") {
    const path = typeof o["path"] === "string" ? (o["path"] as string) : undefined;
    if (!url) return { ok: false, error: "git-subdir source missing `url` field" };
    if (!path) return { ok: false, error: "git-subdir source missing `path` field" };
    return {
      ok: true,
      value: {
        kind: "gitSubdir",
        url,
        subdir: path,
        ...(sha !== undefined && { sha }),
        ...(ref !== undefined && { ref }),
      },
    };
  }

  return { ok: false, error: `Unknown source tag: ${rawSourceSummary(source)}` };
}

function fetchStrategyToSummary(strategy: PluginFetchStrategy): string {
  if (strategy.kind === "inRepo") return strategy.relativePath;
  if (strategy.kind === "externalGit") {
    return strategy.url.replace(/^https:\/\//, "").replace(/\.git$/, "");
  }
  return `${strategy.url.replace(/^https:\/\//, "").replace(/\.git$/, "")}:${strategy.subdir}`;
}

function fetchStrategyToKind(strategy: PluginFetchStrategy): PluginSourceKind {
  return strategy.kind;
}

/**
 * Summary for the UI when the raw source couldn't be resolved — we still want
 * to render the plugin row (greyed out, "unknown source") rather than hiding
 * it outright, so users can see what the marketplace declared.
 */
function rawSourceSummary(source: unknown): string {
  if (typeof source === "string") return source;
  try {
    const s = JSON.stringify(source);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return "(unserializable)";
  }
}

// ---------------------------------------------------------------------------
// Disk helpers
// ---------------------------------------------------------------------------

async function readKnownMarketplaces(): Promise<OnDiskKnownMarketplaces> {
  try {
    const raw = await fsPromises.readFile(knownMarketplacesPath, "utf-8");
    return JSON.parse(raw) as OnDiskKnownMarketplaces;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeKnownMarketplaces(data: OnDiskKnownMarketplaces): Promise<void> {
  await fsPromises.mkdir(claudePluginsDir, { recursive: true });
  await fsPromises.writeFile(knownMarketplacesPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function readInstalledPlugins(): Promise<OnDiskInstalledPluginsFile> {
  try {
    const raw = await fsPromises.readFile(installedPluginsPath, "utf-8");
    return JSON.parse(raw) as OnDiskInstalledPluginsFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 2, plugins: {} };
    }
    throw err;
  }
}

async function writeInstalledPlugins(data: OnDiskInstalledPluginsFile): Promise<void> {
  await fsPromises.mkdir(claudePluginsDir, { recursive: true });
  await fsPromises.writeFile(
    installedPluginsPath,
    JSON.stringify(data, null, 2) + "\n",
    "utf-8",
  );
}

async function readPluginJson(installPath: string): Promise<PluginJson | null> {
  const candidates = [
    nodePath.join(installPath, ".claude-plugin", "plugin.json"),
    nodePath.join(installPath, "plugin.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await fsPromises.readFile(p, "utf-8");
      return JSON.parse(raw) as PluginJson;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
  }
  return null;
}

async function countAgentsAt(installPath: string): Promise<number> {
  const agentsDir = nodePath.join(installPath, "agents");
  try {
    const entries = await fsPromises.readdir(agentsDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

async function scanAgents(filesPath: string): Promise<PluginAgentSummary[]> {
  const agentsDir = nodePath.join(filesPath, "agents");
  let entries: Array<{ name: string; isFile: () => boolean }>;
  try {
    entries = await fsPromises.readdir(agentsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const agents: PluginAgentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const name = entry.name.replace(/\.md$/, "");
    let description: string | undefined;
    try {
      const raw = await fsPromises.readFile(
        nodePath.join(agentsDir, entry.name),
        "utf-8",
      );
      // Minimal frontmatter scan: look for `description:` key between --- fences.
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch?.[1]) {
        const descLine = fmMatch[1].match(/^description:\s*(.+?)\s*$/m);
        if (descLine?.[1]) {
          const val = descLine[1].replace(/^['"]|['"]$/g, "");
          if (val) description = val;
        }
      }
    } catch {
      // fall through; agent listed with name only
    }
    agents.push({ name, ...(description !== undefined && { description }) });
  }
  agents.sort((a, b) => a.name.localeCompare(b.name));
  return agents;
}

async function scanCommands(filesPath: string): Promise<PluginCommandSummary[]> {
  const commandsDir = nodePath.join(filesPath, "commands");
  try {
    const entries = await fsPromises.readdir(commandsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => ({ name: e.name.replace(/\.md$/, "") }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readReadme(filesPath: string): Promise<string | undefined> {
  const candidates = ["README.md", "README.MD", "Readme.md", "readme.md"];
  for (const c of candidates) {
    try {
      const raw = await fsPromises.readFile(nodePath.join(filesPath, c), "utf-8");
      return raw.length > 4096 ? raw.slice(0, 4096) : raw;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
  }
  return undefined;
}

function gitClone(args: {
  url: string;
  destination: string;
  ref?: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const cloneArgs = ["clone", "--depth", "1"];
    if (args.ref) cloneArgs.push("--branch", args.ref);
    cloneArgs.push(args.url, args.destination);

    const proc = spawn("git", cloneArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone exited ${code}: ${stderr.trim()}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Effect layer
// ---------------------------------------------------------------------------

export const makePlugins = Effect.gen(function* () {
  const listMarketplaces: PluginsShape["listMarketplaces"] = Effect.fn(
    "Plugins.listMarketplaces",
  )(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const marketplaces: Marketplace[] = [];
    for (const [name, entry] of Object.entries(raw)) {
      const source = onDiskToContractSource(entry.source);
      if (!source) continue;
      marketplaces.push({
        name,
        source,
        installLocation: entry.installLocation,
        lastUpdated: entry.lastUpdated,
      });
    }
    return { marketplaces };
  });

  const addMarketplace: PluginsShape["addMarketplace"] = Effect.fn(
    "Plugins.addMarketplace",
  )(function* (input) {
    // 1. Parse user input into a typed source (user-owned).
    const parsed = parseMarketplaceSource(input.sourceInput);
    if (!parsed.ok) {
      return yield* new PluginsServiceError({
        kind: "parse",
        message: "Could not parse marketplace source",
        detail: parsed.error,
      });
    }
    const source = parsed.value;

    // 2. Stage the clone in a temp dir so we can read the manifest before
    //    committing to a final location. This avoids polluting marketplaces/
    //    with partial clones if validation fails.
    const stagingDir = nodePath.join(marketplacesDir, `.staging-${randomUUID()}`);
    yield* Effect.tryPromise({
      try: () => fsPromises.mkdir(marketplacesDir, { recursive: true }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to prepare marketplaces directory",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const cloneUrl = sourceToCloneUrl(source);
    yield* Effect.tryPromise({
      try: () =>
        gitClone({
          url: cloneUrl,
          destination: stagingDir,
          ...(source.ref !== undefined && { ref: source.ref }),
        }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "clone",
          message: `Failed to clone ${cloneUrl}`,
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    // 3. Read the manifest — marketplace name is authoritative, user-supplied
    //    input can't override it. On any failure past this point we must clean
    //    up the staging directory so retries don't collide.
    const cleanupStaging = Effect.tryPromise({
      try: () => fsPromises.rm(stagingDir, { recursive: true, force: true }),
      catch: () => new PluginsServiceError({ kind: "io", message: "Failed to clean staging" }),
    }).pipe(Effect.catch(() => Effect.void));

    const manifestPath = nodePath.join(stagingDir, ".claude-plugin", "marketplace.json");
    const manifest: OnDiskMarketplaceManifest = yield* Effect.tryPromise({
      try: async () => {
        const raw = await fsPromises.readFile(manifestPath, "utf-8");
        return JSON.parse(raw) as OnDiskMarketplaceManifest;
      },
      catch: (cause) =>
        new PluginsServiceError({
          kind: "manifest",
          message: "Marketplace is missing .claude-plugin/marketplace.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.catch((err) =>
        cleanupStaging.pipe(Effect.flatMap(() => Effect.fail(err))),
      ),
    );

    const name = manifest?.name?.trim();
    if (!name) {
      yield* cleanupStaging;
      return yield* new PluginsServiceError({
        kind: "manifest",
        message: "marketplace.json has no `name` field",
      });
    }

    // 4. Validate the name (user-owned).
    const validated = validateMarketplaceName(name);
    if (!validated.ok) {
      yield* cleanupStaging;
      return yield* new PluginsServiceError({
        kind: "validate",
        message: "Marketplace name rejected",
        detail: validated.error,
      });
    }

    // 5. Check collision against existing marketplaces.
    const existing = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });
    if (existing[name]) {
      yield* cleanupStaging;
      return yield* new PluginsServiceError({
        kind: "collision",
        message: `Marketplace "${name}" is already registered`,
        detail: "Remove the existing marketplace first, then re-add.",
      });
    }

    // 6. Move staging dir to its final location.
    const installLocation = nodePath.join(marketplacesDir, name);
    yield* Effect.tryPromise({
      try: () => fsPromises.rename(stagingDir, installLocation),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to finalize marketplace install location",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    // 7. Persist to known_marketplaces.json.
    const lastUpdated = new Date().toISOString();
    const entry: OnDiskMarketplaceEntry = {
      source: contractToOnDiskSource(source),
      installLocation,
      lastUpdated,
    };
    const updated: OnDiskKnownMarketplaces = { ...existing, [name]: entry };
    yield* Effect.tryPromise({
      try: () => writeKnownMarketplaces(updated),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to write known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    return {
      marketplace: {
        name,
        source,
        installLocation,
        lastUpdated,
      },
    };
  });

  const removeMarketplace: PluginsShape["removeMarketplace"] = Effect.fn(
    "Plugins.removeMarketplace",
  )(function* (input) {
    const existing = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const entry = existing[input.name];
    if (!entry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Marketplace "${input.name}" not found`,
      });
    }

    yield* Effect.tryPromise({
      try: () => fsPromises.rm(entry.installLocation, { recursive: true, force: true }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to remove marketplace directory",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const { [input.name]: _removed, ...rest } = existing;
    yield* Effect.tryPromise({
      try: () => writeKnownMarketplaces(rest),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to write known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    return { name: input.name };
  });

  const listInstalled: PluginsShape["listInstalled"] = Effect.fn(
    "Plugins.listInstalled",
  )(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => readInstalledPlugins(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const plugins: InstalledPlugin[] = [];
    for (const [pluginId, installations] of Object.entries(raw.plugins)) {
      const install = installations[0];
      if (!install?.installPath) continue;
      const [rawName, marketplaceName] = pluginId.split("@");
      const agentCount = yield* Effect.tryPromise({
        try: () => countAgentsAt(install.installPath),
        catch: () => new PluginsServiceError({ kind: "io", message: "Failed to count agents" }),
      });
      plugins.push({
        name: rawName ?? pluginId,
        marketplaceName: marketplaceName ?? "",
        version: install.version,
        installPath: install.installPath,
        agentCount,
      });
    }

    return { plugins };
  });

  const listMarketplacePlugins: PluginsShape["listMarketplacePlugins"] = Effect.fn(
    "Plugins.listMarketplacePlugins",
  )(function* (input) {
    const known = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const entry = known[input.marketplaceName];
    if (!entry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Marketplace "${input.marketplaceName}" not found`,
      });
    }

    const manifestPath = nodePath.join(
      entry.installLocation,
      ".claude-plugin",
      "marketplace.json",
    );
    const manifest = yield* Effect.tryPromise({
      try: async () => {
        const raw = await fsPromises.readFile(manifestPath, "utf-8");
        return JSON.parse(raw) as OnDiskMarketplaceManifest;
      },
      catch: (cause) =>
        new PluginsServiceError({
          kind: "manifest",
          message: "Failed to read marketplace.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const installed = yield* Effect.tryPromise({
      try: () => readInstalledPlugins(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const rawPlugins = manifest.plugins ?? [];
    const plugins: MarketplacePlugin[] = [];
    for (const raw of rawPlugins) {
      const pluginName = raw.name?.trim();
      if (!pluginName) continue;

      const pluginId = `${pluginName}@${input.marketplaceName}`;
      const installedEntry = installed.plugins[pluginId]?.[0];
      const isInstalled = Boolean(installedEntry);

      const strategyResult = resolvePluginFetchStrategy(raw.source);
      const sourceKind: PluginSourceKind = strategyResult.ok
        ? fetchStrategyToKind(strategyResult.value)
        : "unknown";
      const sourceSummary = strategyResult.ok
        ? fetchStrategyToSummary(strategyResult.value)
        : rawSourceSummary(raw.source);

      const author =
        typeof raw.author === "string"
          ? raw.author
          : raw.author?.name ?? undefined;

      plugins.push({
        name: pluginName,
        ...(raw.description !== undefined && { description: raw.description }),
        ...(raw.category !== undefined && { category: raw.category }),
        ...(raw.homepage !== undefined && { homepage: raw.homepage }),
        ...(author !== undefined && { author }),
        sourceKind,
        sourceSummary,
        isInstalled,
        ...(isInstalled &&
          installedEntry?.version !== undefined && {
            installedVersion: installedEntry.version,
          }),
      });
    }

    return { marketplaceName: input.marketplaceName, plugins };
  });

  const getPluginDetails: PluginsShape["getPluginDetails"] = Effect.fn(
    "Plugins.getPluginDetails",
  )(function* (input) {
    const known = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const marketplaceEntry = known[input.marketplaceName];
    if (!marketplaceEntry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Marketplace "${input.marketplaceName}" not found`,
      });
    }

    const manifestPath = nodePath.join(
      marketplaceEntry.installLocation,
      ".claude-plugin",
      "marketplace.json",
    );
    const manifest = yield* Effect.tryPromise({
      try: async () => {
        const raw = await fsPromises.readFile(manifestPath, "utf-8");
        return JSON.parse(raw) as OnDiskMarketplaceManifest;
      },
      catch: (cause) =>
        new PluginsServiceError({
          kind: "manifest",
          message: "Failed to read marketplace.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const pluginEntry = (manifest.plugins ?? []).find(
      (p) => p.name?.trim() === input.pluginName,
    );
    if (!pluginEntry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Plugin "${input.pluginName}" not found in marketplace "${input.marketplaceName}"`,
      });
    }

    const installed = yield* Effect.tryPromise({
      try: () => readInstalledPlugins(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });
    const pluginId = `${input.pluginName}@${input.marketplaceName}`;
    const installedEntry = installed.plugins[pluginId]?.[0];
    const isInstalled = Boolean(installedEntry);

    const strategyResult = resolvePluginFetchStrategy(pluginEntry.source);
    const sourceKind: PluginSourceKind = strategyResult.ok
      ? fetchStrategyToKind(strategyResult.value)
      : "unknown";
    const sourceSummary = strategyResult.ok
      ? fetchStrategyToSummary(strategyResult.value)
      : rawSourceSummary(pluginEntry.source);

    // Determine where the plugin's files are readable from disk.
    // Priority: installed install path → in-repo subdir of the marketplace clone.
    let filesPath: string | undefined;
    if (installedEntry?.installPath) {
      filesPath = installedEntry.installPath;
    } else if (strategyResult.ok && strategyResult.value.kind === "inRepo") {
      const candidate = nodePath.resolve(
        marketplaceEntry.installLocation,
        strategyResult.value.relativePath,
      );
      const marketplaceRoot = nodePath.resolve(marketplaceEntry.installLocation);
      if (
        candidate === marketplaceRoot ||
        candidate.startsWith(marketplaceRoot + nodePath.sep)
      ) {
        filesPath = candidate;
      }
    }

    const author =
      typeof pluginEntry.author === "string"
        ? pluginEntry.author
        : pluginEntry.author?.name ?? undefined;

    let manifestVersion: string | undefined;
    let agents: PluginAgentSummary[] = [];
    let commands: PluginCommandSummary[] = [];
    let readme: string | undefined;

    if (filesPath) {
      const pluginJson = yield* Effect.tryPromise({
        try: () => readPluginJson(filesPath!),
        catch: () => new PluginsServiceError({ kind: "io", message: "Failed to read plugin.json" }),
      }).pipe(Effect.catch(() => Effect.succeed(null as PluginJson | null)));
      if (pluginJson?.version) manifestVersion = pluginJson.version;

      agents = yield* Effect.tryPromise({
        try: () => scanAgents(filesPath!),
        catch: () => new PluginsServiceError({ kind: "io", message: "Failed to scan agents" }),
      }).pipe(Effect.catch(() => Effect.succeed([] as PluginAgentSummary[])));

      commands = yield* Effect.tryPromise({
        try: () => scanCommands(filesPath!),
        catch: () => new PluginsServiceError({ kind: "io", message: "Failed to scan commands" }),
      }).pipe(Effect.catch(() => Effect.succeed([] as PluginCommandSummary[])));

      readme = yield* Effect.tryPromise({
        try: () => readReadme(filesPath!),
        catch: () => new PluginsServiceError({ kind: "io", message: "Failed to read README" }),
      }).pipe(Effect.catch(() => Effect.succeed(undefined as string | undefined)));
    }

    const details: MarketplacePluginDetails = {
      name: input.pluginName,
      ...(pluginEntry.description !== undefined && { description: pluginEntry.description }),
      ...(pluginEntry.category !== undefined && { category: pluginEntry.category }),
      ...(pluginEntry.homepage !== undefined && { homepage: pluginEntry.homepage }),
      ...(author !== undefined && { author }),
      sourceKind,
      sourceSummary,
      isInstalled,
      ...(isInstalled &&
        installedEntry?.version !== undefined && {
          installedVersion: installedEntry.version,
        }),
      marketplaceName: input.marketplaceName,
      ...(filesPath !== undefined && { filesPath }),
      ...(manifestVersion !== undefined && { manifestVersion }),
      agents,
      commands,
      ...(readme !== undefined && { readme }),
    };

    return { plugin: details };
  });

  const installPlugin: PluginsShape["installPlugin"] = Effect.fn(
    "Plugins.installPlugin",
  )(function* (input) {
    const known = yield* Effect.tryPromise({
      try: () => readKnownMarketplaces(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read known_marketplaces.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const marketplaceEntry = known[input.marketplaceName];
    if (!marketplaceEntry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Marketplace "${input.marketplaceName}" not found`,
      });
    }

    const manifestPath = nodePath.join(
      marketplaceEntry.installLocation,
      ".claude-plugin",
      "marketplace.json",
    );
    const manifest = yield* Effect.tryPromise({
      try: async () => {
        const raw = await fsPromises.readFile(manifestPath, "utf-8");
        return JSON.parse(raw) as OnDiskMarketplaceManifest;
      },
      catch: (cause) =>
        new PluginsServiceError({
          kind: "manifest",
          message: "Failed to read marketplace.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const pluginEntry = (manifest.plugins ?? []).find(
      (p) => p.name?.trim() === input.pluginName,
    );
    if (!pluginEntry) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Plugin "${input.pluginName}" not found in marketplace "${input.marketplaceName}"`,
      });
    }

    // Already installed?
    const existingInstalled = yield* Effect.tryPromise({
      try: () => readInstalledPlugins(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });
    const pluginId = `${input.pluginName}@${input.marketplaceName}`;
    if (existingInstalled.plugins[pluginId]?.[0]) {
      return yield* new PluginsServiceError({
        kind: "alreadyInstalled",
        message: `Plugin "${input.pluginName}" is already installed`,
        detail: "Uninstall it first to reinstall.",
      });
    }

    // Resolve fetch strategy (user-owned).
    const strategyResult = resolvePluginFetchStrategy(pluginEntry.source);
    if (!strategyResult.ok) {
      return yield* new PluginsServiceError({
        kind: "parse",
        message: "Could not resolve plugin source",
        detail: strategyResult.error,
      });
    }
    const strategy = strategyResult.value;

    if (strategy.kind === "gitSubdir") {
      return yield* new PluginsServiceError({
        kind: "unsupported",
        message: "git-subdir plugin sources are not supported yet",
        detail:
          "This plugin uses sparse-checkout. Install it via the Claude CLI for now.",
      });
    }

    // Stage into a temp dir under cache/ so we can read plugin.json before
    // committing to the final <cache>/<marketplace>/<plugin>/<version>/ path.
    const stagingDir = nodePath.join(cacheDir, `.staging-${randomUUID()}`);
    yield* Effect.tryPromise({
      try: () => fsPromises.mkdir(cacheDir, { recursive: true }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to prepare cache directory",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const cleanupStaging = Effect.tryPromise({
      try: () => fsPromises.rm(stagingDir, { recursive: true, force: true }),
      catch: () => new PluginsServiceError({ kind: "io", message: "Failed to clean staging" }),
    }).pipe(Effect.catch(() => Effect.void));

    if (strategy.kind === "inRepo") {
      // Copy from <marketplaceInstallLocation>/<relativePath> — already on disk.
      const sourceDir = nodePath.resolve(
        marketplaceEntry.installLocation,
        strategy.relativePath,
      );
      // Belt-and-suspenders: make sure the resolved path stays inside the
      // marketplace directory, even if the user's resolver didn't reject `..`.
      const marketplaceRoot = nodePath.resolve(marketplaceEntry.installLocation);
      if (!sourceDir.startsWith(marketplaceRoot + nodePath.sep) && sourceDir !== marketplaceRoot) {
        return yield* new PluginsServiceError({
          kind: "validate",
          message: "Plugin path escapes the marketplace directory",
          detail: `Rejected path: ${strategy.relativePath}`,
        });
      }

      yield* Effect.tryPromise({
        try: () => fsPromises.cp(sourceDir, stagingDir, { recursive: true }),
        catch: (cause) =>
          new PluginsServiceError({
            kind: "io",
            message: "Failed to copy plugin from marketplace",
            detail: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      }).pipe(
        Effect.catch((err) =>
          cleanupStaging.pipe(Effect.flatMap(() => Effect.fail(err))),
        ),
      );
    } else {
      // externalGit — clone it.
      yield* Effect.tryPromise({
        try: () =>
          gitClone({
            url: strategy.url,
            destination: stagingDir,
            ...(strategy.ref !== undefined && { ref: strategy.ref }),
          }),
        catch: (cause) =>
          new PluginsServiceError({
            kind: "clone",
            message: `Failed to clone ${strategy.url}`,
            detail: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      }).pipe(
        Effect.catch((err) =>
          cleanupStaging.pipe(Effect.flatMap(() => Effect.fail(err))),
        ),
      );
    }

    // Discover version from the plugin's own plugin.json, default if missing.
    const pluginJson = yield* Effect.tryPromise({
      try: () => readPluginJson(stagingDir),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "manifest",
          message: "Failed to read plugin.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.catch((err) =>
        cleanupStaging.pipe(Effect.flatMap(() => Effect.fail(err))),
      ),
    );
    const version = pluginJson?.version?.trim() || "0.0.0";

    // Move staging dir to final cache path: cache/<marketplace>/<plugin>/<version>/
    const finalDir = nodePath.join(
      cacheDir,
      input.marketplaceName,
      input.pluginName,
      version,
    );
    yield* Effect.tryPromise({
      try: async () => {
        await fsPromises.mkdir(nodePath.dirname(finalDir), { recursive: true });
        // If finalDir already exists (orphan from a crash), wipe it.
        await fsPromises.rm(finalDir, { recursive: true, force: true });
        await fsPromises.rename(stagingDir, finalDir);
      },
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to finalize plugin install location",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.catch((err) =>
        cleanupStaging.pipe(Effect.flatMap(() => Effect.fail(err))),
      ),
    );

    // Update installed_plugins.json.
    const now = new Date().toISOString();
    const updated: OnDiskInstalledPluginsFile = {
      version: existingInstalled.version || 2,
      plugins: {
        ...existingInstalled.plugins,
        [pluginId]: [
          {
            scope: "user",
            installPath: finalDir,
            version,
            installedAt: now,
            lastUpdated: now,
          },
        ],
      },
    };
    yield* Effect.tryPromise({
      try: () => writeInstalledPlugins(updated),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to write installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const agentCount = yield* Effect.tryPromise({
      try: () => countAgentsAt(finalDir),
      catch: () => new PluginsServiceError({ kind: "io", message: "Failed to count agents" }),
    });

    return {
      plugin: {
        name: input.pluginName,
        marketplaceName: input.marketplaceName,
        version,
        installPath: finalDir,
        agentCount,
      },
    };
  });

  const uninstallPlugin: PluginsShape["uninstallPlugin"] = Effect.fn(
    "Plugins.uninstallPlugin",
  )(function* (input) {
    const existing = yield* Effect.tryPromise({
      try: () => readInstalledPlugins(),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to read installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const pluginId = `${input.pluginName}@${input.marketplaceName}`;
    const installations = existing.plugins[pluginId];
    const install = installations?.[0];
    if (!install) {
      return yield* new PluginsServiceError({
        kind: "notFound",
        message: `Plugin "${input.pluginName}" is not installed`,
      });
    }

    yield* Effect.tryPromise({
      try: () => fsPromises.rm(install.installPath, { recursive: true, force: true }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to remove plugin directory",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const { [pluginId]: _removed, ...rest } = existing.plugins;
    yield* Effect.tryPromise({
      try: () =>
        writeInstalledPlugins({
          version: existing.version || 2,
          plugins: rest,
        }),
      catch: (cause) =>
        new PluginsServiceError({
          kind: "io",
          message: "Failed to write installed_plugins.json",
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    return {
      marketplaceName: input.marketplaceName,
      pluginName: input.pluginName,
    };
  });

  return {
    listMarketplaces,
    addMarketplace,
    removeMarketplace,
    listInstalled,
    listMarketplacePlugins,
    getPluginDetails,
    installPlugin,
    uninstallPlugin,
  } satisfies PluginsShape;
});

export const PluginsLive = Layer.effect(Plugins, makePlugins);
