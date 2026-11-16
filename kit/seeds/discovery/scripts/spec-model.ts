import { join } from "node:path"
import { type ApiModel, adaptDiscovery, readDiscovery } from "@wirecat/cli-base/codegen"

/**
 * The Discovery documents as committed; readDiscovery refuses one whose hash no longer matches provenance.json.
 * A Discovery path is relative to its service's `servicePath`, while the api group sends `/path` to one server, so
 * each path gets its service's prefix and every service must share one `rootUrl`, which becomes that server.
 */
export const specModel = async (root: string): Promise<{ model: ApiModel; notes: string[] }> => {
  const documents = readDiscovery(join(root, "spec/clidev"))
  const { model, metadata, services } = adaptDiscovery(documents, {
    sourceRevision: "spec/clidev/provenance.json",
    // SAMPLE: method id → why the CLI leaves it out, as a watch method that needs a public address.
    exclude: {},
  })
  const roots = new Set(Object.values(services).map((service) => service.rootUrl))
  if (roots.size > 1) throw new Error(`the services have different rootUrls (${[...roots].join(", ")})`)
  const prefixOf = new Map(
    model.operations.map((operation) => [operation.id, services[operation.id.split(".")[0] ?? ""]?.servicePath ?? ""]),
  )
  const operations = model.operations.map((operation) =>
    operation.binding.kind === "http"
      ? {
          ...operation,
          binding: { ...operation.binding, path: `/${prefixOf.get(operation.id)}${operation.binding.path}` },
        }
      : operation,
  )
  return {
    model: { ...model, operations, servers: [...roots].map((url) => ({ url })) },
    notes: metadata.omissions.map((line) => `left out: ${line}`),
  }
}
