import { existsSync, writeFileSync } from "node:fs"
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
  components: {
    securitySchemes: {
      oauth: {
        type: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "https://app.acme.example/authorize",
            tokenUrl: "https://app.acme.example/token",
            scopes: {},
          },
        },
      },
    },
  },
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
    expect(out).toContain("  pnpm bootstrap\n  pnpm source:check\n")
    expect(out).toContain('"displayName": "Acme",')
  })

  it("wires a CRM config's token check, CRM commands and contract tests", async () => {
    const cwd = tempDir("from-config-crm")
    const crm = CONFIG.replace(
      "auth: { preset },",
      'auth: { preset, verify: { operation: "getMe", id: "workspace.id" } },',
    ).replace('category: "other",', 'category: "crm",\n  source: { provider: "acme", kinds: ["person"] },')
    writeFileSync(join(cwd, "wirecat.config.ts"), crm)
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
    expect(read(dir, "src/commands/session.ts")).toContain("tokenSessionCommand(")
    expect(read(dir, "src/commands/session.test.ts")).toContain("recalledAccount(")
    expect(read(dir, "src/identity.ts")).toContain('  syncs: "your people",')
    const runScope = read(dir, "src/run-scope.test.ts")
    expect(runScope).toContain("fetch: fakeServiceApi().fetch")
    expect(runScope).not.toContain("comments")
    // The sample is left out, and nothing the CLI keeps reaches for it.
    expect(existsSync(join(dir, "src/sample"))).toBe(false)
    expect(existsSync(join(dir, "src/testing/fake-comments.ts"))).toBe(false)
    for (const path of [
      "src/context.ts",
      "src/program.ts",
      "src/testing/harness.ts",
      "src/mcp.test.ts",
      "src/api.test.ts",
    ])
      expect(read(dir, path), path).not.toMatch(/sample\/|fake-comments|commentsCommand/)
    expect(read(dir, "src/identity.ts")).toContain('hosts: ["api.acme.example", "app.acme.example"],')
    expect(read(dir, "src/commands/crm.ts")).toContain('live: ["user"]')
    expect(runScope).toContain("sync: \"cli-core's addCrmCommands runs it in its run")
    expect(read(dir, "src/program.ts")).toMatch(/apiCommand\(\),\n +\.\.\.crmCommands\(\),/)
    expect(read(dir, "src/crm-contracts.test.ts")).toContain("crmSourceContract(")
    expect(JSON.parse(read(dir, "lint/contract-exceptions.json"))).toEqual([
      expect.objectContaining({ contract: "crmWriteContract" }),
    ])
    const scripts = JSON.parse(read(dir, "package.json")).scripts
    expect(scripts.generate).toMatch(/^node --experimental-strip-types scripts\/from-config\.ts && /)
    expect(scripts["generate:check"]).toMatch(/^node --experimental-strip-types scripts\/from-config\.ts --check && /)
    expect(out).not.toContain("auth.verify:")
  })

  it("names the field a config gets wrong", async () => {
    const cwd = tempDir("from-config-bad")
    writeFileSync(join(cwd, "wirecat.config.ts"), CONFIG.replace('"WCACME"', '"wc-acme"'))

    await expect(loadCliConfig(join(cwd, "wirecat.config.ts"))).rejects.toThrow("wirecat.config: identity.prefix")
  })

  it("refuses a CRM source without a token check that names the account", async () => {
    const cwd = tempDir("from-config-crm-unverified")
    writeFileSync(
      join(cwd, "wirecat.config.ts"),
      CONFIG.replace('category: "other",', 'category: "crm",\n  source: { provider: "acme" },'),
    )

    await expect(loadCliConfig(join(cwd, "wirecat.config.ts"))).rejects.toThrow("a source needs auth")
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
