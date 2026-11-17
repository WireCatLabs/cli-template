import { CliError } from "@wirecat/cli-base"
import { hostFetch } from "@wirecat/cli-base/http"
import { serviceApiCall, tokenSessionCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf } from "../context.js"
import { VERIFY } from "../generated/wirecat-config.js"
import { DESKTOP, IDENTITY } from "../identity.js"

const valueAt = (answer: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (at, key) => (at !== null && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined),
      answer,
    )

/**
 * `session start | status | end | list` (WC-ACCT-12): the token is checked by the call `auth.verify` names in
 * wirecat.config.ts, and the account is the id and name its answer holds.
 */
export const sessionCommand = (): Command =>
  tokenSessionCommand({
    app: IDENTITY,
    service: API.service,
    resolveSettings: configuration.resolveSettings,
    verify: async (command, token) => {
      if (!VERIFY) throw new CliError("configuration_error", "wirecat.config.ts names no auth.verify call")
      const { environment } = contextOf(command)
      const call = serviceApiCall({
        manifest: API.manifest,
        service: API.service,
        fetch: hostFetch({ hosts: DESKTOP.hosts ?? [], ...(environment.fetch ? { fetch: environment.fetch } : {}) }),
        token: () => token,
      })
      const answer = await call(VERIFY.operation, { path: {}, query: {}, headers: {}, fields: {} })
      const id = valueAt(answer, VERIFY.id)
      if (typeof id !== "string" && typeof id !== "number")
        throw new CliError("provider_error", `${API.service} answered ${VERIFY.operation} without ${VERIFY.id}`, {
          reason: "verify.no-id",
        })
      const name = VERIFY.name ? valueAt(answer, VERIFY.name) : undefined
      return { id: String(id), account: { id: String(id), ...(typeof name === "string" ? { name } : {}) } }
    },
  })
