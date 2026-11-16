import { join } from "node:path"
import { type ApiModel, generate, manifestGenerator } from "@wirecat/cli-base/codegen"
import { describe, expect, it } from "vitest"

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
