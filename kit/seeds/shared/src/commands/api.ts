import { hostFetch } from "@wirecat/cli-base/http"
import { serviceApiCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf, tokenOf } from "../context.js"
import { servers } from "../generated/manifest.js"
import { DESKTOP, IDENTITY } from "../identity.js"

// The server is the first the spec names; a spec without one gets it by a patch in scripts/spec-model.ts, with the
// documentation that names it as the reason.
export const API_URL = servers[0]?.url ?? ""

/**
 * The service's raw API from its spec, `api list`, `api show` and one command per operation, through cli-core's shared
 * group: each write asks or refuses by `api.<operation>`, a delete also by the delete key, and the sign-in is the
 * profile's own, read by `tokenOf` like every other command's.
 */
export const apiCommand = (): Command =>
  serviceApiCommand({
    ...API,
    app: IDENTITY,
    configuration,
    baseUrl: API_URL,
    fetch: (command) => {
      const { environment } = contextOf(command)
      return hostFetch({ hosts: DESKTOP.hosts ?? [], ...(environment.fetch ? { fetch: environment.fetch } : {}) })
    },
    headers: (command) => ({ authorization: `Bearer ${tokenOf(command)}` }),
    schemas: () => import("../generated/schemas.js").then((module) => module.schemas),
    definitions: () => import("../generated/definitions.js").then((module) => module.definitions),
  })
