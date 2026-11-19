import { readFile } from "node:fs/promises"
import { registerHooks, stripTypeScriptTypes } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { type CliConfig, parseCliConfig } from "@wirecat/cli-core/manifest"
import type { NewArgs } from "./new.js"

/** `pending`: what `new` keeps in the config for later and does not build from yet. */
export type LoadedConfig = { config: CliConfig; text: string; pending: string[]; verifies: boolean }

const CLI_CORE = /^@wirecat\/cli-core(\/|$)/

const configs = new Set<string>()
let hooked = false

// The config is read before its CLI has node_modules, so its cli-core imports resolve to the kit's own cli-core;
// Node before 22.18 strips types only behind a flag, and the kit runs without one. `new` copies the config alone,
// so a file it imports beside it would be missing from the CLI.
const hookConfigImports = (config: string) => {
  configs.add(config)
  if (hooked) return
  hooked = true
  registerHooks({
    resolve: (specifier, context, next) => {
      // As if the kit imported it; import.meta.resolve here would call this hook again.
      if (CLI_CORE.test(specifier)) return next(specifier, { ...context, parentURL: import.meta.url })
      if (context.parentURL && configs.has(context.parentURL) && specifier.startsWith("."))
        throw new Error(`wirecat.config.ts: keep the config in one file; it imports ${specifier}`)
      return next(specifier, context)
    },
    load: (url, context, next) => {
      if (process.features.typescript || !/\.m?ts$/.test(url)) return next(url, context)
      const loaded = next(url, { ...context, format: "module" })
      const source = Buffer.from(loaded.source as Uint8Array).toString("utf8")
      return { format: "module", source: stripTypeScriptTypes(source), shortCircuit: true }
    },
  })
}

export const loadCliConfig = async (path: string): Promise<LoadedConfig> => {
  const full = resolve(path)
  const url = pathToFileURL(full).href
  hookConfigImports(url)
  const module: { default?: unknown } = await import(url)
  if (module.default === undefined)
    throw new Error(`${path}: export the config as default: export default defineCli({…})`)
  const config = parseCliConfig(module.default)
  const verifies =
    (config.auth.preset === "token" || config.auth.preset === "app-password") && config.auth.verify !== undefined
  // WordPress signs in with an application password on the owner's own site, and that sign-in reaches nothing else.
  const wordpress = config.spec.kind === "wp-json"
  if (wordpress !== (config.auth.preset === "app-password"))
    throw new Error('wirecat.config: spec.kind "wp-json" and auth.preset "app-password" go together, one for the other')
  if (wordpress && (!verifies || config.spec.version === undefined))
    throw new Error(
      "wirecat.config: a WordPress CLI needs spec.version, the WordPress version spec.from runs, and auth.verify, " +
        'as { operation: "getWpV2UsersMe", id: "id", name: "name" }',
    )
  // The content commands sign in to the profile's own site, as an application password does.
  if (config.category === "content" && config.source && !wordpress)
    throw new Error(
      'wirecat.config: a content source reads a site\'s REST index yet: spec.kind "wp-json" with auth.preset "app-password"',
    )
  if (wordpress && config.source && config.category !== "content")
    throw new Error('wirecat.config: a WordPress source is the content category: category: "content"')
  // cli-core's trackerManifestFake, which the tracker's contract test runs over, answers GraphQL only.
  if (config.category === "tracker" && config.spec.kind !== "graphql")
    throw new Error(
      "wirecat.config: a tracker source reads a GraphQL schema yet; cli-core's tracker fake answers no other API",
    )
  // The source's commands key the store by the account session start checked; the sample's session checks nothing.
  if (config.source && !verifies)
    throw new Error(
      'wirecat.config: auth: a source needs auth: { preset: "token", verify: { … } } yet, so session start ' +
        "checks the token and names the account",
    )
  if (config.category === "crm" && config.spec.kind === "graphql")
    throw new Error("wirecat.config: a CRM source reads an OpenAPI description yet; spec.kind graphql is for a tracker")
  return { config, text: await readFile(full, "utf8"), pending: notWiredYet(config), verifies }
}

// Keyed by name, not by cli-core's preset type: a preset cli-core adds must not stop this file compiling.
const SIGN_IN: Readonly<Record<string, string>> = {
  none: "none",
  token: "token",
  "app-password": "token",
  "oauth2-pkce": "oauth",
}

const signInOf = (preset: string): string => {
  const sign = SIGN_IN[preset]
  if (sign === undefined) throw new Error(`wirecat.config: auth.preset ${preset} is not one this template makes yet`)
  return sign
}

const notWiredYet = (config: CliConfig): string[] => [
  ...(config.auth.preset === "oauth2-pkce"
    ? ["auth: the oauth2-pkce sign-in; session keeps the template's sample"]
    : []),
  ...(config.auth.preset === "token" && !config.auth.verify
    ? ["auth.verify: the call that checks a token; without it at new, session keeps the template's sample"]
    : []),
  ...(config.source && config.category === "crm"
    ? ["source: the CRM's write commands (crmWriteContract is excepted in lint/contract-exceptions.json)"]
    : []),
  ...(config.source && config.category === "tracker"
    ? ["source: the tracker's write commands, and its items in the shared search; sync and the reads are built"]
    : []),
  ...(config.spec.kind === "graphql" && config.auth.preset !== "none"
    ? ["auth: the header the key travels in is the sample's Authorization in scripts/generate.ts; check its docs"]
    : []),
]

/** The answers the config gives; the rest come from flags or the terminal, as without it. */
export const configArgs = (config: CliConfig, args: NewArgs): NewArgs => {
  const given: Record<string, string> = {
    command: config.identity.command,
    package: config.identity.package,
    owner: config.identity.owner,
    category: config.category === "other" ? "other:api" : config.category,
    "sign-in": signInOf(config.auth.preset),
    spec: config.spec.kind,
    "spec-url": config.spec.from,
  }
  const twice = Object.keys(given).filter((flag) => args.flags[flag] !== undefined)
  if (twice.length) throw new Error(`--from-config already sets ${twice.map((flag) => `--${flag}`).join(", ")}`)
  if (args.name !== undefined) throw new Error("--from-config names the folder after the package; leave out <name>")
  return { name: config.identity.package.replace(/^@[^/]+\//, ""), flags: { ...args.flags, ...given } }
}
