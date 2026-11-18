import { defineCli } from "@wirecat/cli-core/manifest"

const times = { createdAt: "createdAt", updatedAt: "updatedAt", archivedAt: "archivedAt" }
const page = "pageInfo { hasNextPage endCursor }"
const issue = `nodes { id identifier title createdAt updatedAt archivedAt team { id } } ${page}`

export default defineCli({
  identity: {
    command: "acmet",
    package: "@example/acmet-cli",
    prefix: "ACMET",
    service: "Acme Tracker",
    owner: "example",
  },
  spec: { kind: "graphql", from: "https://api.acme-tracker.example/graphql" },
  auth: { preset: "token", verify: { operation: "viewer", id: "id", name: "name" } },
  category: "tracker",
  source: {
    provider: "acme-tracker",
    kinds: ["team", "issue"],
    entities: {
      team: {
        list: { operation: "teams", variables: { first: 50, includeArchived: true } },
        map: { externalId: "id", name: "name", key: "key", ...times },
      },
      issue: {
        list: { operation: "issues", variables: { first: 50, includeArchived: true }, selection: issue },
        changes: {
          operation: "issues",
          variables: { first: 50, includeArchived: true, filter: { updatedAt: { gte: "{since}" } } },
          selection: issue,
          since: "iso",
        },
        map: { externalId: "id", key: "identifier", title: "title", team: "team.id", ...times },
      },
    },
    self: { call: { operation: "viewer" }, path: "id" },
  },
})
