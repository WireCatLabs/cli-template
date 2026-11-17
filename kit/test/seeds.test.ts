import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type ApiModel, generate, manifestGenerator } from "@wirecat/cli-base/codegen"
import { describe, expect, it } from "vitest"
import { withoutApiSignIn } from "../src/new.js"

const seeds = join(import.meta.dirname, "../seeds")

type SpecModel = (root: string) => Promise<{ model: ApiModel; notes: string[] }>

const modelOf = async (scripts: string, kind: string) => {
  const { specModel } = (await import(join(seeds, scripts, "scripts/spec-model.ts"))) as { specModel: SpecModel }
  return (await specModel(join(seeds, kind))).model
}

// Each kind's spec model, run on its own sample as a CLI made with that --spec runs it, before any CLI exists.
describe("the --spec seeds", () => {
  it.each([
    ["openapi", "openapi-scripts", "https://comments.example.invalid/v1", "/comments/{comment_id}"],
    ["swagger", "openapi-scripts", "https://comments.example.invalid/v1", "/comments/{comment_id}"],
    ["discovery", "discovery", "https://comments.example.invalid/", "/v1/comments/{commentId}"],
  ])("%s: one server, five commands named from the paths, a delete key", async (kind, scripts, server, path) => {
    const model = await modelOf(scripts, kind)
    const [manifest] = generate(model, [manifestGenerator({ path: "manifest.ts" })], {
      banner: ["test"],
      names: { fromPath: true },
      permissions: { group: "comments" },
    })

    expect(model.servers?.map((one) => one.url)).toEqual([server])
    expect(model.operations.map((one) => one.binding.kind === "http" && one.binding.path)).toContain(path)
    for (const command of ["comments-list", "comments-get", "comments-create", "comments-update", "comments-delete"])
      expect(manifest?.content).toContain(`"command": "${command}"`)
    expect(manifest?.content).toContain('"key": "comments.delete"')
  })
})

it("graphql: the endpoint as its one server, one command per root field, a delete key, a key in a header", async () => {
  const model = await modelOf("graphql", "graphql")
  const [manifest] = generate(model, [manifestGenerator({ path: "manifest.ts" })], {
    banner: ["test"],
    names: { fromPath: true },
    permissions: { group: "comments" },
    auth: {
      securitySchemes: { key: { type: "apiKey", in: "header", name: "Authorization" } },
      security: [{ key: [] }],
      reason: "test",
    },
  })

  expect(model.servers?.map((one) => one.url)).toEqual(["https://comments.example.invalid/graphql"])
  for (const command of ["comments", "comment", "comment-create", "comment-delete"])
    expect(manifest?.content).toContain(`"command": "${command}"`)
  expect(manifest?.content).toContain('"key": "comments.delete"')
  expect(readFileSync(join(seeds, "graphql/scripts/generate.ts"), "utf8")).toContain(
    'securitySchemes: { key: { type: "apiKey", in: "header", name: "Authorization" } }',
  )
})

it("gives a CLI without sign-in an api group and a test fake with no token", () => {
  const seed = (path: string) => readFileSync(join(seeds, "shared", path), "utf8")
  const api = withoutApiSignIn("src/commands/api.ts", seed("src/commands/api.ts"))
  const test = withoutApiSignIn("src/api.test.ts", seed("src/api.test.ts"))
  expect(api).not.toContain("tokenOf")
  expect(api).toContain('import { contextOf, PACE } from "../context.js"')
  expect(test).not.toContain("FAKE_TOKEN")
  expect(withoutApiSignIn("src/config.ts", "as it was")).toBe("as it was")
  expect(() => withoutApiSignIn("src/commands/api.ts", "")).toThrow("src/commands/api.ts: no token to take out")
})

it("takes the key out of a GraphQL CLI without sign-in: the fake's header and the generator's auth", () => {
  const seed = (path: string) => readFileSync(join(seeds, "graphql", path), "utf8")
  const test = withoutApiSignIn("src/api.test.ts", seed("src/api.test.ts"))
  const generator = withoutApiSignIn("scripts/generate.ts", seed("scripts/generate.ts"))
  expect(test).not.toContain("FAKE_TOKEN")
  expect(generator).not.toContain("auth:")
  expect(generator).toContain("pagination: true,\n  },")
})
