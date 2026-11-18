import { defineCli } from "@wirecat/cli-core/manifest"

export default defineCli({
  identity: { command: "acme", package: "@example/acme-cli", prefix: "WCACME", service: "Acme", owner: "example" },
  spec: { kind: "openapi", from: "https://docs.acme.example/openapi.json" },
  auth: {
    preset: "token",
    verify: { operation: "getSelf", active: "active", id: "workspace_id", name: "workspace_name" },
  },
  category: "crm",
  source: {
    provider: "acme",
    kinds: ["organization", "person"],
    entities: {
      organization: {
        list: { operation: "listCompanies", query: { limit: 100 }, items: "data" },
        get: { operation: "getCompany", path: { company_id: "{id}" }, items: "data" },
        map: { externalId: "id", name: "name", url: "domain", createdAt: "created_at" },
      },
      person: {
        list: { operation: "listPeople", query: { limit: 100 }, items: "data" },
        get: { operation: "getPerson", path: { person_id: "{id}" }, items: "data" },
        map: {
          externalId: "id",
          name: "name",
          emails: { all: ["email"] },
          organizations: { all: ["company_id"] },
          createdAt: "created_at",
        },
      },
    },
    users: {
      call: { operation: "listMembers", items: "data" },
      map: { externalId: "id", name: "name", email: "email" },
    },
  },
})
