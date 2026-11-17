import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { runNew } from "../src/new.js"
import { loadSource } from "../src/source.js"
import { downloadSpec, type SpecFetch } from "../src/spec-url.js"
import { io, NOTES_FLAGS, read, removeTempDirs, tempDir } from "./fixture.js"

afterAll(removeTempDirs)

const YAML_SPEC = `openapi: 3.0.3
info:
  title: Acme Notes API
  version: "1"
servers:
  - url: /v1
paths:
  /api/notes:
    get:
      operationId: listNotes
      responses:
        "200":
          description: ok
  /api/notes/{id}:
    delete:
      operationId: deleteNote
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "204":
          description: gone
`

const JSON_SPEC = JSON.stringify({
  swagger: "2.0",
  info: { title: "Old Notes", version: "1" },
  host: "api.notes.example",
  basePath: "/v1",
  paths: { "/notes": { get: { responses: { "200": { description: "ok" } } } } },
})

type Served = { body: string; status?: number }

const serve = (served: Served) => {
  const asked: { url: string; init: RequestInit }[] = []
  const fetch: SpecFetch = async (url, init) => {
    asked.push({ url, init })
    return new Response(served.body, { status: served.status ?? 200 })
  }
  return { fetch, asked }
}

describe("downloadSpec", () => {
  it("reads a YAML description, resolves a relative server against its URL and records why", async () => {
    const { fetch, asked } = serve({ body: YAML_SPEC })

    const spec = await downloadSpec("https://docs.notes.example/openapi.yaml", fetch)

    expect(asked[0]?.init.redirect).toBe("error")
    expect(spec).toMatchObject({
      kind: "openapi",
      file: "openapi.yaml",
      title: "Acme Notes API",
      operations: 2,
      hosts: ["docs.notes.example"],
      prefix: ["api"],
      sha256: createHash("sha256").update(YAML_SPEC).digest("hex"),
    })
    expect(spec.patches).toEqual([
      expect.objectContaining({ pointer: "/servers", value: [{ url: "https://docs.notes.example/v1" }] }),
    ])
  })

  it("lists the hosts an OAuth sign-in in the description reaches beside the API's", async () => {
    const attio = JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Attio", version: "2" },
      servers: [{ url: "https://api.attio.example" }],
      paths: {},
      components: {
        securitySchemes: {
          oauth2: {
            type: "oauth2",
            flows: {
              authorizationCode: {
                authorizationUrl: "https://app.attio.example/authorize",
                tokenUrl: "https://app.attio.example/oauth/token",
                scopes: {},
              },
            },
          },
        },
      },
    })
    const spec = await downloadSpec("https://api.attio.example/openapi.json", serve({ body: attio }).fetch)
    expect(spec.hosts).toEqual(["api.attio.example", "app.attio.example"])
  })

  it("reads a JSON Swagger 2.0 description and takes its host", async () => {
    const spec = await downloadSpec("https://notes.example/swagger.json", serve({ body: JSON_SPEC }).fetch)

    expect(spec).toMatchObject({ kind: "swagger", file: "swagger.json", hosts: ["api.notes.example"], patches: [] })
  })

  it.each([
    ["http://notes.example/openapi.json", "only https is downloaded"],
    ["ftp://notes.example/openapi.json", "only https is downloaded"],
    ["https://user:secret@notes.example/openapi.json", "would be committed"],
    ["notes.example/openapi.json", "is not a URL"],
  ])("refuses %s before any request", async (url, message) => {
    const { fetch, asked } = serve({ body: YAML_SPEC })

    await expect(downloadSpec(url, fetch)).rejects.toThrow(message)
    expect(asked).toEqual([])
  })

  it.each(["http://localhost:8080/openapi.yaml", "http://127.0.0.1/openapi.yaml"])(
    "takes http from %s",
    async (url) => {
      await expect(downloadSpec(url, serve({ body: YAML_SPEC }).fetch)).resolves.toMatchObject({ kind: "openapi" })
    },
  )

  it("stops reading past the size limit", async () => {
    await expect(downloadSpec("https://notes.example/big.yaml", serve({ body: YAML_SPEC }).fetch, 100)).rejects.toThrow(
      "larger than",
    )
  })

  it.each([
    [{ body: "not found", status: 404 }, "answered HTTP 404"],
    [{ body: "<html><title>a: b: c</title></html>" }, "neither JSON nor YAML"],
    [{ body: "just: a map" }, "neither an OpenAPI 3 nor a Swagger 2.0 document"],
    [{ body: '{"discoveryVersion":"v1"}' }, "use --spec discovery"],
  ])("refuses what is not an OpenAPI or Swagger description: %j", async (served, message) => {
    await expect(downloadSpec("https://notes.example/spec", serve(served).fetch)).rejects.toThrow(message)
  })
})

