import { hostFetch, retrying } from "@wirecat/cli-base/http"
import { serviceApiCommand } from "@wirecat/cli-core/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { servers } from "../generated/manifest.js"
import { DESKTOP, IDENTITY } from "../identity.js"

// scripts/generate.ts refuses a spec whose first server is not one fixed https address.
export const API_URL = servers[0]?.url ?? ""

/**
 * The service's raw API from its spec, `api list`, `api show` and one command per operation, through cli-core's shared
 * group: each write asks or refuses by `api.<operation>`, a delete also by the delete key, the requests keep the
 * profile's pace, and the sign-in is the profile's own, read by `tokenOf` like every other command's.
 */
export const apiCommand = (): Command =>
  serviceApiCommand({
    ...API,
    app: IDENTITY,
    configuration,
    baseUrl: API_URL,
    fetch: (command) => {
      const { environment, env, profile } = contextOf(command)
      const send = hostFetch({ hosts: DESKTOP.hosts ?? [], ...(environment.fetch ? { fetch: environment.fetch } : {}) })
      return retrying(send, { pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE) })
    },
    // An operation the spec marks `security: []` needs no sign-in, and a CLI without one has no token to send.
    headers: (command, operation): Record<string, string> =>
      operation.security?.length === 0 ? {} : { authorization: `Bearer ${tokenOf(command)}` },
    schemas: () => import("../generated/schemas.js").then((module) => module.schemas),
    definitions: () => import("../generated/definitions.js").then((module) => module.definitions),
  })
