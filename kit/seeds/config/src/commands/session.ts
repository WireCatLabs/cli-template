import { CliError } from "@wirecat/cli-base"
import { serviceApiCall, tokenSessionCommand } from "@wirecat/cli-core/cli"
import { valueAt } from "@wirecat/cli-core/manifest"
import type { Command } from "commander"
import { API, configuration } from "../config.js"
import { contextOf } from "../context.js"
import { VERIFY } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { serviceFetch } from "./api.js"

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
      const { environment } = contextOf(command)
      const call = serviceApiCall({
        manifest: API.manifest,
        service: API.service,
        fetch: serviceFetch(environment),
        token: () => token,
      })
      const answer = await call(VERIFY.operation, { path: {}, query: {}, headers: {}, fields: {} })
      // A service such as Attio answers a revoked key with 200 and `active: false`, not with 401.
      if (VERIFY.active && valueAt(answer, VERIFY.active) !== true)
        throw new CliError("authentication_error", `${API.service} does not accept this token; sign in again`)
      const id = valueAt(answer, VERIFY.id)
      if (typeof id !== "string" && typeof id !== "number")
        throw new CliError("provider_error", `${API.service} answered ${VERIFY.operation} without ${VERIFY.id}`, {
          reason: "verify.no-id",
        })
      const name = VERIFY.name ? valueAt(answer, VERIFY.name) : undefined
      return { id: String(id), account: { id: String(id), ...(typeof name === "string" ? { name } : {}) } }
    },
  })
