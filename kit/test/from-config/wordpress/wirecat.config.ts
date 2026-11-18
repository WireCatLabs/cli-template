import { defineCli } from "@wirecat/cli-core/manifest"

export default defineCli({
  identity: {
    command: "acmewp",
    package: "@example/acmewp-cli",
    prefix: "WCACMEWP",
    service: "WordPress",
    owner: "example",
  },
  spec: { kind: "wp-json", from: "https://wp.acme.example/wp-json/", version: "6.9.4" },
  auth: { preset: "app-password", verify: { operation: "getWpV2UsersMe", id: "id", name: "name" } },
  category: "other",
})
