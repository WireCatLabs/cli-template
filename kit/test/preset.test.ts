import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { parseCliManifest } from "../src/manifest.js"
import { runNew } from "../src/new.js"
import { loadSource } from "../src/source.js"
import { io, NOTES_FLAGS, read, removeTempDirs, tempDir } from "./fixture.js"

afterAll(removeTempDirs)

const root = join(import.meta.dirname, "../..")

const makeGeneric = async (flags: Record<string, string>, name = "acme-cli") => {
  const cwd = tempDir("preset")
  const out = await runNew(cwd, await loadSource(root), { name, flags: { preset: "generic", ...flags } }, io())
  return { dir: join(cwd, name), out }
}

describe("new --preset generic", () => {
  it("needs only the name and the owner, and answers the rest with neutral defaults", async () => {
    const { dir, out } = await makeGeneric({ owner: "Example" })

    const pkg = JSON.parse(read(dir, "package.json"))
    expect(pkg.name).toBe("@example/acme-cli")
    expect(pkg.description).toBe("A CLI and MCP server, started from cli-template")
    expect(pkg.bin).toMatchObject({ acme: "dist/bin/acme.js" })
    expect(JSON.parse(read(dir, "template.json")).preset).toBe("generic")
    expect(read(dir, "src/identity.ts")).toContain('  tagline: "A CLI and MCP server, started from cli-template",\n')
    expect(read(dir, "docs/dev/DESIGN.md")).toContain("**Category:** other: api\n")
    expect(out).toContain("To publish:\n  1. After the first commit, run node bin/setup-github")
    expect(out).toContain("2. Once the first release pull request is merged, run node bin/release --first.")
    expect(out).not.toContain(dir)
    expect(out).not.toContain("Entries for step 4")
  })

  it("lets every flag given win over the preset", async () => {
    const { dir } = await makeGeneric(
      { ...NOTES_FLAGS, owner: "example", command: "cal", "sign-in": "oauth" },
      "cal-cli",
    )

    expect(read(dir, "docs/dev/DESIGN.md")).toContain("**Category:** notes\n")
    expect(read(dir, "docs/dev/DESIGN.md")).toContain("**Sign-in:** OAuth in the browser\n")
  })

  it("refuses a WireCat package and an unknown preset", async () => {
    await expect(makeGeneric({ owner: "WireCatLabs", package: "@wirecat/acme-cli" })).rejects.toThrow(
      "--preset generic is for a CLI outside WireCat",
    )
    await expect(makeGeneric({ owner: "example", preset: "wirecat" })).rejects.toThrow('--preset: "wirecat"')
  })

  it("is what bin/release and the release workflow look for before they skip the live check", async () => {
    const { dir } = await makeGeneric({ owner: "example" })

    const manifest = read(dir, "template.json")
    expect(read(dir, "bin/release")).toContain(
      `grep -qs '"preset": "generic"' template.json || pnpm exec cli-dev live check`,
    )
    expect(read(dir, ".github/workflows/release-start.yml")).toContain(
      `grep -qs "\\"preset\\": \\"generic\\"" template.json || pnpm exec cli-dev live check`,
    )
    expect(manifest).toContain('"preset": "generic"')
    expect(parseCliManifest("template.json", JSON.parse(manifest)).preset).toBe("generic")
  })

  it("is not written without the preset, so such a CLI keeps the live check", async () => {
    const cwd = tempDir("no-preset")
    await runNew(cwd, await loadSource(root), { name: "cal-cli", flags: NOTES_FLAGS }, io())

    expect(read(join(cwd, "cal-cli"), "template.json")).not.toContain("preset")
  })
})

describe("the new CLI's README", () => {
  it("opens with the Docs, Install and Usage row, the gains and why before the quick start, no placeholder", async () => {
    const { dir } = await makeGeneric({ owner: "example" })

    const readme = read(dir, "README.md")
    const at = (heading: string) => readme.indexOf(`\n## ${heading}\n`)
    expect(readme.split("\n")[0]).toBe("# acme: acme CLI for AI agents")
    expect(readme).toContain("A CLI and MCP server, started from cli-template. One tool for you")
    expect(at("What you get")).toBeGreaterThan(0)
    expect(at("Why acme")).toBeGreaterThan(at("What you get"))
    expect(at("Quick start")).toBeGreaterThan(at("Why acme"))
    expect(at("Use it with your agent")).toBeGreaterThan(at("Quick start"))
    expect(readme).toContain("acme personal session start")
    const row = readme.indexOf('<p align="center">')
    expect(row).toBeGreaterThan(0)
    expect(at("What you get")).toBeGreaterThan(row)
    for (const [label, page] of [
      ["Docs", "index"],
      ["Install", "installation"],
      ["Usage", "usage"],
    ]) {
      expect(readme).toContain(`<a href="https://github.com/example/acme-cli/blob/main/docs/${page}.md">${label}</a>`)
      expect(existsSync(join(dir, `docs/${page}.md`))).toBe(true)
    }
    for (const block of readme.match(/```sh\n[\s\S]*?```/g) ?? []) expect(block).not.toMatch(/<[a-z]/)
  })
})

describe("--sign-in none", () => {
  it("takes the sign-in check out of the MCP command, so mcp check does not wait for an account", async () => {
    const { dir } = await makeGeneric({ owner: "example", "sign-in": "none" })

    const program = read(dir, "src/program.ts")
    expect(program).toContain("appMcpCommand(IDENTITY, configuration, {")
    expect(program).not.toContain("signedIn")
    expect(program).not.toContain("ProfileTokenStore")
  })

  it("keeps it for a CLI that signs in", async () => {
    const { dir } = await makeGeneric({ owner: "example" })

    expect(read(dir, "src/program.ts")).toContain("new ProfileTokenStore(")
  })
})
