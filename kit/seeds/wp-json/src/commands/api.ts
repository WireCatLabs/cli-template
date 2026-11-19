import { retrying } from "@wirecat/cli-base/http"
import {
  hostsFetch,
  manifestBaseUrl,
  type ServiceApiOptions,
  serviceApiCommand,
  signedInSite,
} from "@wirecat/cli-core/cli"
import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf, PACE, type ServiceEnvironment, tokenOf } from "../context.js"
import { DESKTOP, IDENTITY } from "../identity.js"

/** The site this run's profile signed in to, as `session start --site` kept it beside the password. */
export const siteOf = signedInSite(IDENTITY, configuration.resolveSettings)

/**
 * The CLI's own hosts and the profile's site (WC-CMD-32), over the test's fake when it gives one. Sites under one host
 * (host/blog, a multisite in subfolders) share it, so the sign-in goes only under the site's own /wp-json and drops on
 * a redirect out of it.
 */
export const serviceFetch = (environment: ServiceEnvironment, site: string) =>
  hostsFetch(
    [...new Set([...DESKTOP.hosts, new URL(`https://${site}`).hostname])],
    environment.fetch,
    manifestBaseUrl(API.manifest, undefined, { site }),
  )

/** The api group's options: its commands, and every write code sends through `serviceApiWriter`, use these alone. */
export const API_OPTIONS: ServiceApiOptions = {
  ...API,
  app: IDENTITY,
  configuration,
  serverVariables: siteOf,
  fetch: (command) => {
    const { environment, env, profile } = contextOf(command)
    return retrying(serviceFetch(environment, siteOf(command).site), {
      pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE),
    })
  },
  token: tokenOf,
  schemas: () => import("../generated/schemas.js").then((module) => module.schemas),
  definitions: () => import("../generated/definitions.js").then((module) => module.definitions),
}

/**
 * WordPress's REST API from the index, `api list`, `api show` and one command per route, through cli-core's shared
 * group, sent to the profile's own site. Each write asks or refuses by `api.<operation>`; a publish, a scheduled date
 * moved, a password taken off, a delete and a delete for good also by their keys.
 */
export const apiCommand = (): Command => serviceApiCommand(API_OPTIONS)
