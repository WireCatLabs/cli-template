import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { configArgs, loadCliConfig } from "../src/from-config.js"
import { runNew } from "../src/new.js"
import { loadSource } from "../src/source.js"
import type { SpecFetch } from "../src/spec-url.js"
import { io, read, removeTempDirs, tempDir } from "./fixture.js"

afterAll(removeTempDirs)

const CONFIG = `import { defineCli } from "@wirecat/cli-core/manifest"

type Preset = "token"
const preset: Preset = "token"

export default defineCli({
  identity: { command: "acme", package: "@wirecat/acme-cli", prefix: "WCACME", service: "Acme", owner: "WireCatLabs" },
  spec: { kind: "openapi", from: "https://docs.acme.example/openapi.json" },
  auth: { preset },
  category: "other",
})
`

const SPEC = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Acme Public API v2", version: "1" },
  servers: [{ url: "https://api.acme.example/v1" }],
  paths: { "/notes": { get: { operationId: "listNotes", responses: { "200": { description: "ok" } } } } },
})

const fetch: SpecFetch = async () => new Response(SPEC)

const ANSWERS = {
  "content-lang": "en",
  api: "official-docs",
  filters: "text",
  "never-store": "tokens",
  untrusted: "names",
  tagline: "Acme for agents",
}

describe("new --from-config", () => {
  it("reads a typed config from a folder without node_modules and builds the CLI it names", async () => {
    const cwd = tempDir("from-config")
    writeFileSync(join(cwd, "wirecat.config.ts"), CONFIG)
    const loaded = await loadCliConfig(join(cwd, "wirecat.config.ts"))

    const out = await runNew(
      cwd,
      await loadSource(join(import.meta.dirname, "../..")),
      configArgs(loaded.config, { flags: ANSWERS }),
      io(),
      fetch,
      loaded,
    )

    const dir = join(cwd, "acme-cli")
    expect(read(dir, "wirecat.config.ts")).toBe(CONFIG)
    expect(read(dir, "src/identity.ts")).toContain('envPrefix: "WCACME",')
    expect(read(dir, "src/config.ts")).toContain('service: "Acme",')
    expect(read(dir, "README.md").split("\n")[0]).toBe("# acme: Acme CLI for AI agents")
    expect(JSON.parse(read(dir, "template.json")).names).toMatchObject({ command: "acme", prefix: "WCACME" })
    expect(JSON.parse(read(dir, "package.json")).scripts["source:check"]).toBe(
      "node --experimental-strip-types scripts/source-check.ts",
    )
    expect(read(dir, "scripts/source-check.ts")).toContain("crmManifestProblems(parseCrmManifest(")
    expect(out).toContain("  pnpm generate\n  pnpm source:check\n")
    expect(out).toContain('"displayName": "Acme",')
  })

  it("names the field a config gets wrong", async () => {
    const cwd = tempDir("from-config-bad")
    writeFileSync(join(cwd, "wirecat.config.ts"), CONFIG.replace('"WCACME"', '"wc-acme"'))

    await expect(loadCliConfig(join(cwd, "wirecat.config.ts"))).rejects.toThrow("wirecat.config: identity.prefix")
  })

  it("refuses a flag or a folder name the config already sets", async () => {
    const cwd = tempDir("from-config-twice")
    writeFileSync(join(cwd, "wirecat.config.ts"), CONFIG)
    const { config } = await loadCliConfig(join(cwd, "wirecat.config.ts"))

    expect(() => configArgs(config, { flags: { command: "other" } })).toThrow("--from-config already sets --command")
    expect(() => configArgs(config, { name: "x-cli", flags: {} })).toThrow("leave out <name>")
    expect(configArgs(config, { flags: {} }).flags.category).toBe("other:api")
    const oauth = { ...config, auth: { preset: "oauth2-pkce" as const, scopes: ["record:read"] } }
    expect(configArgs(oauth, { flags: {} }).flags["sign-in"]).toBe("oauth")
  })
})
