import { hostFetch, retrying } from "@wirecat/cli-base/http"
import { serviceApiCommand } from "@wirecat/cli-core/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf, PACE, tokenOf } from "../context.js"
import { DESKTOP, IDENTITY } from "../identity.js"

/**
 * The service's raw API from its spec, `api list`, `api show` and one command per operation, through cli-core's shared
 * group. The manifest gives the server, the sign-in header, the paging of `--all` and the keys: each write asks or
 * refuses by `api.<operation>`, a delete or a share also by its key. The requests keep the profile's pace.
 * The token is the profile's own, read by `tokenOf` like every other command's.
 */
export const apiCommand = (): Command =>
  serviceApiCommand({
    ...API,
    app: IDENTITY,
    configuration,
    fetch: (command) => {
      const { environment, env, profile } = contextOf(command)
      const send = hostFetch({ hosts: DESKTOP.hosts ?? [], ...(environment.fetch ? { fetch: environment.fetch } : {}) })
      return retrying(send, { pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE) })
    },
    token: tokenOf,
    schemas: () => import("../generated/schemas.js").then((module) => module.schemas),
    definitions: () => import("../generated/definitions.js").then((module) => module.definitions),
  })
