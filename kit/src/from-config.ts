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
  const verifies = config.auth.preset === "token" && config.auth.verify !== undefined
  return { config, text: await readFile(full, "utf8"), pending: notWiredYet(config), verifies }
}

const SIGN_IN: Record<CliConfig["auth"]["preset"], string> = { none: "none", token: "token", "oauth2-pkce": "oauth" }

const notWiredYet = (config: CliConfig): string[] => [
  ...(config.auth.preset === "oauth2-pkce"
    ? ["auth: the oauth2-pkce sign-in; session keeps the template's sample"]
    : []),
  ...(config.auth.preset === "token" && !config.auth.verify
    ? ["auth.verify: the call that checks a token; session keeps the template's sample until it is named"]
    : []),
  ...(config.source
    ? ["source: the CRM's write commands (crmWriteContract is excepted in lint/contract-exceptions.json)"]
    : []),
]

/** The answers the config gives; the rest come from flags or the terminal, as without it. */
export const configArgs = (config: CliConfig, args: NewArgs): NewArgs => {
  const given: Record<string, string> = {
    command: config.identity.command,
    package: config.identity.package,
    owner: config.identity.owner,
    category: config.category === "other" ? "other:api" : config.category,
    "sign-in": SIGN_IN[config.auth.preset],
    spec: config.spec.kind,
    "spec-url": config.spec.from,
  }
  const twice = Object.keys(given).filter((flag) => args.flags[flag] !== undefined)
  if (twice.length) throw new Error(`--from-config already sets ${twice.map((flag) => `--${flag}`).join(", ")}`)
  if (args.name !== undefined) throw new Error("--from-config names the folder after the package; leave out <name>")
  return { name: config.identity.package.replace(/^@[^/]+\//, ""), flags: { ...args.flags, ...given } }
}