describe("new --spec-url", () => {
  const root = join(import.meta.dirname, "../..")
  const flags = { ...NOTES_FLAGS, spec: undefined, "spec-url": "https://docs.notes.example/openapi.yaml" }

  it("puts the downloaded description in place of the sample's and points the api group at its server", async () => {
    const cwd = tempDir("spec-url")

    const out = await runNew(
      cwd,
      await loadSource(root),
      { name: "cal-cli", flags },
      io(),
      serve({ body: YAML_SPEC }).fetch,
    )

    const dir = join(cwd, "cal-cli")
    expect(read(dir, "spec/cal/openapi.yaml")).toBe(YAML_SPEC)
    expect(existsSync(join(dir, "spec/cal/openapi.json"))).toBe(false)
    const provenance = JSON.parse(read(dir, "spec/cal/provenance.json"))
    expect(provenance.sources).toEqual([
      {
        name: "cal",
        url: "https://docs.notes.example/openapi.yaml",
        file: "openapi.yaml",
        sha256: createHash("sha256").update(YAML_SPEC).digest("hex"),
      },
    ])
    expect(read(dir, "src/identity.ts")).toContain('hosts: ["comments.example.invalid", "docs.notes.example"],')
    expect(read(dir, "src/config.ts")).toContain('service: "Acme Notes",')
    expect(read(dir, "src/identity.ts")).toContain('\nexport const SERVICE = "Acme Notes"\n')
    expect(read(dir, "src/identity.ts")).not.toContain("SAMPLE: your service's name")
    for (const page of ["docs/index.md", "docs/security.md", "skills/example-cal-cli/SKILL.md"]) {
      expect(read(dir, page)).toContain("group reaches Acme Notes")
      expect(read(dir, page)).not.toContain("Example Comments")
    }
    expect(read(dir, "scripts/generate.ts")).toContain('group: "cal"')
    expect(read(dir, "scripts/generate.ts")).toContain('names: { fromPath: true, segments: { "api": "" } }')
    expect(read(dir, "scripts/spec-model.ts")).toContain('"url": "https://docs.notes.example/v1"')
    expect(JSON.parse(read(dir, "package.json")).devDependencies.yaml).toBeTruthy()
    expect(read(dir, "docs/dev/DESIGN.md")).toContain("**API description:** OpenAPI 3.0 or 3.1")
    expect(out).toContain("Downloaded Acme Notes API, 2 operations, into spec/cal/openapi.yaml")
    const readme = read(dir, "README.md")
    expect(readme.split("\n")[0]).toBe("# cal: Acme Notes CLI for AI agents")
    expect(readme).toContain("**Every operation of the Acme Notes API is a command.**")
  })

  it("refuses a --spec the description contradicts, before writing anything", async () => {
    const cwd = tempDir("spec-url-kind")

    await expect(
      runNew(
        cwd,
        await loadSource(root),
        { name: "cal-cli", flags: { ...flags, spec: "swagger" } },
        io(),
        serve({ body: YAML_SPEC }).fetch,
      ),
    ).rejects.toThrow("--spec swagger: https://docs.notes.example/openapi.yaml is OpenAPI 3")
    expect(existsSync(join(cwd, "cal-cli"))).toBe(false)
  })
})

describe("a CLI made with --spec", () => {
  const root = join(import.meta.dirname, "../..")

  // src/ imports src/generated/, so a build or a typecheck before the first pnpm generate failed.
  it("generates before it builds or typechecks when src/generated/ is missing", async () => {
    const cwd = tempDir("spec-build")
    await runNew(cwd, await loadSource(root), { name: "cal-cli", flags: { ...NOTES_FLAGS, spec: "openapi" } }, io())

    const { scripts } = JSON.parse(read(join(cwd, "cal-cli"), "package.json"))
    for (const key of ["build", "typecheck"])
      expect(scripts[key], key).toMatch(/^node --experimental-strip-types scripts\/generate\.ts --if-missing && /)
    expect(read(join(cwd, "cal-cli"), "scripts/generate.ts")).toContain('process.argv.includes("--if-missing")')
  })
})

describe("new --spec graphql --spec-url", () => {
  const root = join(import.meta.dirname, "../..")
  const schema = readFileSync(join(import.meta.dirname, "../seeds/graphql/spec/clidev/schema.json"), "utf8")
  const flags = { ...NOTES_FLAGS, spec: "graphql", "spec-url": "https://api.notes.example/graphql" }

  it("asks the endpoint for its schema as spec:sync does, and points the scripts at it", async () => {
    const cwd = tempDir("spec-graphql")
    const { fetch, asked } = serve({ body: JSON.stringify({ data: JSON.parse(schema) }) })

    const out = await runNew(cwd, await loadSource(root), { name: "cal-cli", flags }, io(), fetch)

    const dir = join(cwd, "cal-cli")
    expect(asked.map((one) => [one.url, one.init.method])).toEqual([["https://api.notes.example/graphql", "POST"]])
    expect(read(dir, "spec/cal/schema.json")).toBe(schema)
    const provenance = JSON.parse(read(dir, "spec/cal/provenance.json"))
    expect(provenance).toMatchObject({
      source: "https://api.notes.example/graphql",
      sha256: createHash("sha256").update(schema).digest("hex"),
    })
    expect(read(dir, "scripts/spec-model.ts")).toContain('const URL = "https://api.notes.example/graphql"')
    expect(read(dir, "scripts/sync-spec.ts")).toContain('url: "https://api.notes.example/graphql"')
    expect(read(dir, "scripts/generate.ts")).toContain('group: "cal"')
    expect(read(dir, "src/identity.ts")).toContain('"api.notes.example"')
    expect(JSON.parse(read(dir, "package.json")).devDependencies.yaml).toBeUndefined()
    expect(out).toContain("Downloaded api.notes.example, 4 operations, into spec/cal/schema.json")
  })
})
